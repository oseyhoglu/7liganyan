/**
 * Debug betiği — TJK HTML yapısını incelemek için.
 * Çalıştırmak için: npx tsx scripts/debug-html.ts
 */
import { discoverCities } from "../src/lib/discovery";
import tjkClient from "../src/lib/axios-client";

async function main() {
  const cities = await discoverCities();
  if (cities.length === 0) return;

  const city = cities[0];
  console.log(`Fetching: ${city.url}\n`);

  const { data: html } = await tjkClient.get(city.url);

  // HTML'in ilk bölümünü yazdır (yapıyı anlamak için)
  // race-details arayalım
  const raceIdx = html.indexOf("race-details");
  if (raceIdx === -1) {
    console.log("❌ 'race-details' class'ı bulunamadı!");
    console.log("\n--- İlk 3000 karakter ---");
    console.log(html.substring(0, 3000));
    
    // AGF ile ilgili class'ları arayalım
    const agfIdx = html.indexOf("AGFORAN");
    console.log(`\nAGFORAN index: ${agfIdx}`);
    
    const atAdiIdx = html.indexOf("AtAdi");
    console.log(`AtAdi index: ${atAdiIdx}`);

    const raceNoIdx = html.indexOf("race-no");
    console.log(`race-no index: ${raceNoIdx}`);
    
    // Tüm class isimlerini bulmak için regex
    const classMatches = html.match(/class="[^"]*"/g);
    const uniqueClasses = [...new Set(classMatches)].slice(0, 50);
    console.log("\n--- İlk 50 benzersiz class ---");
    uniqueClasses.forEach((c) => console.log(c));
  } else {
    console.log(`✅ 'race-details' bulundu! (index: ${raceIdx})`);
    // race-details etrafındaki 2000 karakteri yazdır
    const start = Math.max(0, raceIdx - 200);
    const end = Math.min(html.length, raceIdx + 2000);
    console.log("\n--- race-details çevresi ---");
    console.log(html.substring(start, end));
  }
}

main();

