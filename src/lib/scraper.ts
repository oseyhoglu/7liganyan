import * as cheerio from "cheerio";
import tjkClient from "./axios-client";

// ─────────────────────────────────────────────────
//  Tipler
// ─────────────────────────────────────────────────

export interface RaceRecord {
  city: string;
  raceNo: number;
  raceDate: string;     // "YYYY-MM-DD"
  raceTime: string;     // "15.00"
  raceType: string;     // "SATIŞ 1", "ŞARTLI 4/DİÖW" vb.
  horseCategory: string;
  distance: number | null;
  trackSurface: string; // "Kum" | "Çim"
  eid: string;
  rawConditions: string;
  isAltiliStart: boolean;  // Herhangi bir ganyan başlangıcı mı (ganyanLabel boş değilse true)
  altiliIndex: number;     // 0 = başlangıç değil; HTML etiketindeki sayıdan türetilir (1, 2...)
  ganyanLabel: string;     // HTML'den okunan tam etiket: "1. 6'LI GANYAN", "7'Lİ GANYAN" vb.
}

export interface HorseRecord {
  city: string;
  raceNo: number;
  raceDate: string;
  raceTime: string;
  horseNo: number | null;
  horseName: string;
  age: string;
  origin: string;        // "BABA - ANNE"
  weight: number | null; // Siklet
  jockey: string;
  jockeyRank: string;    // "A1", "APApranti" vb.
  owner: string;
  trainer: string;
  startNo: string;
  hp: number | null;
  last6Races: string;
  kgs: number | null;
  s20: number | null;
  bestTime: string;
  gny: string;
  agf1Rate: number | null;  // 1. altılı AGF (veya şehirde tek altılı varsa tek oran)
  agf2Rate: number | null;  // 2. altılı AGF (birden fazla altılı olduğunda dolduruluyor)
  idmFlag: boolean;
}

export interface ScrapeResult {
  races: RaceRecord[];
  horses: HorseRecord[];
}

// ─────────────────────────────────────────────────
//  Ana fonksiyon
// ─────────────────────────────────────────────────

/**
 * Faz 2 — Tam Veri Kazıma
 *
 * Selector referansı (debug-fields.ts ile doğrulandı):
 *   SiraId, AtAdi, Yas, Baba, Kilo, JokeAdi, SahipAdi,
 *   AntronorAdi, StartId, Hc, Son6Yaris, KGS, s20,
 *   DERECE, Gny, AGFORAN, idmanpistiFLG
 */
