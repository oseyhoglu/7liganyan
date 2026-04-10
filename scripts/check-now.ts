/**
 * Anlık durum kontrolü — TJK HTML'deki altılı ve AGF durumu
 */
import * as cheerio from "cheerio";
import tjkClient from "../src/lib/axios-client";
import { getTodayFormatted } from "../src/lib/date-utils";

async function main() {
  const today = getTodayFormatted();
  console.log("Tarih:", today);

  const { data: html } = await tjkClient.get(
    "/TR/YarisSever/Info/Data/GunlukYarisProgrami",
    {
      params: { QueryParameter_Tarih: today, Era: "tomorrow" },
      headers: { "X-Requested-With": "XMLHttpRequest", Accept: "*/*" },
    },
  );

  const $ = cheerio.load(html);

  let altiliCount = 0;
  let agfNonNull = 0;
  let agfNull = 0;
  let totalHorses = 0;

  $("div[sehir]").each((_i, containerEl) => {
    const container = $(containerEl);
    const containerId = container.attr("id") || "";
    if (containerId.startsWith("anc")) return;

    const raceDetails = container.find(".race-details");
    if (!raceDetails.length) return;

    const raceText = raceDetails.text().replace(/\s+/g, " ").trim();

    // Altılı tespiti
    const isAltili = /6['\u2018\u2019\u0060]?LI\s+GANYAN\s+Bu\s+ko[şs]udan\s+ba[şs]lar/i.test(raceText);
    if (isAltili) {
      altiliCount++;
      console.log("\n✅ ALTILI bulundu:", raceText.substring(0, 300));
    }

    // GANYAN kelimesi var mı?
    if (raceText.includes("GANYAN") && !isAltili) {
      console.log("\n⚠️  GANYAN var ama regex eşleşmedi:");
      const ganyanIdx = raceText.indexOf("GANYAN");
      console.log("  =>", raceText.substring(Math.max(0, ganyanIdx - 30), ganyanIdx + 80));
    }

    // AGF kontrolü
    container.find("tr").each((_j, rowEl) => {
      const row = $(rowEl);
      if (!row.find(".gunluk-GunlukYarisProgrami-AtAdi").length) return;
      totalHorses++;

      const agfCell = row.find(".gunluk-GunlukYarisProgrami-AGFORAN");
      if (agfCell.length) {
        const agfText =
          agfCell.find("a").attr("title") ||
          agfCell.find("a").text().trim() ||
          agfCell.find("span").text().trim() ||
          agfCell.text().trim();

        const agfMatch = agfText.match(/%?\s*(\d+[.,]\d+)/);
        if (agfMatch) {
          agfNonNull++;
          if (agfNonNull <= 3) {
            console.log(`  AGF örnek: "${agfText}" → ${agfMatch[1]}`);
          }
        } else {
          agfNull++;
        }
      }
    });
  });

  console.log("\n=== ÖZET ===");
  console.log("Altılı koşu sayısı:", altiliCount);
  console.log("Toplam at:", totalHorses);
  console.log("AGF değeri var:", agfNonNull);
  console.log("AGF null/boş:", agfNull);
}

main().catch(console.error);

