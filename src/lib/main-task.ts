import { discoverCities } from "./discovery";
import { scrapeCity, HorseRecord } from "./scraper";
import { insertAgfRecords, AgfHistoryRow } from "./supabase";

/**
 * Ana görev — Discovery → Scraper → Supabase zinciri
 *
 * 1. Bugünün yarış şehirlerini keşfeder
 * 2. Her şehrin sayfasını kazıyarak at+AGF verilerini toplar
 * 3. Tüm verileri aynı snapshot_at ile Supabase'e kaydeder
 */
export async function runScrapeTask(): Promise<{
  cities: number;
  records: number;
  inserted: number;
  error: string | null;
}> {
  const snapshotAt = new Date().toISOString();

  // 1. Şehirleri keşfet
  const cities = await discoverCities();

  if (cities.length === 0) {
    console.log("[MainTask] Bugün yarış bulunamadı.");
    return { cities: 0, records: 0, inserted: 0, error: null };
  }

  // 2. Her şehri kazı (sıralı — rate limiting için 500ms aralık)
  const allRecords: HorseRecord[] = [];

  for (const city of cities) {
    try {
      const records = await scrapeCity(city.url, city.cityName);
      allRecords.push(...records);
    } catch (err) {
      console.error(`[MainTask] ${city.cityName} kazıma hatası:`, err);
    }
    // Rate limiting: TJK'ya nazik ol
    await sleep(500);
  }

  console.log(
    `[MainTask] Toplam ${allRecords.length} kayıt toplandı (${cities.length} şehir).`,
  );

  if (allRecords.length === 0) {
    return {
      cities: cities.length,
      records: 0,
      inserted: 0,
      error: "Hiç at verisi parse edilemedi",
    };
  }

  // 3. Supabase'e kaydet — tümü aynı snapshot_at ile
  const rows: AgfHistoryRow[] = allRecords.map((r) => ({
    city: r.city,
    race_no: r.raceNo,
    race_time: r.raceTime,
    horse_name: r.horseName,
    agf_rate: r.agfRate,
    snapshot_at: snapshotAt,
  }));

  const { count, error } = await insertAgfRecords(rows);

  return {
    cities: cities.length,
    records: allRecords.length,
    inserted: count,
    error,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

