/**
 * Altılı ve AGF ham HTML kontrolü
 */
import * as cheerio from "cheerio";
import tjkClient from "../src/lib/axios-client";
import { discoverCities } from "../src/lib/discovery";

async function main() {
  const cities = await discoverCities();
  if (!cities.length) { console.log("Şehir yok"); return; }

  const city = cities[0];
  console.log("Şehir:", city.cityName, city.url);

  const { data: html } = await tjkClient.get(city.url, {
    headers: { "X-Requested-With": "XMLHttpRequest", Accept: "*/*" },
  });

  const $ = cheerio.load(html);

  $("div[sehir]").each((_i, containerEl) => {
    const container = $(containerEl);
    const id = container.attr("id") || "";
    if (id.startsWith("anc")) return;

    const raceDetails = container.find(".race-details");
    if (!raceDetails.length) return;

    const raceText = raceDetails.text().replace(/\s+/g, " ").trim();

    // Koşu no
    const raceMatch = raceText.match(/(\d+)\.\s*Koşu/i);
    const raceNo = raceMatch ? raceMatch[1] : "?";

    // Altılı kontrolü
    const hasGanyan = raceText.includes("GANYAN") || raceText.includes("ganyan");
    const isAltili = /6['\u2018\u2019\u0060]?LI\s+GANYAN\s+Bu\s+ko[şs]udan\s+ba[şs]lar/i.test(raceText);

    if (hasGanyan) {
      const ganyanIdx = raceText.indexOf("GANYAN");
      console.log(`\n[Koşu ${raceNo}] GANYAN bulundu, regex=${isAltili}`);
      console.log("  Çevre:", JSON.stringify(raceText.substring(Math.max(0,ganyanIdx-50), ganyanIdx+100)));
    }

    // AGF ham HTML
    const firstHorse = container.find("tr").filter((_j, rowEl) =>
      $(rowEl).find(".gunluk-GunlukYarisProgrami-AtAdi").length > 0
    ).first();

    if (firstHorse.length && raceNo === "1") {
      const agfCell = firstHorse.find(".gunluk-GunlukYarisProgrami-AGFORAN");
      console.log(`\n[Koşu ${raceNo}] AGF cell HTML:`, agfCell.html()?.substring(0, 200));
      const agfText = agfCell.find("a").attr("title") || agfCell.find("a").text() || agfCell.text();
      console.log(`  AGF text: "${agfText.trim()}"`);
    }
  });
}

main().catch(console.error);

