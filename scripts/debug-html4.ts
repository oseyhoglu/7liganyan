/**
 * Debug betiği 4 — Sehir endpoint'indeki veri yapısını detaylı incele
 */
import * as cheerio from "cheerio";
import tjkClient from "../src/lib/axios-client";

async function main() {
  const { data: html } = await tjkClient.get(
    "/TR/YarisSever/Info/Sehir/GunlukYarisProgrami",
    {
      params: {
        SehirId: 2,
        QueryParameter_Tarih: "09/04/2026",
        SehirAdi: "İzmir",
        Era: "tomorrow",
      },
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        Accept: "*/*",
        Referer: "https://www.tjk.org/TR/YarisSever/Info/Page/GunlukYarisProgrami",
      },
    },
  );

  const $ = cheerio.load(html);

  // Koşu header'larını bul
  const raceHeaders = $(".race-details");
  console.log(`Toplam koşu sayısı: ${raceHeaders.length}\n`);

  raceHeaders.each((i, el) => {
    const raceText = $(el).find(".race-no a").first().text().trim();
    const raceMatch = raceText.match(/(\d+)\.\s*Koşu[:\s]*(\d+[\.:]\d+)/i);
    const raceNo = raceMatch ? raceMatch[1] : "?";
    const raceTime = raceMatch ? raceMatch[2] : "?";
    console.log(`Koşu ${raceNo} - Saat: ${raceTime}`);
  });

  // Koşu/at yapısını anla
  // Her koşu bir parent div altında mı?
  console.log("\n=== İlk koşunun yapısı ===");
  const firstRaceDetails = raceHeaders.first();
  const parentDiv = firstRaceDetails.parent();
  console.log(`Parent tag: <${parentDiv.prop("tagName")}>`);
  console.log(`Parent id: ${parentDiv.attr("id")}`);

  // Parent'ın altındaki at tablolarını bul
  const atAdis = parentDiv.find(".gunluk-GunlukYarisProgrami-AtAdi");
  console.log(`Parent altındaki AtAdi sayısı: ${atAdis.length}`);

  // İlk birkaç at
  atAdis.slice(0, 3).each((i, el) => {
    console.log(`  At ${i + 1}: "${$(el).text().trim()}"`);
  });

  // AGF oranları
  const agfs = parentDiv.find(".gunluk-GunlukYarisProgrami-AGFORAN");
  console.log(`\nParent altındaki AGF sayısı: ${agfs.length}`);
  agfs.slice(0, 5).each((i, el) => {
    const text = $(el).text().trim();
    const aTitle = $(el).find("a").attr("title") || "";
    const aText = $(el).find("a").text().trim();
    console.log(`  AGF ${i + 1}: text="${text}" | a.title="${aTitle}" | a.text="${aText}"`);
  });

  // Koşuları id'lere göre ayıralım
  // Üst div'lerin id'si var mı?
  console.log("\n=== Koşu div ID'leri ===");
  raceHeaders.each((i, el) => {
    const container = $(el).parent();
    console.log(`  Koşu ${i + 1}: parent id="${container.attr("id")}", tag=<${container.prop("tagName")}>`);
  });

  // Soru: aynı parent altında birden fazla koşu mu var yoksa her koşu ayrı container mı?
  console.log("\n=== Tüm üst seviye div id'leri ===");
  const topDivs = $("[id][sehir]");
  topDivs.each((i, el) => {
    const id = $(el).attr("id");
    const sehir = $(el).attr("sehir");
    const raceCount = $(el).find(".race-details").length;
    const atCount = $(el).find(".gunluk-GunlukYarisProgrami-AtAdi").length;
    console.log(`  div#${id} sehir="${sehir}" - ${raceCount} koşu, ${atCount} at`);
  });
}

main();

