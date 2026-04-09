"use client";

import { useState, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────────
//  Tipler
// ─────────────────────────────────────────────────

type WindowKey = "opening" | "1h" | "30m" | "15m" | "5m";

interface RaceRow {
  id: number;
  city: string;
  race_no: number;
  race_date: string;
  race_time: string;
  race_type: string;
  horse_category: string;
  distance: number | null;
  track_surface: string;
  eid: string;
  raw_conditions: string;
}

interface EntryRow {
  id: number;
  city: string;
  race_no: number;
  race_date: string;
  horse_no: number | null;
  horse_name: string;
  age: string;
  origin: string;
  weight: number | null;
  jockey: string;
  jockey_rank: string;
  owner: string;
  trainer: string;
  start_no: string;
  hp: number | null;
  last_6_races: string;
  kgs: number | null;
  s20: number | null;
  best_time: string;
  gny: string;
  idm_flag: boolean;
}

interface TrendRow {
  city: string;
  race_no: number;
  horse_name: string;
  agf_rate: number | null;
  prev_agf_rate: number | null;
  change: number | null;
  change_pct: number | null;
  snapshot_at: string;
}

interface RacesResponse {
  date: string;
  raceCount: number;
  entryCount: number;
  races: RaceRow[];
  entries: EntryRow[];
}

interface TrendsResponse {
  window: string;
  firstSnapshot: string | null;
  lastSnapshot: string | null;
  trends: TrendRow[];
}

// ─────────────────────────────────────────────────
//  Sabitler
// ─────────────────────────────────────────────────

const WINDOWS: { key: WindowKey; label: string }[] = [
  { key: "opening", label: "Açılış" },
  { key: "1h", label: "Son 1 Saat" },
  { key: "30m", label: "Son 30 dk" },
  { key: "15m", label: "Son 15 dk" },
  { key: "5m", label: "Son 5 dk" },
];

// ─────────────────────────────────────────────────
//  Ana Bileşen
// ─────────────────────────────────────────────────

export default function Home() {
  const [racesData, setRacesData] = useState<RacesResponse | null>(null);
  const [trendsData, setTrendsData] = useState<TrendsResponse | null>(null);
  const [activeWindow, setActiveWindow] = useState<WindowKey>("opening");
  const [selectedRaceKey, setSelectedRaceKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // AGF trendi map: "city|race_no|horse_name" → TrendRow
  const trendMap = new Map<string, TrendRow>();
  for (const t of trendsData?.trends ?? []) {
    trendMap.set(`${t.city}|${t.race_no}|${t.horse_name}`, t);
  }

  const fetchAll = useCallback(async (w: WindowKey) => {
    setLoading(true);
    setError(null);
    try {
      const [racesRes, trendsRes] = await Promise.all([
        fetch("/api/races"),
        fetch(`/api/trends?window=${w}`),
      ]);
      if (!racesRes.ok) throw new Error(`Races HTTP ${racesRes.status}`);
      if (!trendsRes.ok) throw new Error(`Trends HTTP ${trendsRes.status}`);

      const races: RacesResponse = await racesRes.json();
      const trends: TrendsResponse = await trendsRes.json();

      setRacesData(races);
      setTrendsData(trends);

      // İlk koşuyu otomatik seç
      if (races.races.length > 0 && selectedRaceKey === null) {
        const first = races.races[0];
        setSelectedRaceKey(`${first.city}|${first.race_no}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Veri alınamadı");
    } finally {
      setLoading(false);
    }
  }, [selectedRaceKey]);

  useEffect(() => {
    fetchAll(activeWindow);
    const interval = setInterval(() => fetchAll(activeWindow), 60_000);
    return () => clearInterval(interval);
  }, [activeWindow, fetchAll]);

  const selectedRace = racesData?.races.find(
    (r) => `${r.city}|${r.race_no}` === selectedRaceKey,
  ) ?? null;

  const selectedEntries = racesData?.entries
    .filter((e) => `${e.city}|${e.race_no}` === selectedRaceKey)
    .sort((a, b) => (a.horse_no ?? 99) - (b.horse_no ?? 99)) ?? [];

  const lastSnapshotTime = trendsData?.lastSnapshot
    ? new Date(trendsData.lastSnapshot).toLocaleTimeString("tr-TR")
    : null;

  // ─────────────────────────────────────────────────
  //  Render
  // ─────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* ── Üst Başlık ── */}
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-30">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏇</span>
            <div>
              <h1 className="text-lg font-bold text-emerald-400 leading-tight">7li Ganyan</h1>
              <p className="text-xs text-gray-500">TJK AGF Analiz</p>
            </div>
          </div>
          {lastSnapshotTime && (
            <span className="text-xs text-gray-500">
              ⏱ Son güncelleme: {lastSnapshotTime}
            </span>
          )}
        </div>
      </header>

      <div className="max-w-screen-2xl mx-auto px-4 py-4 flex flex-col gap-4">
        {/* ── Yükleniyor / Hata ── */}
        {loading && (
          <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
            <span className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            Veriler yükleniyor…
          </div>
        )}
        {error && (
          <div className="text-center py-10 text-red-400">
            ⚠️ {error}
            <button onClick={() => fetchAll(activeWindow)} className="ml-3 underline text-emerald-400 text-sm">
              Tekrar dene
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* ── Koşu Listesi (yatay kaydırılabilir chip'ler) ── */}
            <nav className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {racesData?.races.map((race) => {
                const key = `${race.city}|${race.race_no}`;
                const isActive = selectedRaceKey === key;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedRaceKey(key)}
                    className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
                      isActive
                        ? "bg-emerald-600 border-emerald-500 text-white shadow-lg"
                        : "bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                    }`}
                  >
                    <span className="block font-bold">{race.city}</span>
                    <span className="block">{race.race_no}. Koşu — {race.race_time}</span>
                  </button>
                );
              })}
              {racesData?.races.length === 0 && (
                <p className="text-gray-500 text-sm py-2">
                  📭 Bugün için koşu verisi bulunamadı.
                </p>
              )}
            </nav>

            {/* ── Seçili Koşu Başlığı ── */}
            {selectedRace && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                <div className="flex flex-wrap gap-x-6 gap-y-1 items-baseline">
                  <h2 className="text-base font-bold text-emerald-400">
                    📍 {selectedRace.city} — {selectedRace.race_no}. Koşu
                  </h2>
                  <span className="text-gray-400 text-sm">🕐 {selectedRace.race_time}</span>
                  {selectedRace.race_type && (
                    <span className="text-yellow-400 text-xs font-medium bg-yellow-400/10 px-2 py-0.5 rounded">
                      {selectedRace.race_type}
                    </span>
                  )}
                </div>
                <p className="text-gray-400 text-xs mt-2">
                  {selectedRace.horse_category}
                  {selectedRace.distance && ` · ${selectedRace.distance}m`}
                  {selectedRace.track_surface && ` · ${selectedRace.track_surface}`}
                  {selectedRace.eid && ` · E.İ.D: ${selectedRace.eid}`}
                </p>
              </div>
            )}

            {/* ── At Tablosu — tam genişlik ── */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                {/* Trend sekmeleri */}
                <div className="flex gap-1 border-b border-gray-800 bg-gray-900/80 px-3 pt-3 overflow-x-auto scrollbar-none">
                  {WINDOWS.map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setActiveWindow(key)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-t-lg text-xs font-medium transition-colors mb-0 border-b-2 ${
                        activeWindow === key
                          ? "border-emerald-400 text-emerald-400 bg-gray-800"
                          : "border-transparent text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Tablo */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-800/60 text-gray-400 uppercase tracking-wider text-[10px]">
                        <th className="px-3 py-2 text-left w-6">N</th>
                        <th className="px-3 py-2 text-left min-w-[110px]">At İsmi</th>
                        <th className="px-3 py-2 text-center">Yaş</th>
                        <th className="px-3 py-2 text-left min-w-[130px]">Orijin</th>
                        <th className="px-3 py-2 text-center">Kilo</th>
                        <th className="px-3 py-2 text-left min-w-[90px]">Jokey</th>
                        <th className="px-3 py-2 text-left min-w-[90px]">Sahip</th>
                        <th className="px-3 py-2 text-left min-w-[90px]">Antrenör</th>
                        <th className="px-3 py-2 text-center">St</th>
                        <th className="px-3 py-2 text-center">HP</th>
                        <th className="px-3 py-2 text-center">Son 6</th>
                        <th className="px-3 py-2 text-center">KGS</th>
                        <th className="px-3 py-2 text-center">s20</th>
                        <th className="px-3 py-2 text-center min-w-[70px]">E.İ.D.</th>
                        <th className="px-3 py-2 text-center">Gny</th>
                        <th className="px-3 py-2 text-center min-w-[65px]">AGF</th>
                        <th className="px-3 py-2 text-center min-w-[55px]">Δ AGF</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedEntries.length === 0 ? (
                        <tr>
                          <td colSpan={17} className="px-4 py-10 text-center text-gray-500">
                            {racesData?.races.length === 0
                              ? "Bugün yarış verisi yok"
                              : "Koşu seçin veya veri bekleniyor…"}
                          </td>
                        </tr>
                      ) : (
                        selectedEntries.map((entry) => {
                          const tk = `${entry.city}|${entry.race_no}|${entry.horse_name}`;
                          const trend = trendMap.get(tk);
                          const agf = trend?.agf_rate ?? null;
                          const change = trend?.change ?? null;
                          const showChange = trendsData?.firstSnapshot !== trendsData?.lastSnapshot;

                          return (
                            <tr
                              key={entry.id}
                              className="border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors"
                            >
                              <td className="px-3 py-2 text-gray-500 font-mono">{entry.horse_no}</td>
                              <td className="px-3 py-2 font-semibold text-gray-100">{entry.horse_name}</td>
                              <td className="px-3 py-2 text-center text-gray-400 whitespace-nowrap">{entry.age}</td>
                              <td className="px-3 py-2 text-gray-400 max-w-[130px] truncate" title={entry.origin}>
                                {entry.origin}
                              </td>
                              <td className="px-3 py-2 text-center font-mono">{entry.weight ?? "—"}</td>
                              <td className="px-3 py-2">
                                <span className="block text-gray-200 whitespace-nowrap">{entry.jockey}</span>
                                {entry.jockey_rank && (
                                  <span className="text-[10px] text-blue-400">{entry.jockey_rank}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{entry.owner}</td>
                              <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{entry.trainer}</td>
                              <td className="px-3 py-2 text-center font-mono whitespace-nowrap">{entry.start_no}</td>
                              <td className="px-3 py-2 text-center font-mono">{entry.hp ?? "—"}</td>
                              <td className="px-3 py-2 text-center font-mono tracking-widest">
                                {entry.last_6_races}
                              </td>
                              <td className="px-3 py-2 text-center font-mono">{entry.kgs ?? "—"}</td>
                              <td className="px-3 py-2 text-center font-mono">{entry.s20 ?? "—"}</td>
                              <td className="px-3 py-2 text-center font-mono whitespace-nowrap">{entry.best_time || "—"}</td>
                              <td className="px-3 py-2 text-center font-mono">{entry.gny || "—"}</td>
                              {/* AGF */}
                              <td className="px-3 py-2 text-center">
                                <span className={`font-mono font-bold ${agfBadgeColor(agf)}`}>
                                  {agf != null ? `%${agf.toFixed(2)}` : "—"}
                                </span>
                              </td>
                              {/* Δ AGF */}
                              <td className="px-3 py-2 text-center font-mono">
                                {showChange && change !== null ? (
                                  <span className={changeColor(change)}>
                                    {change > 0 ? "▲" : change < 0 ? "▼" : "●"}{" "}
                                    {Math.abs(change).toFixed(2)}
                                  </span>
                                ) : (
                                  <span className="text-gray-600">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
//  Yardımcı bileşenler & fonksiyonlar
// ─────────────────────────────────────────────────


function agfBadgeColor(rate: number | null): string {
  if (rate === null) return "text-gray-500";
  if (rate <= 10) return "text-emerald-400";
  if (rate <= 20) return "text-yellow-400";
  return "text-orange-400";
}

function changeColor(val: number): string {
  if (val > 0) return "text-red-400";
  if (val < 0) return "text-emerald-400";
  return "text-gray-500";
}
