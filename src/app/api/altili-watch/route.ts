import { NextRequest } from "next/server";
import { runScrapeTask } from "@/lib/main-task";
import { supabase } from "@/lib/supabase";

// Vercel Hobby: max 60sn (kazıma + DB işlemleri için yeterli)
export const maxDuration = 60;

// ── Çalışma saati sınırları (Türkiye saati, UTC+3) ──────────
const WATCH_START_MINUTES = 9 * 60;        // 09:00
const WATCH_END_MINUTES   = 23 * 60 + 30;  // 23:30

/**
 * POST /api/altili-watch
 *
 * Zamanlama mantığı:
 *  1. 09:00-23:30 TR saati dışındaysa → hemen çık, hiçbir şey yapma
 *  2. Tüm altılılar başladıysa → dur, artık kazıma yapma
 *  3. Kritik pencere [T-10dk, T) → her çağrıda kazı (cron 1dk'da bir)
 *  4. Normal süre → son snapshot'tan ≥5dk geçmişse kazı, yoksa atla
 *
 * cron-job.org ayarı:
 *  - URL: POST /api/altili-watch
 *  - Header: Authorization: Bearer <CRON_SECRET>
 *  - Interval: Her 1 dakika, 09:00-23:30 arası
 */
export async function POST(request: NextRequest) {
  // ── Yetkilendirme ────────────────────────────────────────────
  const authHeader = request.headers.get("authorization");
  const expectedToken = `Bearer ${process.env.CRON_SECRET}`;

  if (!authHeader || authHeader !== expectedToken) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0]; // "YYYY-MM-DD"

  // ── 1. Zaman penceresi kontrolü (09:00-23:30 Türkiye saati) ─
  const nowTrMinutes = getTurkeyMinutes(now);

  if (nowTrMinutes < WATCH_START_MINUTES || nowTrMinutes > WATCH_END_MINUTES) {
    return Response.json({
      action: "skipped",
      reason: `Çalışma saati dışı — şu an ${minutesToHHMM(nowTrMinutes)} TR (pencere: 09:00-23:30)`,
      timestamp: now.toISOString(),
    });
  }

  // ── 2. Bugünün altılı başlangıç saatlerini DB'den çek ───────
  const { data: altiliRaces, error: altiliError } = await supabase
    .from("races")
    .select("city, race_no, race_time, altili_index")
    .eq("race_date", todayStr)
    .eq("is_altili_start", true)
    .order("city")
    .order("race_no");

  if (altiliError) {
    console.error("[AltiliWatch] DB sorgu hatası:", altiliError.message);
    return Response.json({ error: altiliError.message }, { status: 500 });
  }

  // Sabah 09:00 scrape'i henüz çalışmadıysa altılılar DB'de yoktur.
  // Bu durumda 5dk ritminde bekle — scrape çalışınca altılılar yüklenecek.
  if (!altiliRaces || altiliRaces.length === 0) {
    return await handleFallbackScrape(
      now,
      "Altılı kaydı henüz yok — sabah scrape bekleniyor",
    );
  }

  // ── 3. Altılıları sınıflandır ────────────────────────────────
  //
  //  minutesToRace <= 0 : Altılı başladı → kazıma DURUR, frontend son veriyi gösterir
  //  0 < minutesToRace < 10 : Kritik pencere → 1dk'da bir kazı
  //  minutesToRace >= 10    : Normal → 5dk'da bir kazı
  //
  const criticalAltilis: string[] = [];
  const upcomingAltilis: string[] = [];
  let hasActiveAltili = false; // Henüz başlamamış en az bir altılı var mı?

  for (const race of altiliRaces) {
    const raceMinutes = raceTimeToMinutes(race.race_time);
    if (raceMinutes === null) continue;

    const minutesToRace = raceMinutes - nowTrMinutes;
    const label = `${race.city} ${race.altili_index}.Altılı (${race.race_time})`;

    if (minutesToRace <= 0) {
      // Bu altılı başladı — kayıt izleme dışı, kazıma ve güncelleme yapılmaz
      console.log(`[AltiliWatch] ✅ ${label} başladı — izleme durduruldu.`);
      continue;
    }

    // Buraya geldiyse bu altılı henüz başlamadı
    hasActiveAltili = true;

    if (minutesToRace < 10) {
      // Kritik pencere: son 10 dakika (her 1 dakikada bir kazı)
      criticalAltilis.push(`${label} → ${minutesToRace}dk kaldı`);
    } else {
      // Normal: 5dk'da bir kazı
      upcomingAltilis.push(`${label} → ${minutesToRace}dk kaldı`);
    }

    // Rapor bildirimi: tam 5 dakika kala logla
    if (minutesToRace === 5) {
      console.log(`[AltiliWatch] ⚠️  RAPOR ZAMANI: ${label} — 5 dakika kaldı!`);
    }
  }

  // ── 4. Tüm altılılar başladıysa → tamamen dur ───────────────
  //  Frontend son çekilen AGF oranlarıyla gösterimi sürdürür,
  //  yeni kazıma yapılmaz, DB'deki veri güncellenmez.
  if (!hasActiveAltili) {
    console.log("[AltiliWatch] Bugünkü tüm altılı ganyanlar başladı. İzleme durduruldu.");
    return Response.json({
      action: "stopped",
      reason: "Bugünkü tüm altılı ganyanlar başladı — kazıma ve güncelleme durduruldu",
      timestamp: now.toISOString(),
    });
  }

  // ── 5. Kritik penceredeyse → her çağrıda kazı ───────────────
  if (criticalAltilis.length > 0) {
    console.log(`[AltiliWatch] 🔴 Kritik pencere: ${criticalAltilis.join(" | ")}`);
    const result = await runScrapeTask();

    return Response.json({
      action: "scraped",
      reason: "Kritik pencere — son 10 dakika (1dk aralık)",
      criticalAltilis,
      upcomingAltilis,
      ...result,
      timestamp: now.toISOString(),
    });
  }

  // ── 6. Kritik pencere dışı, aktif altılı var → 5dk'da bir kazı
  return await handleFallbackScrape(
    now,
    `Yaklaşan altılılar: ${upcomingAltilis.join(" | ")}`,
    upcomingAltilis,
  );
}

