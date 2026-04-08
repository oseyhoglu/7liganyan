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
 * Bir şehrin yarış detay sayfasından tüm koşuları ve her koşudaki
 * atların isim + AGF oranı bilgisini parse eder.
 *
 * HTML yapısı:
 *  - Her koşu .race-details bloğu altında başlar
 *  - At satırları .race-details'ten sonra gelen tablo/satırlarda listelenir
 *  - At ismi: .gunluk-GunlukYarisProgrami-AtAdi
 *  - AGF oranı: .gunluk-GunlukYarisProgrami-AGFORAN a[title] → %(\d+,\d+)
 */
export async function scrapeCity(
  cityUrl: string,
  cityName: string,
): Promise<HorseRecord[]> {
  const { data: html } = await tjkClient.get(cityUrl);

  const $ = cheerio.load(html);
  const records: HorseRecord[] = [];

  // Koşu numarası ve saati bilgisi .race-details .race-no a elementinden gelir.
  // Sayfa yapısı: .race-details bloğundan sonra at satırları gelir,
  // bir sonraki .race-details bloğuna kadar tüm atlar o koşuya aittir.

  // Tüm ilgili elementleri DOM sırasına göre topla
  const raceHeaders = $(".race-details");

  raceHeaders.each((_i, headerEl) => {
    // Koşu no ve saat parse et: "2.                        Koşu:20.32"
    const raceText = $(headerEl).find(".race-no a").first().text().trim();
    const raceMatch = raceText.match(/(\d+)\.\s*Koşu[:\s]*(\d+[\.:]\d+)/i);

    const raceNo = raceMatch ? parseInt(raceMatch[1], 10) : 0;
    const raceTime = raceMatch ? raceMatch[2].replace(":", ".") : "";

    if (raceNo === 0) return; // Geçersiz koşu

    // Bu .race-details bloğunun parent container'ından at satırlarını bul.
    // TJK HTML yapısında .race-details ve at tablosu aynı parent altındadır.
    // headerEl'den sonraki kardeş elementlerden atları çekiyoruz.
    const parentContainer = $(headerEl).parent();

    // At isimleri ve AGF oranları
    const horseNameEls = parentContainer.find(
      ".gunluk-GunlukYarisProgrami-AtAdi",
    );
    const agfEls = parentContainer.find(
      ".gunluk-GunlukYarisProgrami-AGFORAN",
    );

    horseNameEls.each((j, nameEl) => {
      const horseName = $(nameEl).text().trim();
      if (!horseName) return;

      // AGF oranını karşılık gelen elementten çek
      const agfEl = agfEls.eq(j);
      let agfRate: number | null = null;

      if (agfEl.length) {
        const agfAnchor = agfEl.find("a");
        const titleAttr = agfAnchor.attr("title") || agfAnchor.text();
        // "%18,50" veya "18,50" gibi formatlardan sayıyı çek
        const agfMatch = titleAttr.match(/%?\s*(\d+[.,]\d+)/);
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

