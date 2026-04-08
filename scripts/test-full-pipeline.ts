/**
 * Test betiği — Tam pipeline testi (Discovery → Scraper → Supabase)
 * Çalıştırmak için: npx tsx scripts/test-full-pipeline.ts
 */
import { runScrapeTask } from "../src/lib/main-task";

async function main() {
  console.log("=== Tam Pipeline Testi ===\n");
  console.log("Discovery → Scraper → Supabase insert\n");

  try {
    const result = await runScrapeTask();

    console.log("\n=== Sonuç ===");
    console.log(`  Şehir sayısı: ${result.cities}`);
    console.log(`  Toplam kayıt: ${result.records}`);
    console.log(`  DB'ye eklenen: ${result.inserted}`);
    console.log(`  Hata: ${result.error || "Yok"}`);
  } catch (err) {
    console.error("HATA:", err);
  }
}

main();

