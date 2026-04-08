/**
 * Debug betiği 3 — AJAX endpoint'i test et
 */
import tjkClient from "../src/lib/axios-client";

async function main() {
  // Yöntem 1: /Info/Data/GunlukYarisProgrami
  console.log("=== Yöntem 1: /Info/Data/ endpoint ===\n");
  try {
    const { data: html1 } = await tjkClient.get(
      "/TR/YarisSever/Info/Data/GunlukYarisProgrami",
      {
        params: {
          SehirId: 2,
          QueryParameter_Tarih: "09/04/2026",
        },
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          Accept: "*/*",
          Referer: "https://www.tjk.org/TR/YarisSever/Info/Page/GunlukYarisProgrami?QueryParameter_Tarih=09/04/2026&Era=tomorrow",
        },
      },
    );
    console.log(`Yanıt uzunluğu: ${html1.length} karakter`);

    // race-details ara
    const rdIdx = html1.indexOf("race-details");
    console.log(`race-details index: ${rdIdx}`);

    const agfIdx = html1.indexOf("AGFORAN");
    console.log(`AGFORAN index: ${agfIdx}`);

    const atAdiIdx = html1.indexOf("AtAdi");
    console.log(`AtAdi index: ${atAdiIdx}`);

    if (rdIdx > 0) {
      console.log("\n--- race-details çevresi (ilk 2000 char) ---");
      console.log(html1.substring(rdIdx - 200, rdIdx + 2000));
    }

    if (agfIdx > 0) {
      console.log("\n--- AGFORAN çevresi ---");
      console.log(html1.substring(Math.max(0, agfIdx - 500), agfIdx + 500));
    }

    if (atAdiIdx > 0) {
      console.log("\n--- AtAdi çevresi ---");
      console.log(html1.substring(Math.max(0, atAdiIdx - 300), atAdiIdx + 300));
    }

    if (rdIdx === -1 && agfIdx === -1 && atAdiIdx === -1) {
      console.log("\n--- İlk 5000 karakter ---");
      console.log(html1.substring(0, 5000));
    }
  } catch (err: any) {
    console.log("HATA:", err.message);
  }

  // Yöntem 2: /Info/Sehir/GunlukYarisProgrami
  console.log("\n\n=== Yöntem 2: /Info/Sehir/ endpoint ===\n");
  try {
    const { data: html2 } = await tjkClient.get(
      "/TR/YarisSever/Info/Sehir/GunlukYarisProgrami",
      {
        params: {
          SehirId: 2,
          QueryParameter_Tarih: "09/04/2026",
          SehirAdi: "İzmir",
          Era: "tomorrow",
        },
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          Accept: "*/*",
          Referer: "https://www.tjk.org/TR/YarisSever/Info/Page/GunlukYarisProgrami?QueryParameter_Tarih=09/04/2026&Era=tomorrow",
        },
      },
    );
    console.log(`Yanıt uzunluğu: ${html2.length} karakter`);

    const rdIdx = html2.indexOf("race-details");
    console.log(`race-details index: ${rdIdx}`);

    const agfIdx = html2.indexOf("AGFORAN");
    console.log(`AGFORAN index: ${agfIdx}`);

    const atAdiIdx = html2.indexOf("AtAdi");
    console.log(`AtAdi index: ${atAdiIdx}`);

    if (rdIdx > 0) {
      console.log("\n--- race-details ilk blok ---");
      console.log(html2.substring(rdIdx - 100, rdIdx + 2000));
    }

    if (agfIdx > 0) {
      console.log("\n--- AGFORAN çevresi ---");
      console.log(html2.substring(Math.max(0, agfIdx - 500), agfIdx + 500));
    }
  } catch (err: any) {
    console.log("HATA:", err.message);
  }
}

main();

