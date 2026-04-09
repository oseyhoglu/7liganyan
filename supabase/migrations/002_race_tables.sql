-- =============================================
-- 7li Ganyan — Koşu ve At Kayıt Tabloları
-- =============================================
-- Bu SQL'i Supabase Dashboard > SQL Editor'da çalıştırın.

-- 1. races — Koşu düzeyinde statik bilgiler (günde 1 kez yazılır)
CREATE TABLE IF NOT EXISTS races (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  city             TEXT NOT NULL,
  race_no          SMALLINT NOT NULL,
  race_date        DATE NOT NULL,
  race_time        TEXT NOT NULL DEFAULT '',
  race_type        TEXT NOT NULL DEFAULT '',     -- ör. "SATIŞ 1", "ŞARTLI 4/DİÖW", "MAIDEN"
  horse_category   TEXT NOT NULL DEFAULT '',     -- ör. "4 ve Yukarı İngilizler"
  distance         INTEGER,                      -- metre cinsinden ör. 1900
  track_surface    TEXT NOT NULL DEFAULT '',     -- "Kum" veya "Çim"
  eid              TEXT NOT NULL DEFAULT '',     -- En İyi Derece ör. "1.58.31"
  raw_conditions   TEXT NOT NULL DEFAULT '',     -- Ham koşul metni (tam)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (city, race_no, race_date)
);

-- 2. race_entries — At düzeyinde statik bilgiler (günde 1 kez yazılır, UPSERT)
CREATE TABLE IF NOT EXISTS race_entries (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  city             TEXT NOT NULL,
  race_no          SMALLINT NOT NULL,
  race_date        DATE NOT NULL,
  horse_no         SMALLINT,                     -- Program sıra no (N)
  horse_name       TEXT NOT NULL,
  age              TEXT NOT NULL DEFAULT '',     -- ör. "5y a a"
  origin           TEXT NOT NULL DEFAULT '',     -- Baba - Anne (birleşik)
  weight           NUMERIC(5,2),                 -- Siklet ör. 59.50
  jockey           TEXT NOT NULL DEFAULT '',
  jockey_rank      TEXT NOT NULL DEFAULT '',     -- ör. "A1", "APApranti"
  owner            TEXT NOT NULL DEFAULT '',
  trainer          TEXT NOT NULL DEFAULT '',
  start_no         TEXT NOT NULL DEFAULT '',     -- St (DS, FS gibi ekler olabilir)
  hp               SMALLINT,                     -- Handikap puanı
  last_6_races     TEXT NOT NULL DEFAULT '',     -- Son 6 Y. ör. "756842"
  kgs              SMALLINT,
  s20              SMALLINT,
  best_time        TEXT NOT NULL DEFAULT '',     -- En İyi D. ör. "2.04.13"
  gny              TEXT NOT NULL DEFAULT '',     -- Gny değeri
  idm_flag         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (city, race_no, race_date, horse_name)
);

-- 3. İndeksler
CREATE INDEX IF NOT EXISTS idx_races_city_date
  ON races (city, race_date);

CREATE INDEX IF NOT EXISTS idx_race_entries_city_race_date
  ON race_entries (city, race_no, race_date);

CREATE INDEX IF NOT EXISTS idx_race_entries_horse_name
  ON race_entries (horse_name);

-- 4. RLS
ALTER TABLE races ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read races"
  ON races FOR SELECT USING (true);

CREATE POLICY "Allow anon insert races"
  ON races FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anon update races"
  ON races FOR UPDATE USING (true);

CREATE POLICY "Allow public read race_entries"
  ON race_entries FOR SELECT USING (true);

CREATE POLICY "Allow anon insert race_entries"
  ON race_entries FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anon update race_entries"
  ON race_entries FOR UPDATE USING (true);

