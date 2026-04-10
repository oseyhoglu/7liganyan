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
 * Şehirdeki TÜM altılı ganyan başlangıçlarından en geç olanın
 * UTC kesim saatini (+5 dk tolerans) döner.
 *
 * Birden fazla altılı varsa (1.Altılı + 2.Altılı), AGF son altılı
 * başlayana kadar toplanmaya devam eder.
 * Hiç altılı yoksa null döner.
 */
function getLatestAltiliCutoffUtc(races: RaceRecord[], raceDate: string): Date | null {
  const altiliRaces = races.filter((r) => r.isAltiliStart);
  if (altiliRaces.length === 0) return null;

  let latestCutoff: Date | null = null;

  for (const startRace of altiliRaces) {
    const [hStr, mStr] = startRace.raceTime.split(".");
    const hh = hStr.padStart(2, "0");
    const mm = (mStr ?? "00").padStart(2, "0");

    // Türkiye UTC+3 → UTC, +5 dk tolerans
    const cutoff = new Date(`${raceDate}T${hh}:${mm}:00+03:00`);
    cutoff.setMinutes(cutoff.getMinutes() + 5);

    if (!latestCutoff || cutoff > latestCutoff) {
      latestCutoff = cutoff;
    }
  }

  return latestCutoff;
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

  // 3c. agf_history — altılı ganyan başlamış şehirler hariç insert
  const skippedCities:   string[]   = [];
  const agfBlockedCities = new Set<string>();

  for (const city of cities) {
    const cityRaces = allRaces.filter((r) => r.city === city.cityName);
    const cutoff    = getLatestAltiliCutoffUtc(cityRaces, raceDate);

    if (cutoff && snapshotNow > cutoff) {
      agfBlockedCities.add(city.cityName);
      skippedCities.push(city.cityName);
      console.log(
        `[MainTask] ${city.cityName}: altılı ganyan başladı ` +
        `(kesim UTC: ${cutoff.toISOString()}), AGF eklenmeyecek.`,
      );
    }
  }

  const agfRows: AgfHistoryRow[] = allHorses
    .filter((h) => !agfBlockedCities.has(h.city))
    .map((h) => ({
      city:        h.city,
      race_no:     h.raceNo,
      race_time:   h.raceTime,
      horse_name:  h.horseName,
      agf_rate:    h.agfRate,
      snapshot_at: snapshotAt,
    }));

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
