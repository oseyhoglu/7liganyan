import { discoverCities } from "./discovery";
import { scrapeCity, HorseRecord, RaceRecord } from "./scraper";
import {
  insertAgfRecords,
  upsertRaces,
  upsertRaceEntries,
  AgfHistoryRow,
  RaceRow,
  RaceEntryRow,
} from "./supabase";

/**
 * Bir altılı başlangıç koşusu için UTC kesim saatini döner (+5dk tolerans).
 */
function getAltiliCutoffUtc(startRace: RaceRecord, raceDate: string): Date {
  const [hStr, mStr] = startRace.raceTime.split(".");
  const hh = hStr.padStart(2, "0");
  const mm = (mStr ?? "00").padStart(2, "0");
  const cutoff = new Date(`${raceDate}T${hh}:${mm}:00+03:00`);
  cutoff.setMinutes(cutoff.getMinutes() + 5);
  return cutoff;
}

/**
 * Bir koşunun hangi altılı grubuna ait olduğunu döner.
 * 0 = herhangi bir altılı grubuna ait değil (altılı başlamadan önceki koşular)
 */
function getAltiliGroup(raceNo: number, altiliStarts: RaceRecord[]): number {
  let group = 0;
  for (const start of [...altiliStarts].sort((a, b) => a.raceNo - b.raceNo)) {
    if (raceNo >= start.raceNo) group = start.altiliIndex;
  }
  return group;
}

/**
 * Ana görev — Discovery → Scraper → Supabase (3 tablo) zinciri
 */
