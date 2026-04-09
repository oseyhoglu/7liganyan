import { NextRequest } from "next/server";
import { getRacesWithEntries } from "@/lib/supabase";

/**
 * GET /api/races?date=YYYY-MM-DD
 *
 * Belirtilen tarihin (varsayılan: bugün) tüm koşu ve at
 * bilgilerini döner. Frontend koşu kartları bu endpoint'i kullanır.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Tarih parametresi — yoksa bugün
  const today = new Date().toISOString().split("T")[0];
  const dateParam = searchParams.get("date") ?? today;

  // Basit format doğrulama
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return Response.json(
      { error: "Geçersiz tarih formatı. Beklenen: YYYY-MM-DD" },
      { status: 400 },
    );
  }

  try {
    const result = await getRacesWithEntries(dateParam);

    return Response.json({
      date: dateParam,
      raceCount: result.races.length,
      entryCount: result.entries.length,
      races: result.races,
      entries: result.entries,
      error: result.error,
    });
  } catch (error) {
    console.error("[API /races] Hata:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Bilinmeyen hata" },
      { status: 500 },
    );
  }
}

