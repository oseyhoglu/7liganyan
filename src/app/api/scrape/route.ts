import { NextRequest } from "next/server";
import { runScrapeTask } from "@/lib/main-task";

/**
 * POST /api/scrape
 *
 * cron-job.org tarafından her 5 dakikada bir tetiklenir.
 * Authorization header'ındaki Bearer token ile doğrulama yapılır.
 */
export async function POST(request: NextRequest) {
  // CRON_SECRET doğrulaması
  const authHeader = request.headers.get("authorization");
  const expectedToken = `Bearer ${process.env.CRON_SECRET}`;

  if (!authHeader || authHeader !== expectedToken) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runScrapeTask();

    return Response.json({
      success: !result.error,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[API /scrape] Beklenmeyen hata:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Bilinmeyen hata",
      },
      { status: 500 },
    );
  }
}

/** GET — sağlık kontrolü */
export async function GET() {
  return Response.json({
    status: "ok",
    endpoint: "/api/scrape",
    method: "POST ile tetikleyin",
  });
}

