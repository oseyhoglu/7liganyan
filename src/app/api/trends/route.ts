import { NextRequest } from "next/server";
import { getAgfTrends } from "@/lib/supabase";

/**
 * GET /api/trends?window=opening|5m|15m|30m|1h
 *
 * Dashboard'un çağıracağı trend verisi endpoint'i.
 * Seçilen zaman penceresindeki AGF değişimlerini döner.
 */

const WINDOW_MAP: Record<string, number> = {
  opening: 0,   // Günün açılışından şimdiye
  "5m": 5,
  "15m": 15,
  "30m": 30,
  "1h": 60,
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const windowParam = searchParams.get("window") || "opening";

  const windowMinutes = WINDOW_MAP[windowParam];

  if (windowMinutes === undefined) {
    return Response.json(
      {
        error: `Geçersiz window parametresi: "${windowParam}". Geçerli değerler: ${Object.keys(WINDOW_MAP).join(", ")}`,
      },
      { status: 400 },
    );
  }

  try {
    const result = await getAgfTrends(windowMinutes);

    return Response.json({
      window: windowParam,
      windowMinutes,
      count: result.trends.length,
      firstSnapshot: result.firstSnapshot,
      lastSnapshot: result.lastSnapshot,
      trends: result.trends,
    });
  } catch (error) {
    console.error("[API /trends] Hata:", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Bilinmeyen hata",
      },
      { status: 500 },
    );
  }
}

