-- =============================================
-- 7li Ganyan — Ganyan Etiketi Kolonu
-- =============================================
-- races tablosuna HTML'den direkt okunan ganyan etiket kolonu eklenir.
-- Bu SQL'i Supabase Dashboard > SQL Editor'da çalıştırın.

-- ganyan_label: HTML'de bulunan tam etiket metni
-- Örnekler: "1. 6'LI GANYAN", "2. 6'LI GANYAN", "7'Lİ GANYAN", "6'LI GANYAN"
-- Altılı başlangıcı değilse boş string.
ALTER TABLE races
  ADD COLUMN IF NOT EXISTS ganyan_label TEXT NOT NULL DEFAULT '';

-- Hızlı sorgulama için indeks (boş olmayanlar = altılı başlangıçları)
CREATE INDEX IF NOT EXISTS idx_races_ganyan_label
  ON races (race_date, ganyan_label)
  WHERE ganyan_label <> '';

