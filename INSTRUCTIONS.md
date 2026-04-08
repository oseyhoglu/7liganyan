Proje: 7 Harika (TJK AGF Analiz Platformu)

1. Proje Amacı
Bu projenin amacı, TJK'nın günlük yarış programındaki atların AGF (Altılı Ganyan Favorisi) oranlarını periyodik olarak takip etmek, bu verileri bir veritabanında saklamak ve zaman içindeki değişimleri (trendleri) analiz ederek bir dashboard üzerinde sunmaktır.

2. Teknoloji Yığını
Geliştirme Ortamı: WebStorm + GitHub Copilot.

Backend & API: Next.js (Serverless Functions).

Scraping: Axios & Cheerio.

Veritabanı: Supabase (PostgreSQL).

Otomasyon: cron-job.org üzerinden API tetikleme.

3. Veri Akışı ve İstek Yapısı
Faz 1: Dinamik Şehir ve Yarış Günü Keşfi (Discovery)
Sistem, yarış olan şehirleri ve bu şehirlerin detay linklerini yıllık program uç noktasından çeker.

Discovery API Referansı (cURL):

Bash
curl "https://www.tjk.org/TR/YarisSever/Query/Data/YillikYarisProgramiCoklu?QueryParameter_Tarih_Start=[BUGUN]&QueryParameter_Tarih_End=[BUGUN]&Era=future&X-Requested-With=XMLHttpRequest" \
  -H "accept: */*" \
  -H "referer: https://www.tjk.org/TR/YarisSever/Query/Page/YillikYarisProgramiCoklu" \
  -H "user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36" \
  -H "x-requested-with: XMLHttpRequest"
İşlem: .sorgu-YillikYarisProgramiCoklu-SehirAdi içindeki href linklerini (/TR/YarisSever/Info/Sehir/GunlukYarisProgrami?...) topla ve tam URL'ye dönüştürerek tekilleştir.

Faz 2: Detaylı AGF Veri Kazıma (Scraping)
Keşfedilen şehir linklerinden yarış ve at bazlı veriler ayıklanır.

Scraping API Referansı (cURL):

Bash
curl "https://www.tjk.org/TR/YarisSever/Info/Sehir/GunlukYarisProgrami?SehirId=[ID]&QueryParameter_Tarih=[TARIH]&SehirAdi=[SEHIR]&Era=today" \
  -H "accept: text/html, */*; q=0.01" \
  -H "referer: https://www.tjk.org/TR/YarisSever/Info/Page/GunlukYarisProgrami" \
  -H "user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36" \
  -H "x-requested-with: XMLHttpRequest"
Hedef Veriler:

At İsmi: .gunluk-GunlukYarisProgrami-AtAdi

AGF Oranı: .gunluk-GunlukYarisProgrami-AGFORAN içindeki <a> etiketinin title özniteliğinden Regex ile (%(\d+,\d+)) çekilecek sayısal değer.

Faz 3: Veritabanı (Supabase)
Veriler agf_history tablosuna city, race_no, horse_name, agf_rate ve created_at (timestamptz) sütunlarıyla kaydedilir.

4. Uygulama Adımları (Copilot İçin)
Date Utility: DD/MM/YYYY formatında tarih dönen bir fonksiyon hazırla.

Axios Client: Yukarıdaki cURL komutlarındaki headers bilgilerini varsayılan olarak kullanan bir Axios instance oluştur.

Discovery Service: Yıllık programdan bugünün şehir linklerini unique dizi olarak dönen servisi yaz.

Scraper Service: Şehir linkini alıp içindeki atları ve AGF oranlarını parse eden servisi yaz.

Main Task: Discovery ve Scraper'ı birleştirip sonuçları topluca döndüren ana fonksiyonu yaz.

Supabase Integration: Verileri kaydeden ve son iki kayıt arasındaki farkı analiz eden veritabanı mantığını kur.