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
 * Pencere boyutuna göre ilk ve son snapshot'ları karşılaştırarak
 * her at için AGF değişimini hesaplar.
 *
 * @param windowMinutes - Zaman penceresi (dakika): 5, 15, 30, 60 veya "opening" için 0
 */
export async function getAgfTrends(windowMinutes: number) {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  let windowStart: Date;

  if (windowMinutes === 0) {
    // "Açılış" — günün ilk snapshot'ı ile son snapshot karşılaştırması
    windowStart = todayStart;
  } else {
    windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000);
  }

  // Pencere içindeki ilk snapshot_at'ı bul
  const { data: firstSnapshotData } = await supabase
    .from("agf_history")
    .select("snapshot_at")
    .gte("snapshot_at", windowStart.toISOString())
    .order("snapshot_at", { ascending: true })
    .limit(1);

  // En son snapshot_at'ı bul
  const { data: lastSnapshotData } = await supabase
    .from("agf_history")
    .select("snapshot_at")
    .gte("snapshot_at", todayStart.toISOString())
    .order("snapshot_at", { ascending: false })
    .limit(1);

  if (!firstSnapshotData?.length || !lastSnapshotData?.length) {
    return { trends: [], firstSnapshot: null, lastSnapshot: null };
  }

  const firstSnapshotAt = firstSnapshotData[0].snapshot_at;
  const lastSnapshotAt = lastSnapshotData[0].snapshot_at;

  // Eğer aynı snapshot ise değişim yok
  if (firstSnapshotAt === lastSnapshotAt) {
    const { data: current } = await supabase
      .from("agf_history")
      .select("*")
      .eq("snapshot_at", lastSnapshotAt)
      .order("city", { ascending: true })
      .order("race_no", { ascending: true });

    return {
      trends: (current ?? []).map((row) => ({
        ...row,
        prev_agf_rate: null,
        change: null,
        change_pct: null,
      })),
      firstSnapshot: firstSnapshotAt,
      lastSnapshot: lastSnapshotAt,
    };
  }

  // İlk snapshot verileri
  const { data: firstData } = await supabase
    .from("agf_history")
    .select("*")
    .eq("snapshot_at", firstSnapshotAt);

  // Son snapshot verileri
  const { data: lastData } = await supabase
    .from("agf_history")
    .select("*")
    .eq("snapshot_at", lastSnapshotAt);

  // İlk snapshot'ı key'le map'le
  const firstMap = new Map<string, number | null>();
  for (const row of firstData ?? []) {
    const key = `${row.city}|${row.race_no}|${row.horse_name}`;
    firstMap.set(key, row.agf_rate);
  }

  // Son snapshot'taki her kayıt için değişim hesapla
  const trends = (lastData ?? []).map((row) => {
    const key = `${row.city}|${row.race_no}|${row.horse_name}`;
    const prevRate = firstMap.get(key) ?? null;
    const currentRate = row.agf_rate;

    let change: number | null = null;
    let changePct: number | null = null;

    if (prevRate !== null && currentRate !== null && prevRate !== 0) {
      change = parseFloat((currentRate - prevRate).toFixed(2));
      changePct = parseFloat((((currentRate - prevRate) / prevRate) * 100).toFixed(2));
    }

    return {
      ...row,
      prev_agf_rate: prevRate,
      change,
      change_pct: changePct,
    };
  });

  // Şehir ve koşu numarasına göre sırala
  trends.sort((a, b) => {
    if (a.city !== b.city) return a.city.localeCompare(b.city);
    if (a.race_no !== b.race_no) return a.race_no - b.race_no;
    return (a.agf_rate ?? 0) - (b.agf_rate ?? 0);
  });

  return {
    trends,
    firstSnapshot: firstSnapshotAt,
    lastSnapshot: lastSnapshotAt,
  };
}