export async function scrapeCity(
  cityUrl: string,
  cityName: string,
  raceDate: string,
): Promise<ScrapeResult> {
  const { data: html } = await tjkClient.get(cityUrl, {
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      Accept: "*/*",
      Referer:
        "https://www.tjk.org/TR/YarisSever/Info/Page/GunlukYarisProgrami",
    },
  });

  const $ = cheerio.load(html);
  const races: RaceRecord[] = [];
  const horses: HorseRecord[] = [];

  $("div[sehir]").each((_i, containerEl) => {
    const container = $(containerEl);
    const containerId = container.attr("id") || "";
    if (containerId.startsWith("anc")) return;

    const raceDetails = container.find(".race-details");
    if (raceDetails.length === 0) return;

    // ── Koşu No ve Saat ──────────────────────────────────
    const raceText = raceDetails.find(".race-no a").first().text().trim();
    const raceMatch = raceText.match(/(\d+)\.\s*Koşu[:\s]*(\d+[\.:]\d+)/i);
    if (!raceMatch) return;

    const raceNo = parseInt(raceMatch[1], 10);
    const raceTime = raceMatch[2].replace(":", ".");

    // ── Koşul Bilgileri ──────────────────────────────────
    const raceConfig = raceDetails.find(".race-config");
    const rawConditions = raceConfig.text().replace(/\s+/g, " ").trim();
    const raceType = raceConfig.find(".aciklamaFancy").first().text().trim();

    // Mesafe + Pist
    const distMatch = rawConditions.match(/\b(\d{3,4})\b\s*(Kum|Çim|çim|kum)?/i);
    const distance = distMatch ? parseInt(distMatch[1], 10) : null;
    const trackSurface = distMatch?.[2]
      ? distMatch[2].charAt(0).toUpperCase() + distMatch[2].slice(1).toLowerCase()
      : "";

    // At kategorisi — raceType'tan sonraki ilk virgülden önceki metin
    const condAfterType = rawConditions.replace(raceType, "").replace(/^[\s,]+/, "").trim();
    const catMatch = condAfterType.match(/^([^,\d]+)/);
    const horseCategory = catMatch ? catMatch[1].trim().replace(/,$/, "") : "";

    // E.İ.D.
    const eidEl = raceConfig.find("a[href*='GunlukYarisSonuclari']");
    const eid = eidEl.length
      ? eidEl.text().replace(/E\.─░\.D\.|E\.İ\.D\.|EİD|:\s*/gi, "").trim()
      : "";

    // Ganyan etiketi tespiti — .bahisTipiCard h4 başlıklarında ara
    // Yakalanacak örüntüler:
    //   "1. 6'LI GANYAN Bu koşudan başlar"
    //   "2. 6'LI GANYAN Bu koşudan başlar"
    //   "7'Lİ GANYAN Bu koşudan başlar"
    //   "6'LI GANYAN Bu koşudan başlar"
    const GANYAN_RE =
      /(\d+\.\s*)?([67]['\u2018\u2019\u0060\u2032]?L[İI]\s+GANYAN)\s+Bu\s+ko[şs]udan\s+ba[şs]lar/i;

    let ganyanLabel = "";
    container.find(".bahisTipiCard h4").each((_k, h4El) => {
      if (ganyanLabel) return; // zaten bulundu
      const h4Text = $(h4El).text().trim();
      const m = GANYAN_RE.exec(h4Text);
      if (m) ganyanLabel = ((m[1] ?? "") + m[2]).trim();
    });
    const isAltiliStart = ganyanLabel !== "";

    races.push({ city: cityName, raceNo, raceDate, raceTime, raceType, horseCategory, distance, trackSurface, eid, rawConditions, isAltiliStart, altiliIndex: 0, ganyanLabel });

    // ── At Satırları ─────────────────────────────────────
    container.find("tr").each((_j, rowEl) => {
      const row = $(rowEl);
      if (row.find(".gunluk-GunlukYarisProgrami-AtAdi").length === 0) return;

      const horseName = extractHorseName(
        row.find(".gunluk-GunlukYarisProgrami-AtAdi").text(),
      );
      if (!horseName) return;

      const siraText = row.find(".gunluk-GunlukYarisProgrami-SiraId").text().trim();
      const horseNo = siraText ? parseInt(siraText, 10) : null;

      const age = row.find(".gunluk-GunlukYarisProgrami-Yas").text().trim();

      const origin = row
        .find(".gunluk-GunlukYarisProgrami-Baba")
        .text()
        .replace(/\s+/g, " ")
        .trim();

      const kiloText = row
        .find(".gunluk-GunlukYarisProgrami-Kilo")
        .text()
        .trim()
        .replace(",", ".");
      const weight = kiloText ? parseFloat(kiloText) : null;

      // Jokey — isim ve rütbe ayrı satırlarda gelir
      const jokeLines = row
        .find(".gunluk-GunlukYarisProgrami-JokeAdi")
        .text()
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const jockey = jokeLines[0] || "";
      const jockeyRank = jokeLines.slice(1).join(" ").trim();

      const owner = row.find(".gunluk-GunlukYarisProgrami-SahipAdi").text().trim();
      // TJK HTML'de "AntronorAdi" (typo) — aynen kullanılır
      const trainer = row.find(".gunluk-GunlukYarisProgrami-AntronorAdi").text().trim();

      // StartId — direkt text node (üst yazılar/sup hariç)
      const startCell = row.find(".gunluk-GunlukYarisProgrami-StartId");
      const startBase = startCell.clone().children().remove().end().text().trim();
      const startSup = startCell.find("sup.tooltipp .aciklamaFancy").text().trim();
      const startNo = startBase + (startSup ? startSup : "");

      const hcText = row.find(".gunluk-GunlukYarisProgrami-Hc").text().trim();
      const hp = hcText ? parseInt(hcText, 10) : null;

      const last6Races = row
        .find(".gunluk-GunlukYarisProgrami-Son6Yaris")
        .text()
        .replace(/\s+/g, "")
        .trim();

      const kgsText = row.find(".gunluk-GunlukYarisProgrami-KGS").text().trim();
      const kgs = kgsText ? parseInt(kgsText, 10) : null;

      const s20Text = row.find(".gunluk-GunlukYarisProgrami-s20").text().trim();
      const s20 = s20Text ? parseInt(s20Text, 10) : null;

      const bestTime = row
        .find(".gunluk-GunlukYarisProgrami-DERECE")
        .text()
        .replace(/\s+/g, " ")
        .trim();

      const gny = row
        .find(".gunluk-GunlukYarisProgrami-Gny")
        .text()
        .replace(/\s+/g, " ")
        .trim();

      // AGF Oranı — birden fazla altılı olduğunda hücrede çoklu <a> olabilir
      // title="1. 6'LI GANYAN : %8,87(5)"  →  agf1Rate
      // title="2. 6'LI GANYAN : %9,65(4)"  →  agf2Rate
      let agf1Rate: number | null = null;
      let agf2Rate: number | null = null;
      const agfCell = row.find(".gunluk-GunlukYarisProgrami-AGFORAN");
      if (agfCell.length) {
        const anchors = agfCell.find("a");
        if (anchors.length <= 1) {
          // Tek oran — title'dan yoksa metinden al
          const src =
            anchors.first().attr("title") ||
            anchors.first().text().trim() ||
            agfCell.find("span").text().trim() ||
            agfCell.text().trim();
          const m = src.match(/(\d+[.,]\d+)/);
          if (m) agf1Rate = parseFloat(m[1].replace(",", "."));
        } else {
          // Çoklu oran — title içeriğine göre ayırt et
          anchors.each((_k, aEl) => {
            const title = $(aEl).attr("title") || "";
            const m = title.match(/(\d+[.,]\d+)/);
            const rate = m ? parseFloat(m[1].replace(",", ".")) : null;
            if (/2\.\s*[67]['\u2018\u2019\u0060\u2032]?L[İI]\s+GANYAN/i.test(title)) {
              agf2Rate = rate;
            } else if (agf1Rate === null) {
              agf1Rate = rate;
            }
          });
        }
      }

      // İdman Flag
      const idmCell = row.find(".gunluk-GunlukYarisProgrami-idmanpistiFLG");
      const idmFlag = idmCell.length > 0 && idmCell.text().trim().length > 0;

      horses.push({
        city: cityName,
        raceNo,
        raceDate,
        raceTime,
        horseNo,
        horseName,
        age,
        origin,
        weight,
        jockey,
        jockeyRank,
        owner,
        trainer,
        startNo,
        hp,
        last6Races,
        kgs,
        s20,
        bestTime,
        gny,
        agf1Rate,
        agf2Rate,
        idmFlag,
      });
    });
  });

  console.log(
    `[Scraper] ${cityName}: ${races.length} koşu, ${horses.length} at kaydı çekildi.`,
  );

  // Altılı ganyan index ataması — tamamen sıralı (koşu sırasına göre 1, 2, 3...)
  // ganyanLabel zaten "1. 6'LI GANYAN", "7'Lİ GANYAN", "2. 6'LI GANYAN" gibi
  // okunabilir etiketi tutuyor; altiliIndex sadece sıralama/bloklama içindir.
  let altiliCounter = 0;
  for (const race of races) {
    if (!race.isAltiliStart) continue;
    altiliCounter++;
    race.altiliIndex = altiliCounter;
  }

  const ganyanStarts = races.filter((r) => r.isAltiliStart);
  if (ganyanStarts.length > 0) {
    const labels = ganyanStarts.map((r) => `${r.raceNo}.Koşu → "${r.ganyanLabel}"`).join(", ");
    console.log(`[Scraper] ${cityName}: ${ganyanStarts.length} ganyan başlangıcı → ${labels}`);
  }

  return { races, horses };
}

// ─────────────────────────────────────────────────
//  Yardımcı
// ─────────────────────────────────────────────────

function extractHorseName(cellText: string): string {
  const lines = cellText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return "";

  let name = "";
  for (const line of lines) {
    if (!/^t[\d.,]+\s*TL/i.test(line) && line.length >= 2) {
      name = line;
      break;
    }
  }
  if (!name) return "";

  name = name.replace(/\s+t[\d.,]+\s*TL.*/i, "").trim();
  name = name.replace(/\s*(ifade|takılacağını|bağlanacağını|geleceğini).*/gi, "").trim();

  return name;
}
