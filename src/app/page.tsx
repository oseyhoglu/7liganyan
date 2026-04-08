"use client";

import { useState, useEffect, useCallback } from "react";

type WindowKey = "opening" | "1h" | "30m" | "15m" | "5m";

interface TrendRow {
  city: string;
  race_no: number;
  race_time: string;
  horse_name: string;
  agf_rate: number | null;
  prev_agf_rate: number | null;
  change: number | null;
  change_pct: number | null;
}

interface TrendsResponse {
  window: string;
  count: number;
  firstSnapshot: string | null;
  lastSnapshot: string | null;
  trends: TrendRow[];
}

const WINDOWS: { key: WindowKey; label: string }[] = [
  { key: "opening", label: "Açılış" },
  { key: "1h", label: "Son 1 Saat" },
  { key: "30m", label: "Son 30 dk" },
  { key: "15m", label: "Son 15 dk" },
  { key: "5m", label: "Son 5 dk" },
];

export default function Home() {
  const [activeWindow, setActiveWindow] = useState<WindowKey>("opening");
  const [data, setData] = useState<TrendsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrends = useCallback(async (w: WindowKey) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/trends?window=${w}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: TrendsResponse = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Veri alınamadı");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrends(activeWindow);
    const interval = setInterval(() => fetchTrends(activeWindow), 60_000);
    return () => clearInterval(interval);
  }, [activeWindow, fetchTrends]);

  const grouped = groupByRace(data?.trends ?? []);
  const showChange =
    data && (data.firstSnapshot !== data.lastSnapshot || activeWindow !== "opening");

  return (
    <main className="flex-1 px-4 py-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-emerald-400">
          🏇 7li Ganyan
        </h1>
        <p className="text-gray-400 mt-1 text-sm">
          TJK AGF Oran Takip &amp; Trend Analizi
        </p>
        {data?.lastSnapshot && (
          <p className="text-gray-500 text-xs mt-2">
            Son güncelleme:{" "}
            {new Date(data.lastSnapshot).toLocaleTimeString("tr-TR")}
          </p>
        )}
      </header>

      {/* Zaman Penceresi Sekmeleri */}
      <nav className="flex gap-2 justify-center mb-6 flex-wrap">
        {WINDOWS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveWindow(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeWindow === key
                ? "bg-emerald-600 text-white shadow-lg"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Yükleniyor */}
      {loading && (
        <div className="text-center py-20 text-gray-400">
          <div className="inline-block w-8 h-8 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mb-4" />
          <p>Veriler yükleniyor…</p>
        </div>
      )}

      {/* Hata */}
      {error && (
        <div className="text-center py-20">
          <p className="text-red-400 mb-2">⚠️ {error}</p>
          <button
            onClick={() => fetchTrends(activeWindow)}
            className="text-emerald-400 underline text-sm"
          >
            Tekrar dene
          </button>
        </div>
      )}

      {/* Veri yok */}
      {!loading && !error && data && data.trends.length === 0 && (
        <div className="text-center py-20 text-gray-500">
          <p className="text-5xl mb-4">📭</p>
          <p>Bu zaman penceresi için veri bulunamadı.</p>
          <p className="text-sm mt-2">
            Henüz veri toplanmamış olabilir. Scraper çalıştığında veriler burada
            görünecek.
          </p>
        </div>
      )}

      {/* Koşu Kartları */}
      {!loading && !error && grouped.length > 0 && (
        <div className="space-y-8">
          {grouped.map((group) => (
            <section
              key={`${group.city}-${group.raceNo}`}
              className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden"
            >
              <div className="bg-gray-800 px-4 py-3 flex items-center justify-between">
                <h2 className="font-semibold text-emerald-400">
                  📍 {group.city} — {group.raceNo}. Koşu
                </h2>
                <span className="text-gray-400 text-sm">🕐 {group.raceTime}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-gray-800">
                      <th className="text-left px-4 py-2">#</th>
                      <th className="text-left px-4 py-2">At</th>
                      <th className="text-right px-4 py-2">AGF</th>
                      {showChange && (
                        <>
                          <th className="text-right px-4 py-2">Önceki</th>
                          <th className="text-right px-4 py-2">Değişim</th>
                          <th className="text-right px-4 py-2">%</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {group.horses.map((horse, idx) => (
                      <tr
                        key={horse.horse_name}
                        className="border-b border-gray-800/50 hover:bg-gray-800/50 transition-colors"
                      >
                        <td className="px-4 py-2 text-gray-500">{idx + 1}</td>
                        <td className="px-4 py-2 font-medium">{horse.horse_name}</td>
                        <td className="px-4 py-2 text-right font-mono">
                          {horse.agf_rate?.toFixed(2) ?? "—"}
                        </td>
                        {showChange && (
                          <>
                            <td className="px-4 py-2 text-right font-mono text-gray-500">
                              {horse.prev_agf_rate?.toFixed(2) ?? "—"}
                            </td>
                            <td
                              className={`px-4 py-2 text-right font-mono ${changeColor(horse.change)}`}
                            >
                              {formatChange(horse.change)}
                            </td>
                            <td
                              className={`px-4 py-2 text-right font-mono ${changeColor(horse.change_pct)}`}
                            >
                              {formatPct(horse.change_pct)}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

/* —— Yardımcı Fonksiyonlar —— */

interface RaceGroup {
  city: string;
  raceNo: number;
  raceTime: string;
  horses: TrendRow[];
}

function groupByRace(trends: TrendRow[]): RaceGroup[] {
  const map = new Map<string, RaceGroup>();
  for (const row of trends) {
    const key = `${row.city}|${row.race_no}`;
    if (!map.has(key)) {
      map.set(key, {
        city: row.city,
        raceNo: row.race_no,
        raceTime: row.race_time,
        horses: [],
      });
    }
    map.get(key)!.horses.push(row);
  }
  return Array.from(map.values());
}

function changeColor(val: number | null): string {
  if (val === null) return "text-gray-500";
  if (val > 0) return "text-red-400";
  if (val < 0) return "text-emerald-400";
  return "text-gray-500";
}

function formatChange(val: number | null): string {
  if (val === null) return "—";
  const sign = val > 0 ? "+" : "";
  return `${sign}${val.toFixed(2)}`;
}

function formatPct(val: number | null): string {
  if (val === null) return "—";
  const sign = val > 0 ? "+" : "";
  return `${sign}${val.toFixed(1)}%`;
}
