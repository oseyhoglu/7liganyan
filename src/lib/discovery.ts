import * as cheerio from "cheerio";
import tjkClient from "./axios-client";
import { getTodayFormatted } from "./date-utils";

export interface CityLink {
  cityName: string;
  sehirId: string;
  url: string;
}

/**
 * Faz 1 — Dinamik Şehir ve Yarış Günü Keşfi
 *
 * TJK günlük yarış programı AJAX endpoint'inden bugünün yarış şehirlerini keşfeder.
 * Sadece yerli hipodromları (SehirId <= 10) döner (yurt dışı yarışları hariç).
 */
export async function discoverCities(): Promise<CityLink[]> {
  const today = getTodayFormatted();

  const { data: html } = await tjkClient.get(
    "/TR/YarisSever/Info/Data/GunlukYarisProgrami",
    {
      params: {
        QueryParameter_Tarih: today,
        Era: "tomorrow",
      },
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        Accept: "*/*",
        Referer:
          "https://www.tjk.org/TR/YarisSever/Info/Page/GunlukYarisProgrami",
      },
    },
  );

  const $ = cheerio.load(html);

  const seen = new Set<string>();
  const cities: CityLink[] = [];

  $("ul.gunluk-tabs li a").each((_i, el) => {
    const href = $(el).attr("href") || "";
    const name = $(el).text().trim().replace(/\s*\(.*\)\s*$/, ""); // "(43. Y.G.)" kısmını kaldır
    const sehirId = $(el).attr("data-sehir-id") || "";

    if (!sehirId || seen.has(sehirId)) return;

    // Sadece yerli hipodromları al (SehirId <= 10 — İstanbul, Ankara, İzmir, Bursa, Adana, Antalya, Elazığ, Şanlıurfa, Diyarbakır, Kocaeli)
    if (parseInt(sehirId, 10) > 10) return;

    seen.add(sehirId);

    const fullUrl = href.startsWith("http")
      ? href
      : `https://www.tjk.org${href.replace(/&amp;/g, "&")}`;

    cities.push({ cityName: name, sehirId, url: fullUrl });
  });

  console.log(
    `[Discovery] Bugün ${cities.length} yerli şehirde yarış var: ${cities.map((c) => c.cityName).join(", ")}`,
  );
  return cities;
}
