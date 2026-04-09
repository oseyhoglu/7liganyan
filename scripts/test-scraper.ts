/**
 * Test betiği — Scraper servisini izole olarak test eder.
 * Çalıştırmak için: npx tsx scripts/test-scraper.ts
 */
import { discoverCities } from "../src/lib/discovery";
import { scrapeCity } from "../src/lib/scraper";

async function main() {
  console.log("=== Scraper Testi ===\n");

  const cities = await discoverCities();
  if (cities.length === 0) {
    console.log("Bugün yarış yok.");
    return;
  }

  const city = cities[0];
  const today = new Date().toISOString().split("T")[0];
  console.log(`\n🔍 ${city.cityName} sayfası kazınıyor...`);
  console.log(`   URL: ${city.url}\n`);

  const result = await scrapeCity(city.url, city.cityName, today);

  console.log(`\n📋 Koşu sayısı: ${result.races.length}`);
  result.races.forEach((r) =>
    console.log(`  ${r.raceNo}. Koşu ${r.raceTime} — ${r.raceType} · ${r.distance}m ${r.trackSurface}`),
  );

  console.log(`\n🐴 At kaydı: ${result.horses.length}`);
  if (result.horses.length === 0) {
    console.log("❌ Hiç at verisi parse edilemedi!");
  } else {
    const preview = result.horses.slice(0, 10);
    console.table(
      preview.map((h) => ({
        Koşu: h.raceNo,
        "N": h.horseNo,
        At: h.horseName,
        Jokey: h.jockey,
        Kilo: h.weight,
        AGF: h.agfRate,
      })),
    );
    if (result.horses.length > 10) {
      console.log(`  ... ve ${result.horses.length - 10} kayıt daha.`);
    }
  }
}

main();
