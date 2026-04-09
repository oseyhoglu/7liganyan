import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─────────────────────────────────────────────────
//  Row Tipleri
// ─────────────────────────────────────────────────

export interface AgfHistoryRow {
  city: string;
  race_no: number;
  race_time: string;
  horse_name: string;
  agf_rate: number | null;
  snapshot_at: string;
}

export interface RaceRow {
  city: string;
  race_no: number;
  race_date: string;
  race_time: string;
  race_type: string;
  horse_category: string;
  distance: number | null;
  track_surface: string;
  eid: string;
  raw_conditions: string;
}

export interface RaceEntryRow {
  city: string;
  race_no: number;
  race_date: string;
  horse_no: number | null;
  horse_name: string;
  age: string;
  origin: string;
  weight: number | null;
  jockey: string;
  jockey_rank: string;
  owner: string;
  trainer: string;
  start_no: string;
  hp: number | null;
  last_6_races: string;
  kgs: number | null;
  s20: number | null;
  best_time: string;
  gny: string;
  idm_flag: boolean;
}

/**
 * AGF kayıtlarını toplu olarak agf_history tablosuna ekler.
 */
export async function insertAgfRecords(
  rows: AgfHistoryRow[],
): Promise<{ count: number; error: string | null }> {
  if (rows.length === 0) return { count: 0, error: null };

  const { data, error } = await supabase
    .from("agf_history")
    .insert(rows)
    .select();

  if (error) {
    console.error("[Supabase] Insert hatası:", error.message);
    return { count: 0, error: error.message };
  }

  console.log(`[Supabase] ${data?.length ?? 0} AGF kaydı eklendi.`);
  return { count: data?.length ?? 0, error: null };
}

/**
 * Koşu bilgilerini races tablosuna upsert eder.
 * Unique key: (city, race_no, race_date)
 */
export async function upsertRaces(
  rows: RaceRow[],
): Promise<{ count: number; error: string | null }> {
  if (rows.length === 0) return { count: 0, error: null };

  const { data, error } = await supabase
    .from("races")
    .upsert(rows, { onConflict: "city,race_no,race_date", ignoreDuplicates: false })
    .select();

  if (error) {
    console.error("[Supabase] races upsert hatası:", error.message);
    return { count: 0, error: error.message };
  }

  console.log(`[Supabase] ${data?.length ?? 0} koşu kaydı upsert edildi.`);
  return { count: data?.length ?? 0, error: null };
}

/**
 * At kayıtlarını race_entries tablosuna upsert eder.
 * Unique key: (city, race_no, race_date, horse_name)
 */
export async function upsertRaceEntries(
  rows: RaceEntryRow[],
): Promise<{ count: number; error: string | null }> {
  if (rows.length === 0) return { count: 0, error: null };

  const { data, error } = await supabase
    .from("race_entries")
    .upsert(rows, { onConflict: "city,race_no,race_date,horse_name", ignoreDuplicates: false })
    .select();

  if (error) {
    console.error("[Supabase] race_entries upsert hatası:", error.message);
    return { count: 0, error: error.message };
  }

  console.log(`[Supabase] ${data?.length ?? 0} at kaydı upsert edildi.`);
  return { count: data?.length ?? 0, error: null };
}

/**
 * Bugünün tüm koşu ve at verilerini getirir (frontend /api/races için).
 */
export async function getRacesWithEntries(dateStr: string) {
  const [racesResult, entriesResult] = await Promise.all([
    supabase
      .from("races")
      .select("*")
      .eq("race_date", dateStr)
      .order("city")
      .order("race_no"),
    supabase
      .from("race_entries")
      .select("*")
      .eq("race_date", dateStr)
      .order("city")
      .order("race_no")
      .order("horse_no"),
  ]);

  return {
    races: racesResult.data ?? [],
    entries: entriesResult.data ?? [],
    error: racesResult.error?.message ?? entriesResult.error?.message ?? null,
  };
}

/**
 * Belirli bir zaman penceresi için AGF trend verilerini getirir.
 *
 * Her at için KENDİ ilk ve son kaydını karşılaştırır.
 * Böylece ilk global snapshot'ta olmayan atlar için de doğru açılış değeri hesaplanır.
 *
 * @param windowMinutes - 0 = açılıştan bugüne (günün tüm kayıtları), diğerleri dakika cinsinden
 */
export async function getAgfTrends(windowMinutes: number) {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const windowStart =
    windowMinutes === 0
      ? todayStart
      : new Date(now.getTime() - windowMinutes * 60 * 1000);

  // Penceredeki tüm kayıtları sıralı çek (en eskiden en yeniye)
  const { data: allRows, error } = await supabase
    .from("agf_history")
    .select("*")
    .gte("snapshot_at", windowStart.toISOString())
    .order("snapshot_at", { ascending: true });

  if (error || !allRows || allRows.length === 0) {
    return { trends: [], firstSnapshot: null, lastSnapshot: null };
  }

  const firstSnapshot = allRows[0].snapshot_at;
  const lastSnapshot  = allRows[allRows.length - 1].snapshot_at;

  // Her at için kendi ilk ve son kaydını bul
  type Row = typeof allRows[0];
  const horseData = new Map<string, { first: Row; last: Row }>();

  for (const row of allRows) {
    const key = `${row.city}|${row.race_no}|${row.horse_name}`;
    if (!horseData.has(key)) {
      horseData.set(key, { first: row, last: row });
    } else {
      horseData.get(key)!.last = row; // sıralı geldiği için son atama = en yeni
    }
  }

  // Her at için değişim hesapla
  const trends = Array.from(horseData.values()).map(({ first, last }) => {
    const prevRate    = first.agf_rate;
    const currentRate = last.agf_rate;
    const hasHistory  = first.snapshot_at !== last.snapshot_at;

    let change: number | null    = null;
    let changePct: number | null = null;

    if (hasHistory && prevRate !== null && currentRate !== null) {
      change    = parseFloat((currentRate - prevRate).toFixed(2));
      changePct =
        prevRate !== 0
          ? parseFloat((((currentRate - prevRate) / prevRate) * 100).toFixed(2))
          : null;
    }

    return {
      ...last,
      prev_agf_rate: prevRate,
      change,
      change_pct: changePct,
    };
  });

  trends.sort((a, b) => {
    if (a.city !== b.city) return a.city.localeCompare(b.city);
    if (a.race_no !== b.race_no) return a.race_no - b.race_no;
    return (a.agf_rate ?? 0) - (b.agf_rate ?? 0);
  });

  return { trends, firstSnapshot, lastSnapshot };
}
