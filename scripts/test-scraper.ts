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

  // İlk şehri test et
  const city = cities[0];
  console.log(`\n🔍 ${city.cityName} sayfası kazınıyor...`);
  console.log(`   URL: ${city.url}\n`);

  const records = await scrapeCity(city.url, city.cityName);

  if (records.length === 0) {
    console.log("❌ Hiç at verisi parse edilemedi! HTML yapısı kontrol edilmeli.");
  } else {
    console.log(`✅ ${records.length} at kaydı bulundu:\n`);

    // İlk 10 kaydı göster
    const preview = records.slice(0, 10);
    console.table(
      preview.map((r) => ({
        Şehir: r.city,
        "Koşu No": r.raceNo,
        Saat: r.raceTime,
        At: r.horseName,
        AGF: r.agfRate,
      })),
    );

    if (records.length > 10) {
      console.log(`  ... ve ${records.length - 10} kayıt daha.`);
    }
  }
}

main();

