import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

/**
 * Supabase client — server-side (API route'lar ve lib katmanı) kullanımı için.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface AgfHistoryRow {
  city: string;
  race_no: number;
  race_time: string;
  horse_name: string;
  agf_rate: number | null;
  snapshot_at: string; // ISO 8601 timestamp
}

/**
 * AGF kayıtlarını toplu olarak agf_history tablosuna ekler.
 * Aynı snapshot_at değeri tüm kayıtlara atanır — tutarlı gruplama için.
 */
export async function insertAgfRecords(
  rows: AgfHistoryRow[],
): Promise<{ count: number; error: string | null }> {
  if (rows.length === 0) {
    return { count: 0, error: null };
  }

  const { data, error } = await supabase
    .from("agf_history")
    .insert(rows)
    .select();

  if (error) {
    console.error("[Supabase] Insert hatası:", error.message);
    return { count: 0, error: error.message };
  }

  console.log(`[Supabase] ${data?.length ?? 0} kayıt eklendi.`);
  return { count: data?.length ?? 0, error: null };
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

