/**
 * TJK race-details tam HTML ve altılı arama
 */
import * as cheerio from "cheerio";
import tjkClient from "../src/lib/axios-client";
import { discoverCities } from "../src/lib/discovery";

async function main() {
  const cities = await discoverCities();
  if (!cities.length) { console.log("Şehir yok"); return; }

  const city = cities[0];
  console.log("Şehir:", city.cityName, "\nURL:", city.url, "\n");

  const { data: html } = await tjkClient.get(city.url, {
    headers: { "X-Requested-With": "XMLHttpRequest", Accept: "*/*" },
  });

  const $ = cheerio.load(html);
  let raceIndex = 0;

  $("div[sehir]").each((_i, containerEl) => {
    const container = $(containerEl);
    if ((container.attr("id") || "").startsWith("anc")) return;

    const raceDetails = container.find(".race-details");
    if (!raceDetails.length) return;

    raceIndex++;
    const raceText = raceDetails.text().replace(/\s+/g, " ").trim();
    const raceHtml = raceDetails.html()?.replace(/\s+/g, " ") || "";

    // GANYAN kelimesi var mı (herhangi bir biçimde)
    const hasGanyan = /ganyan/i.test(raceText) || /ganyan/i.test(raceHtml);
    // 6 ile başlayan özel metin
    const has6li = /6[^a-z0-9]/i.test(raceText);

    if (raceIndex <= 3 || hasGanyan || has6li) {
      console.log(`\n══ Koşu #${raceIndex} ══`);
      console.log("Metin:", raceText.substring(0, 400));
      if (hasGanyan || has6li) {
        console.log(">>> GANYAN/6'lı işareti mevcut!");
        // Tüm inner span ve div class'larını göster
        raceDetails.find("[class]").each((_j, el) => {
          const cls = $(el).attr("class") || "";
          const txt = $(el).text().replace(/\s+/g, " ").trim();
          if (txt) console.log(`  .${cls}: "${txt.substring(0, 100)}"`);
        });
      }
    }
  });

  console.log("\nToplam koşu:", raceIndex);
}

main().catch(console.error);