/**
 * Son AGF snapshot'ından 5dk geçmişse kazıma yapar, yoksa atlar.
 * Sadece kritik pencere dışında ve aktif altılı varken çağrılır.
 */
async function handleFallbackScrape(
  now: Date,
  reason: string,
  upcomingAltilis: string[] = [],
) {
  const { data: lastSnapshotRows } = await supabase
    .from("agf_history")
    .select("snapshot_at")
    .order("snapshot_at", { ascending: false })
    .limit(1);

  const lastAt = lastSnapshotRows?.[0]?.snapshot_at as string | undefined;
  const minutesSinceLast = lastAt
    ? (now.getTime() - new Date(lastAt).getTime()) / 60_000
    : 999;

  if (minutesSinceLast >= 5) {
    const result = await runScrapeTask();
    return Response.json({
      action: "scraped",
      reason: `${reason} — son kazımadan ${minutesSinceLast.toFixed(1)}dk geçti`,
      upcomingAltilis,
      ...result,
      timestamp: now.toISOString(),
    });
  }

  return Response.json({
    action: "skipped",
    reason: `${reason} — son kazımadan yalnızca ${minutesSinceLast.toFixed(1)}dk geçti`,
    upcomingAltilis,
    timestamp: now.toISOString(),
  });
}

/**
 * GET /api/altili-watch
 *
 * Bugünkü altılı ganyan zamanlarını ve şu anki durumu gösterir.
 * Dashboard veya manuel kontrol için kullanılabilir.
 */
export async function GET() {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const nowTrMinutes = getTurkeyMinutes(now);
  const inWindow =
    nowTrMinutes >= WATCH_START_MINUTES && nowTrMinutes <= WATCH_END_MINUTES;

  const { data: altiliRaces } = await supabase
    .from("races")
    .select("city, race_no, race_time, altili_index")
    .eq("race_date", todayStr)
    .eq("is_altili_start", true)
    .order("city")
    .order("race_no");

  const schedule = (altiliRaces ?? []).map((race) => {
    const raceMinutes = raceTimeToMinutes(race.race_time);
    const minutesToRace = raceMinutes !== null ? raceMinutes - nowTrMinutes : null;

    let status: string;
    let scrapeInterval: string;

    if (minutesToRace === null) {
      status = "unknown";
      scrapeInterval = "-";
    } else if (minutesToRace <= 0) {
      // Altılı başladı → kazıma durdu, frontend son veriyle çalışıyor
      status = "started";
      scrapeInterval = "durduruldu";
    } else if (minutesToRace < 10) {
      status = "critical"; // son 10dk → 1dk aralık
      scrapeInterval = "1dk";
    } else {
      status = "waiting"; // normal bekleme → 5dk aralık
      scrapeInterval = "5dk";
    }

    return {
      city: race.city,
      altiliIndex: race.altili_index,
      raceNo: race.race_no,
      raceTime: race.race_time,
      minutesToRace,
      status,
      scrapeInterval,
    };
  });

  return Response.json({
    now: now.toISOString(),
    nowTurkeyTime: minutesToHHMM(nowTrMinutes),
    inActiveWindow: inWindow,
    activeWindow: "09:00-23:30",
    totalAltilis: schedule.length,
    schedule,
  });
}

// ─────────────────────────────────────────────────
//  Yardımcı Fonksiyonlar
// ─────────────────────────────────────────────────

/** Türkiye saatini dakika cinsinden döner (UTC+3, kalıcı DST) */
function getTurkeyMinutes(date: Date): number {
  const trDate = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  return trDate.getUTCHours() * 60 + trDate.getUTCMinutes();
}

/** "15.30" → 930 (dakika) */
function raceTimeToMinutes(raceTime: string): number | null {
  const parts = raceTime.split(".");
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

/** 930 → "15:30" */
function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}
