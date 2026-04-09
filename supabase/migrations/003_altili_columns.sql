-- =============================================
-- 7li Ganyan — Altılı Başlangıç Kolonları
-- =============================================
-- races tablosuna altılı ganyan metadata kolonları eklenir.
-- Bu SQL'i Supabase Dashboard > SQL Editor'da çalıştırın.

-- is_altili_start: Bu koşu bir altılı ganyanın başlangıç koşusu mu?
ALTER TABLE races
  ADD COLUMN IF NOT EXISTS is_altili_start BOOLEAN NOT NULL DEFAULT FALSE;

-- altili_index: Aynı hipodromda kaçıncı altılı?
-- 0 = altılı başlangıcı değil, 1 = 1. Altılı, 2 = 2. Altılı, ...
ALTER TABLE races
  ADD COLUMN IF NOT EXISTS altili_index SMALLINT NOT NULL DEFAULT 0;

-- Altılı zamanlaması sorguları için partial index (sadece başlangıç koşuları)
CREATE INDEX IF NOT EXISTS idx_races_altili_start
  ON races (race_date, is_altili_start)
  WHERE is_altili_start = TRUE;