export async function runScrapeTask(): Promise<{
  cities: number;
  records: number;
  inserted: number;
  skippedCities: string[];
  error: string | null;
}> {
  const snapshotAt  = new Date().toISOString();
  const snapshotNow = new Date(snapshotAt);

  const today    = new Date();
  const raceDate = today.toISOString().split("T")[0];

  // 1. Şehirleri keşfet
  const cities = await discoverCities();

  if (cities.length === 0) {
    console.log("[MainTask] Bugün yarış bulunamadı.");
    return { cities: 0, records: 0, inserted: 0, skippedCities: [], error: null };
  }

  // 2. Her şehri kazı
  const allRaces:  RaceRecord[]  = [];
  const allHorses: HorseRecord[] = [];

  for (const city of cities) {
    try {
      const result = await scrapeCity(city.url, city.cityName, raceDate);
      allRaces.push(...result.races);
      allHorses.push(...result.horses);
    } catch (err) {
      console.error(`[MainTask] ${city.cityName} kazıma hatası:`, err);
    }
    await sleep(500);
  }

  console.log(
    `[MainTask] ${cities.length} şehir → ${allRaces.length} koşu, ${allHorses.length} at.`,
  );

  if (allHorses.length === 0) {
    return { cities: cities.length, records: 0, inserted: 0, skippedCities: [], error: "Hiç at verisi parse edilemedi" };
  }

  // 3a. races — upsert (koşu bilgileri her zaman güncellenir)
  const raceRows: RaceRow[] = allRaces.map((r) => ({
    city:             r.city,
    race_no:          r.raceNo,
    race_date:        r.raceDate,
    race_time:        r.raceTime,
    race_type:        r.raceType,
    horse_category:   r.horseCategory,
    distance:         r.distance,
    track_surface:    r.trackSurface,
    eid:              r.eid,
    raw_conditions:   r.rawConditions,
    is_altili_start:  r.isAltiliStart,
    altili_index:     r.altiliIndex,
    ganyan_label:     r.ganyanLabel,
  }));
  await upsertRaces(raceRows);

  // 3b. race_entries — upsert (at bilgileri her zaman güncellenir)
  const entryRows: RaceEntryRow[] = allHorses.map((h) => ({
    city:         h.city,
    race_no:      h.raceNo,
    race_date:    h.raceDate,
    horse_no:     h.horseNo,
    horse_name:   h.horseName,
    age:          h.age,
    origin:       h.origin,
    weight:       h.weight,
    jockey:       h.jockey,
    jockey_rank:  h.jockeyRank,
    owner:        h.owner,
    trainer:      h.trainer,
    start_no:     h.startNo,
    hp:           h.hp,
    last_6_races: h.last6Races,
    kgs:          h.kgs,
    s20:          h.s20,
    best_time:    h.bestTime,
    gny:          h.gny,
    idm_flag:     h.idmFlag,
  }));
  await upsertRaceEntries(entryRows);

  // 3c. agf_history — koşu bazında altılı grubuna göre insert
  //
  // Mantık:
  //  • Şehirde altılı yoksa → kısıtsız kaydet (agf1Rate)
  //  • Koşu altılı grubuna ait değilse (grup 0) → 1. altılı kesimine kadar kaydet
  //  • Grubun altılısı başlamışsa → kaydetme (donduruldu)
  //  • 2. altılı koşusunda 1. altılı başlamışsa → agf2Rate kullan, yoksa agf1Rate
  //
  // Şehir bazında altılı başlangıç bilgisini önceden hazırla
  const cityAltiliInfo = new Map<string, {
    starts: RaceRecord[];
    cutoffs: Map<number, Date>; // altiliIndex → kesim saati (race_time + 5dk)
  }>();

  for (const race of allRaces.filter((r) => r.isAltiliStart)) {
    if (!cityAltiliInfo.has(race.city)) {
      cityAltiliInfo.set(race.city, { starts: [], cutoffs: new Map() });
    }
    const info = cityAltiliInfo.get(race.city)!;
    info.starts.push(race);
    info.cutoffs.set(race.altiliIndex, getAltiliCutoffUtc(race, raceDate));
  }

  const skippedCities: string[] = [];
  const agfRows: AgfHistoryRow[] = [];

  for (const h of allHorses) {
    const cityInfo = cityAltiliInfo.get(h.city);

    // Şehirde hiç altılı yoksa → kısıtsız kaydet
    if (!cityInfo) {
      agfRows.push({
        city: h.city, race_no: h.raceNo, race_time: h.raceTime,
        horse_name: h.horseName, agf_rate: h.agf1Rate, snapshot_at: snapshotAt,
      });
      continue;
    }

    // Bu koşunun altılı grubunu bul
    const altiliGroup = getAltiliGroup(h.raceNo, cityInfo.starts);

    // Grup 0 → altılı öncesi koşu: 1. altılının kesimini kullan
    const sortedStarts = [...cityInfo.starts].sort((a, b) => a.altiliIndex - b.altiliIndex);
    const effectiveGroup = altiliGroup > 0
      ? altiliGroup
      : (sortedStarts[0]?.altiliIndex ?? 1);

    const groupCutoff = cityInfo.cutoffs.get(effectiveGroup) ?? null;

    // Bu grubun altılısı başladıysa → donduruldu, kaydetme
    if (groupCutoff && snapshotNow > groupCutoff) continue;

    // Kullanılacak AGF oranını belirle
    let agfRate: number | null = h.agf1Rate;
    if (altiliGroup >= 2) {
      // 2. (veya üstü) altılı grubundaki koşu:
      // Daha düşük indeksli herhangi bir altılı başlamışsa → agf2Rate'e geç.
      // (Örn: 1. 6'LI GANYAN başlayınca 2. 6'LI GANYAN koşuları agf2Rate kullanır)
      const hasPrevStarted = cityInfo.starts.some((start) => {
        if (start.altiliIndex >= altiliGroup) return false;
        const prevCutoff = cityInfo.cutoffs.get(start.altiliIndex);
        return prevCutoff ? snapshotNow > prevCutoff : false;
      });
      if (hasPrevStarted) {
        agfRate = h.agf2Rate ?? h.agf1Rate;
      }
    }

    agfRows.push({
      city: h.city, race_no: h.raceNo, race_time: h.raceTime,
      horse_name: h.horseName, agf_rate: agfRate, snapshot_at: snapshotAt,
    });
  }

  // Tüm altılıları başlamış şehirleri logla
  for (const [cityName, info] of cityAltiliInfo) {
    const allStarted = [...info.cutoffs.values()].every((c) => snapshotNow > c);
    if (allStarted) {
      skippedCities.push(cityName);
      console.log(`[MainTask] ${cityName}: tüm altılı ganyanlar başladı, AGF donduruldu.`);
    }
  }

  const { count, error } = await insertAgfRecords(agfRows);

  return {
    cities:       cities.length,
    records:      allHorses.length,
    inserted:     count,
    skippedCities,
    error,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
