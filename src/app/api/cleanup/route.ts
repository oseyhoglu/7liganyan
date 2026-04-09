import { NextRequest } from "next/server";
import { cleanupOldData } from "@/lib/supabase";

/**
 * POST /api/cleanup
 *
 * Önceki günün tüm verilerini (agf_history, races, race_entries) siler.
 * cron-job.org tarafından her gün 00:05'te tetiklenmesi önerilir.
 *
 * Header: Authorization: Bearer <CRON_SECRET>
 */
export async function POST(request: NextRequest) {
  const authHeader    = request.headers.get("authorization");
  const expectedToken = `Bearer ${process.env.CRON_SECRET}`;

  if (!authHeader || authHeader !== expectedToken) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await cleanupOldData();

    console.log(
      `[Cleanup] agf_history: ${result.agfDeleted} satır, ` +
      `races: ${result.racesDeleted} satır, ` +
      `race_entries: ${result.entriesDeleted} satır silindi.`,
    );

    return Response.json({
      success: !result.error,
      deletedAt: new Date().toISOString(),
      agfDeleted:     result.agfDeleted,
      racesDeleted:   result.racesDeleted,
      entriesDeleted: result.entriesDeleted,
      error: result.error ?? undefined,
    });
  } catch (error) {
    console.error("[API /cleanup] Beklenmeyen hata:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Bilinmeyen hata",
      },
      { status: 500 },
    );
  }
}

