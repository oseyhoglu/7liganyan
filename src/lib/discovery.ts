import * as cheerio from "cheerio";
import tjkClient from "./axios-client";
import { getTodayFormatted } from "./date-utils";

export interface CityLink {
  cityName: string;
  url: string;
}

/**
 * Faz 1 — Dinamik Şehir ve Yarış Günü Keşfi
 *
 * TJK yıllık program endpoint'inden bugünün yarış şehirlerini keşfeder.
 * Her şehrin detay linkini tam URL olarak döner.
 */
export async function discoverCities(): Promise<CityLink[]> {
  const today = getTodayFormatted();

  const { data: html } = await tjkClient.get(
    "/TR/YarisSever/Query/Data/YillikYarisProgramiCoklu",
    {
      params: {
        "QueryParameter_Tarih_Start": today,
        "QueryParameter_Tarih_End": today,
        Era: "future",
        "X-Requested-With": "XMLHttpRequest",
      },
      headers: {
        Accept: "*/*",
        Referer:
          "https://www.tjk.org/TR/YarisSever/Query/Page/YillikYarisProgramiCoklu",
      },
    },
  );

  const $ = cheerio.load(html);

  const seen = new Set<string>();
  const cities: CityLink[] = [];

  $(".sorgu-YillikYarisProgramiCoklu-SehirAdi a").each((_i, el) => {
    const href = $(el).attr("href");
    const name = $(el).text().trim();

    if (!href || seen.has(href)) return;
    seen.add(href);

    const fullUrl = href.startsWith("http")
      ? href
      : `https://www.tjk.org${href}`;

    cities.push({ cityName: name, url: fullUrl });
  });

  console.log(`[Discovery] Bugün ${cities.length} şehirde yarış var: ${cities.map((c) => c.cityName).join(", ")}`);
  return cities;
}

