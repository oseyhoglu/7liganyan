/**
 * Test betiği — Discovery servisini izole olarak test eder.
 * Çalıştırmak için: npx tsx scripts/test-discovery.ts
 */
import { discoverCities } from "../src/lib/discovery";

async function main() {
  console.log("=== Discovery Testi ===");
  console.log("Bugünün yarış şehirleri aranıyor...\n");

  try {
    const cities = await discoverCities();

    if (cities.length === 0) {
      console.log("❌ Bugün yarış bulunamadı. (TJK takviminde bugün yarış yok olabilir.)");
    } else {
      console.log(`✅ ${cities.length} şehir bulundu:\n`);
      cities.forEach((c, i) => {
        console.log(`  ${i + 1}. ${c.cityName}`);
        console.log(`     URL: ${c.url}\n`);
      });
    }
  } catch (err) {
    console.error("❌ HATA:", err);
  }
}

main();

