/**
 * Debug betiği 2 — HTML'in derin yapısını incele
 */
import { discoverCities } from "../src/lib/discovery";
import tjkClient from "../src/lib/axios-client";

async function main() {
  const cities = await discoverCities();
  if (cities.length === 0) return;

  const city = cities[0];
  const { data: html } = await tjkClient.get(city.url);

  // race-no etrafını görelim
  const raceNoIdx = html.indexOf("race-no");
  if (raceNoIdx > 0) {
    const start = Math.max(0, raceNoIdx - 500);
    const end = Math.min(html.length, raceNoIdx + 1500);
    console.log("=== race-no çevresi ===");
    console.log(html.substring(start, end));
  }

  // AJAX URL'leri ara (gunluk veya GunlukYarisProgrami)
  console.log("\n\n=== AJAX URL pattern arama ===");
  const ajaxMatches = html.match(/["']([^"']*GunlukYarisProgrami[^"']*?)["']/g);
  if (ajaxMatches) {
    console.log("GunlukYarisProgrami ile eşleşen URL'ler:");
    [...new Set(ajaxMatches)].forEach((m) => console.log(`  ${m}`));
  }

  const dataUrlMatches = html.match(/["']([^"']*\/Data\/[^"']*?)["']/g);
  if (dataUrlMatches) {
    console.log("\n/Data/ ile eşleşen URL'ler:");
    [...new Set(dataUrlMatches)].forEach((m) => console.log(`  ${m}`));
  }

  // gunluk-panes içeriğini görelim
  const panesIdx = html.indexOf("gunluk-panes");
  if (panesIdx > 0) {
    const start = Math.max(0, panesIdx - 200);
    const end = Math.min(html.length, panesIdx + 3000);
    console.log("\n\n=== gunluk-panes çevresi ===");
    console.log(html.substring(start, end));
  }
}

main();

