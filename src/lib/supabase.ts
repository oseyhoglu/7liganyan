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
 * Strateji:
 *  1. Penceredeki global ilk ve bugünün son snapshot_at'ını bul (2 × limit-1 sorgu).
 *  2. Her iki timestamp için tam veriyi çek (~100-500 satır, limit sorunsuz).
 *  3. Son snapshot'ta olup ilk snapshot'ta olmayan atlar için
 *     koşu bazında ek sorgu yaparak kendi ilk kayıtlarını bul.
 *  4. Farkları hesapla.
 *
 * @param windowMinutes  0 = günün açılışından şimdiye, diğerleri dakika cinsinden
 */
export async function getAgfTrends(windowMinutes: number) {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const windowStart =
    windowMinutes === 0
      ? todayStart
      : new Date(now.getTime() - windowMinutes * 60 * 1000);

  // ── 1. Sınır timestamp'lerini bul ────────────────────────
  const [{ data: firstTsRows }, { data: lastTsRows }] = await Promise.all([
    supabase
      .from("agf_history")
      .select("snapshot_at")
      .gte("snapshot_at", windowStart.toISOString())
      .order("snapshot_at", { ascending: true })
      .limit(1),
    supabase
      .from("agf_history")
      .select("snapshot_at")
      .gte("snapshot_at", todayStart.toISOString())
      .order("snapshot_at", { ascending: false })
      .limit(1),
  ]);

  if (!firstTsRows?.length || !lastTsRows?.length) {
    return { trends: [], firstSnapshot: null, lastSnapshot: null };
  }

  const firstTs = firstTsRows[0].snapshot_at as string;
  const lastTs  = lastTsRows[0].snapshot_at  as string;

  // ── 2. İki snapshot'ın tüm verilerini çek ────────────────
  const [{ data: firstData }, { data: lastData }] = await Promise.all([
    supabase.from("agf_history").select("*").eq("snapshot_at", firstTs),
    supabase.from("agf_history").select("*").eq("snapshot_at", lastTs),
  ]);

  type Row = NonNullable<typeof firstData>[0];

  // İlk snapshot'tan at → ilk satır map'i
  const firstMap = new Map<string, Row>();
  for (const row of firstData ?? []) {
    firstMap.set(`${row.city}|${row.race_no}|${row.horse_name}`, row);
  }

  // ── 3. Son snapshot'ta olup ilk snapshot'ta olmayan atlar ─
  if (firstTs !== lastTs) {
    const missingRows = (lastData ?? []).filter(
      (r) => !firstMap.has(`${r.city}|${r.race_no}|${r.horse_name}`),
    );

    if (missingRows.length > 0) {
      // Koşu bazında grupla, her koşu için tek bir fallback sorgu yap
      const raceKeys = [
        ...new Set(missingRows.map((r) => `${r.city}||${r.race_no}`)),
      ];

      await Promise.all(
        raceKeys.map(async (rk) => {
          const [city, raceNoStr] = rk.split("||");
          const race_no = parseInt(raceNoStr, 10);

          const { data: earlyRows } = await supabase
            .from("agf_history")
            .select("*")
            .eq("city", city)
            .eq("race_no", race_no)
            .gte("snapshot_at", windowStart.toISOString())
            .order("snapshot_at", { ascending: true })
            .limit(200); // koşu başına at sayısı ~ 10-20, 200 birkaç snapshot karşılar

          for (const row of earlyRows ?? []) {
            const key = `${row.city}|${row.race_no}|${row.horse_name}`;
            if (!firstMap.has(key)) {
              firstMap.set(key, row); // zaten artan sırada: ilk karşılaşılan = en eski
            }
          }
        }),
      );
    }
  }

  // ── 4. Trend hesapla ─────────────────────────────────────
  const trends = (lastData ?? []).map((last) => {
    const key     = `${last.city}|${last.race_no}|${last.horse_name}`;
    const first   = firstMap.get(key);
    const prevRate    = first?.agf_rate ?? null;
    const currentRate = last.agf_rate;

    // Karşılaştırma: farklı timestamp + null olmayan değerler
    const hasHistory = !!first && first.snapshot_at !== last.snapshot_at;

    let change: number | null    = null;
    let changePct: number | null = null;

    if (hasHistory && prevRate !== null && currentRate !== null) {
      change = parseFloat((currentRate - prevRate).toFixed(2));
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
    if (a.city !== b.city) return a.city.localeCompare(b.city, "tr");
    if (a.race_no !== b.race_no) return a.race_no - b.race_no;
    return (a.agf_rate ?? 0) - (b.agf_rate ?? 0);
  });

  return { trends, firstSnapshot: firstTs, lastSnapshot: lastTs };
}
