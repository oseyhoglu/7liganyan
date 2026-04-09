import * as cheerio from "cheerio";
import tjkClient from "./axios-client";

export interface HorseRecord {
  city: string;
  raceNo: number;
  raceTime: string;
  horseName: string;
  agfRate: number | null;
}

/**
 * Faz 2 — Detaylı AGF Veri Kazıma
 *
 * Bir şehrin yarış verilerini /Info/Sehir/GunlukYarisProgrami AJAX endpoint'inden çeker.
 *
 * HTML yapısı:
 *  - Her koşu ayrı bir div[id][sehir] container'ı altında
 *  - Her container 1 adet .race-details + at tablosu içerir
 *  - Koşu no/saat: .race-details .race-no a text → "1. Koşu:15.00"
 *  - At ismi: .gunluk-GunlukYarisProgrami-AtAdi içindeki ilk text node
 *  - AGF oranı: .gunluk-GunlukYarisProgrami-AGFORAN span veya a
 */
export async function scrapeCity(
  cityUrl: string,
  cityName: string,
): Promise<HorseRecord[]> {
  // /Info/Sehir/ AJAX endpoint'ini çağır
  const { data: html } = await tjkClient.get(cityUrl, {
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      Accept: "*/*",
      Referer:
        "https://www.tjk.org/TR/YarisSever/Info/Page/GunlukYarisProgrami",
    },
  });

  const $ = cheerio.load(html);
  const records: HorseRecord[] = [];

  // Her koşu ayrı bir div[id][sehir] container'ında
  // (id numerik, sehir attribute'u var olanlar asıl koşu div'leri)
  $('div[sehir]').each((_i, containerEl) => {
    const container = $(containerEl);
    const containerId = container.attr("id") || "";

    // "anc" ile başlayan anchor div'lerini atla — asıl koşu div'leri numerik id taşır
    if (containerId.startsWith("anc")) return;

    // Koşu bilgisi
    const raceDetails = container.find(".race-details");
    if (raceDetails.length === 0) return;

    const raceText = raceDetails.find(".race-no a").first().text().trim();
    const raceMatch = raceText.match(/(\d+)\.\s*Koşu[:\s]*(\d+[\.:]\d+)/i);

    const raceNo = raceMatch ? parseInt(raceMatch[1], 10) : 0;
    const raceTime = raceMatch ? raceMatch[2].replace(":", ".") : "";

    if (raceNo === 0) return;

    // At satırları — her tr içinde AtAdi ve AGFORAN hücreleri var
    const rows = container.find("tr");
    rows.each((_j, rowEl) => {
      const row = $(rowEl);
      const atAdiCell = row.find(".gunluk-GunlukYarisProgrami-AtAdi");
      const agfCell = row.find(".gunluk-GunlukYarisProgrami-AGFORAN");

      if (atAdiCell.length === 0) return;

      // At ismini çek — sadece ilk kısmı al (çerçeve/donanım bilgilerinden ayır)
      // AtAdi hücresinin yapısı: at ismi + alt satırlarda ekipman bilgileri
      // İlk satırdaki text'i almak için clone edip child'ları kaldır
      const horseName = extractHorseName(atAdiCell.text());
      if (!horseName) return;

      // AGF oranını çek
      let agfRate: number | null = null;
      if (agfCell.length) {
        const agfText = agfCell.find("a").attr("title")
          || agfCell.find("a").text().trim()
          || agfCell.find("span").text().trim()
          || agfCell.text().trim();

        // "%18,50" veya "18,50" veya "18.50" formatlarından sayıyı çek
        const agfMatch = agfText.match(/%?\s*(\d+[.,]\d+)/);
        if (agfMatch) {
          agfRate = parseFloat(agfMatch[1].replace(",", "."));
        }
      }

      records.push({
        city: cityName,
        raceNo,
        raceTime,
        horseName,
        agfRate,
      });
    });
  });

  console.log(
    `[Scraper] ${cityName}: ${records.length} at kaydı çekildi.`,
  );
  return records;
}

/**
 * AtAdi hücresinden temiz at ismini çıkarır.
 * HTML yapısı: at ismi + fiyat bilgisi + ekipman açıklamaları karışık gelir.
 * Stratejimiz: İlk temiz satırı al, fiyat/ekipman bilgilerini temizle.
 */
function extractHorseName(cellText: string): string {
  const fullText = cellText;

  // Satırlara böl, boşlukları temizle, boş olanları at
  const lines = fullText.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return "";

  // İlk satır at ismi — ama bazen fiyat bilgisi de ilk satırda gelir
  // "t1.000.000,00 TL..." şeklindeki fiyat satırlarını atla
  let name = "";
  for (const line of lines) {
    // Fiyat satırı değilse ve çok kısa değilse kullan
    if (!/^t[\d.,]+\s*TL/i.test(line) && line.length >= 2) {
      name = line;
      break;
    }
  }

  if (!name) return "";

  // Satır içinde fiyat bilgisi varsa o noktadan kes: "KAANER t1.000.000,00 TL..."
  name = name.replace(/\s+t[\d.,]+\s*TL.*/i, "").trim();

  // Ekipman kısaltma açıklamalarını temizle
  name = name.replace(/\s*(ifade|takılacağını|bağlanacağını|geleceğini).*/gi, "").trim();

  // Sonunda sadece büyük harf kısaltmalar kalırsa temizle (SK, KG, DB, GKR, KKR...)
  name = name.replace(/\s+[A-ZÇĞİÖŞÜ]{2,3}(?:\s+[A-ZÇĞİÖŞÜ]{2,3})*\s*$/, "").trim();

  return name;
}
