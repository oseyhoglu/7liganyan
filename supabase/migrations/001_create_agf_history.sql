-- =============================================
-- 7li Ganyan — Supabase Veritabanı Kurulumu
-- =============================================
-- Bu SQL'i Supabase Dashboard > SQL Editor'da çalıştırın.

-- 1. agf_history tablosu
CREATE TABLE IF NOT EXISTS agf_history (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  city        TEXT NOT NULL,
  race_no     SMALLINT NOT NULL,
  race_time   TEXT NOT NULL DEFAULT '',
  horse_name  TEXT NOT NULL,
  agf_rate    NUMERIC(5,2),
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Trend sorguları için composite index
CREATE INDEX IF NOT EXISTS idx_agf_city_race_horse_snapshot
  ON agf_history (city, race_no, horse_name, snapshot_at);

-- 3. Snapshot bazlı sorgular için index
CREATE INDEX IF NOT EXISTS idx_agf_snapshot_at
  ON agf_history (snapshot_at);

-- 4. RLS (Row Level Security) — API key ile insert/select izni
ALTER TABLE agf_history ENABLE ROW LEVEL SECURITY;

-- Herkese okuma izni (anon key ile dashboard verisi çekebilsin)
CREATE POLICY "Allow public read" ON agf_history
  FOR SELECT
  USING (true);

-- Anon key ile insert izni (cron scraper yazabilsin)
CREATE POLICY "Allow anon insert" ON agf_history
  FOR INSERT
  WITH CHECK (true);

