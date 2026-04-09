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
 * Ana görev — Discovery → Scraper → Supabase (3 tablo) zinciri
 *
 * 1. Bugünün yarış şehirlerini keşfeder
 * 2. Her şehrin tüm verilerini kazır (koşu + at + AGF)
 * 3. races ve race_entries'e upsert, agf_history'e insert yapar
 */
export async function runScrapeTask(): Promise<{
  cities: number;
  records: number;
  inserted: number;
  error: string | null;
}> {
  const snapshotAt = new Date().toISOString();

  // Bugünün tarihi "YYYY-MM-DD" formatında
  const today = new Date();
  const raceDate = today.toISOString().split("T")[0];

  // 1. Şehirleri keşfet
  const cities = await discoverCities();

  if (cities.length === 0) {
    console.log("[MainTask] Bugün yarış bulunamadı.");
    return { cities: 0, records: 0, inserted: 0, error: null };
  }

  // 2. Her şehri kazı
  const allRaces: RaceRecord[] = [];
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
    return { cities: cities.length, records: 0, inserted: 0, error: "Hiç at verisi parse edilemedi" };
  }

  // 3a. races — upsert (statik, günde 1 kez değişir)
  const raceRows: RaceRow[] = allRaces.map((r) => ({
    city: r.city,
    race_no: r.raceNo,
    race_date: r.raceDate,
    race_time: r.raceTime,
    race_type: r.raceType,
    horse_category: r.horseCategory,
    distance: r.distance,
    track_surface: r.trackSurface,
    eid: r.eid,
    raw_conditions: r.rawConditions,
  }));
  await upsertRaces(raceRows);

  // 3b. race_entries — upsert (statik, günde 1 kez değişir)
  const entryRows: RaceEntryRow[] = allHorses.map((h) => ({
    city: h.city,
    race_no: h.raceNo,
    race_date: h.raceDate,
    horse_no: h.horseNo,
    horse_name: h.horseName,
    age: h.age,
    origin: h.origin,
    weight: h.weight,
    jockey: h.jockey,
    jockey_rank: h.jockeyRank,
    owner: h.owner,
    trainer: h.trainer,
    start_no: h.startNo,
    hp: h.hp,
    last_6_races: h.last6Races,
    kgs: h.kgs,
    s20: h.s20,
    best_time: h.bestTime,
    gny: h.gny,
    idm_flag: h.idmFlag,
  }));
  await upsertRaceEntries(entryRows);

  // 3c. agf_history — insert (zaman serisi, her 5 dk'da eklenir)
  const agfRows: AgfHistoryRow[] = allHorses.map((h) => ({
    city: h.city,
    race_no: h.raceNo,
    race_time: h.raceTime,
    horse_name: h.horseName,
    agf_rate: h.agfRate,
    snapshot_at: snapshotAt,
  }));

  const { count, error } = await insertAgfRecords(agfRows);

  return {
    cities: cities.length,
    records: allHorses.length,
    inserted: count,
    error,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
