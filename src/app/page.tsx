"use client";

import { useState, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────────
//  Tipler
// ─────────────────────────────────────────────────

type SortCol =
  | "horse_no"
  | "horse_name"
  | "agf_opening"
  | "agf_current"
  | "change_opening"
  | "change_1h"
  | "change_30m"
  | "change_15m"
  | "change_5m";

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

type TrendMaps = {
  opening: Map<string, TrendRow>;
  "1h": Map<string, TrendRow>;
  "30m": Map<string, TrendRow>;
  "15m": Map<string, TrendRow>;
  "5m": Map<string, TrendRow>;
  lastSnapshot: string | null;
};

// ─────────────────────────────────────────────────
//  Ana Bileşen
// ─────────────────────────────────────────────────

export default function Home() {
  const [racesData, setRacesData] = useState<RacesResponse | null>(null);
  const [trendMaps, setTrendMaps] = useState<TrendMaps | null>(null);
  const [selectedRaceKey, setSelectedRaceKey] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  function buildMap(trends: TrendRow[]): Map<string, TrendRow> {
    const m = new Map<string, TrendRow>();
    for (const t of trends) {
      m.set(`${t.city}|${t.race_no}|${t.horse_name}`, t);
    }
    return m;
  }

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [racesRes, openingRes, h1Res, m30Res, m15Res, m5Res] = await Promise.all([
        fetch("/api/races"),
        fetch("/api/trends?window=opening"),
        fetch("/api/trends?window=1h"),
        fetch("/api/trends?window=30m"),
        fetch("/api/trends?window=15m"),
        fetch("/api/trends?window=5m"),
      ]);

      if (!racesRes.ok) throw new Error(`Races HTTP ${racesRes.status}`);
      if (!openingRes.ok) throw new Error(`Trends HTTP ${openingRes.status}`);

      const races: RacesResponse = await racesRes.json();
      const opening: TrendsResponse = await openingRes.json();
      const safeParse = async (res: Response): Promise<TrendsResponse> =>
        res.ok ? res.json() : { trends: [], firstSnapshot: null, lastSnapshot: null, window: "" };
      const [h1, m30, m15, m5] = await Promise.all([
        safeParse(h1Res), safeParse(m30Res), safeParse(m15Res), safeParse(m5Res),
      ]);

      setRacesData(races);
      setTrendMaps({
        opening: buildMap(opening.trends),
        "1h": buildMap(h1.trends),
        "30m": buildMap(m30.trends),
        "15m": buildMap(m15.trends),
        "5m": buildMap(m5.trends),
        lastSnapshot: opening.lastSnapshot,
      });

      if (races.races.length > 0 && selectedRaceKey === null) {
        const first = races.races[0];
        setSelectedCity(first.city);
        setSelectedRaceKey(`${first.city}|${first.race_no}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Veri alınamadı");
    } finally {
      setLoading(false);
    }
  }, [selectedRaceKey]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 5 * 60_000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const selectedRace = racesData?.races.find(
    (r) => `${r.city}|${r.race_no}` === selectedRaceKey,
  ) ?? null;

  const selectedEntries = (racesData?.entries ?? [])
    .filter((e) => `${e.city}|${e.race_no}` === selectedRaceKey)
    .sort((a, b) => (a.horse_no ?? 99) - (b.horse_no ?? 99));

  const sortedEntries = sortCol
    ? [...selectedEntries].sort((a, b) => {
        const ak = `${a.city}|${a.race_no}|${a.horse_name}`;
        const bk = `${b.city}|${b.race_no}|${b.horse_name}`;
        const ao = trendMaps?.opening.get(ak);
        const bo = trendMaps?.opening.get(bk);
        let av: number | string | null = null;
        let bv: number | string | null = null;
        switch (sortCol) {
          case "horse_no":       av = a.horse_no;  bv = b.horse_no;  break;
          case "horse_name":     av = a.horse_name; bv = b.horse_name; break;
          case "agf_opening":    av = ao?.prev_agf_rate ?? ao?.agf_rate ?? null; bv = bo?.prev_agf_rate ?? bo?.agf_rate ?? null; break;
          case "agf_current":    av = ao?.agf_rate ?? null; bv = bo?.agf_rate ?? null; break;
          case "change_opening": av = ao?.change ?? null;   bv = bo?.change ?? null;   break;
          case "change_1h":      av = trendMaps?.["1h"].get(ak)?.change ?? null;  bv = trendMaps?.["1h"].get(bk)?.change ?? null;  break;
          case "change_30m":     av = trendMaps?.["30m"].get(ak)?.change ?? null; bv = trendMaps?.["30m"].get(bk)?.change ?? null; break;
          case "change_15m":     av = trendMaps?.["15m"].get(ak)?.change ?? null; bv = trendMaps?.["15m"].get(bk)?.change ?? null; break;
          case "change_5m":      av = trendMaps?.["5m"].get(ak)?.change ?? null;  bv = trendMaps?.["5m"].get(bk)?.change ?? null;  break;
        }
        if (av === null && bv === null) return 0;
        if (av === null) return 1;
        if (bv === null) return -1;
        const cmp = typeof av === "string"
          ? av.localeCompare(bv as string, "tr")
          : (av as number) - (bv as number);
        return sortDir === "asc" ? cmp : -cmp;
      })
    : selectedEntries;

  const lastSnapshotTime = trendMaps?.lastSnapshot
    ? new Date(trendMaps.lastSnapshot).toLocaleTimeString("tr-TR")
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
          <div className="flex items-center gap-3">
            {lastSnapshotTime && (
              <span className="text-xs text-gray-500">⏱ Son güncelleme: {lastSnapshotTime}</span>
            )}
            <button
              onClick={fetchAll}
              className="text-xs text-emerald-400 border border-emerald-800 px-2 py-1 rounded hover:bg-emerald-900/30 transition-colors"
            >
              Yenile
            </button>
          </div>
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
            <button onClick={fetchAll} className="ml-3 underline text-emerald-400 text-sm">
              Tekrar dene
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* ── Navigasyon: Şehir + Koşu ── */}
            {racesData && racesData.races.length > 0 && (() => {
              const cities = [...new Set(racesData.races.map((r) => r.city))];
              const activeCity = selectedCity ?? cities[0];
              const cityRaces = racesData.races.filter((r) => r.city === activeCity);
              return (
                <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                  <div className="flex border-b border-gray-800 overflow-x-auto scrollbar-none">
                    {cities.map((city) => {
                      const isActive = city === activeCity;
                      const count = racesData.races.filter((r) => r.city === city).length;
                      return (
                        <button
                          key={city}
                          onClick={() => {
                            setSelectedCity(city);
                            const first = racesData.races.find((r) => r.city === city);
                            if (first) setSelectedRaceKey(`${first.city}|${first.race_no}`);
                          }}
                          className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 ${
                            isActive
                              ? "border-emerald-400 text-emerald-400 bg-gray-800/60"
                              : "border-transparent text-gray-500 hover:text-gray-200 hover:bg-gray-800/40"
                          }`}
                        >
                          {city}
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                            isActive ? "bg-emerald-400/20 text-emerald-300" : "bg-gray-700 text-gray-500"
                          }`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-1.5 p-2 overflow-x-auto scrollbar-none flex-wrap">
                    {cityRaces.map((race) => {
                      const key = `${race.city}|${race.race_no}`;
                      const isActive = selectedRaceKey === key;
                      return (
                        <button
                          key={key}
                          onClick={() => setSelectedRaceKey(key)}
                          className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            isActive
                              ? "bg-emerald-600 text-white shadow"
                              : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                          }`}
                        >
                          <span className="font-bold">{race.race_no}.</span>
                          <span className="text-[11px] opacity-80">{race.race_time}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {racesData?.races.length === 0 && (
              <p className="text-gray-500 text-sm py-2">📭 Bugün için koşu verisi bulunamadı.</p>
            )}

            {/* ── Seçili Koşu Başlığı ── */}
            {selectedRace && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-1">
                <h2 className="text-sm font-bold text-emerald-400">
                  📍 {selectedRace.city} — {selectedRace.race_no}. Koşu
                </h2>
                <span className="text-gray-400 text-xs">🕐 {selectedRace.race_time}</span>
                {selectedRace.race_type && (
                  <span className="text-yellow-400 text-xs font-medium bg-yellow-400/10 px-2 py-0.5 rounded">
                    {selectedRace.race_type}
                  </span>
                )}
                <span className="text-gray-500 text-xs">
                  {selectedRace.horse_category}
                  {selectedRace.distance ? ` · ${selectedRace.distance}m` : ""}
                  {selectedRace.track_surface ? ` · ${selectedRace.track_surface}` : ""}
                  {selectedRace.eid ? ` · E.İ.D: ${selectedRace.eid}` : ""}
                </span>
              </div>
            )}

            {/* ── AGF Tablosu ── */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-800/60 text-gray-400 text-[10px] uppercase tracking-wider">
                      <Th col="horse_no"       label="No"         sc={sortCol} sd={sortDir} onSort={handleSort} className="text-center w-10" />
                      <Th col="horse_name"     label="At Adı"     sc={sortCol} sd={sortDir} onSort={handleSort} className="text-left min-w-[160px]" />
                      <Th col="agf_opening"    label="Açılış AGF" sc={sortCol} sd={sortDir} onSort={handleSort} className="text-center min-w-[90px]" />
                      <Th col="agf_current"    label="Güncel AGF" sc={sortCol} sd={sortDir} onSort={handleSort} className="text-center min-w-[90px]" />
                      <Th col="change_opening" label="Değişim"    sc={sortCol} sd={sortDir} onSort={handleSort} className="text-center min-w-[80px]" />
                      <Th col="change_1h"      label="Son 1s"     sc={sortCol} sd={sortDir} onSort={handleSort} className="text-center min-w-[75px]" />
                      <Th col="change_30m"     label="Son 30dk"   sc={sortCol} sd={sortDir} onSort={handleSort} className="text-center min-w-[75px]" />
                      <Th col="change_15m"     label="Son 15dk"   sc={sortCol} sd={sortDir} onSort={handleSort} className="text-center min-w-[75px]" />
                      <Th col="change_5m"      label="Son 5dk"    sc={sortCol} sd={sortDir} onSort={handleSort} className="text-center min-w-[75px]" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedEntries.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-10 text-center text-gray-500">
                          {racesData?.races.length === 0
                            ? "Bugün yarış verisi yok"
                            : "Koşu seçin veya veri bekleniyor…"}
                        </td>
                      </tr>
                    ) : (
                      sortedEntries.map((entry) => {
                        const key = `${entry.city}|${entry.race_no}|${entry.horse_name}`;
                        const oRow = trendMaps?.opening.get(key);
                        const agfOpening = oRow?.prev_agf_rate ?? oRow?.agf_rate ?? null;
                        const agfCurrent = oRow?.agf_rate ?? null;
                        return (
                          <tr key={entry.id} className="border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors">
                            <td className="px-3 py-2.5 text-center text-gray-500 font-mono">{entry.horse_no}</td>
                            <td className="px-3 py-2.5 font-semibold text-gray-100">{entry.horse_name}</td>
                            <td className="px-3 py-2.5 text-center">
                              <span className={`font-mono font-bold ${agfColor(agfOpening)}`}>
                                {agfOpening != null ? `%${agfOpening.toFixed(2)}` : "—"}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span className={`font-mono font-bold ${agfColor(agfCurrent)}`}>
                                {agfCurrent != null ? `%${agfCurrent.toFixed(2)}` : "—"}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono">
                              <ChangeCell val={oRow?.change ?? null} />
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono">
                              <ChangeCell val={trendMaps?.["1h"].get(key)?.change ?? null} />
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono">
                              <ChangeCell val={trendMaps?.["30m"].get(key)?.change ?? null} />
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono">
                              <ChangeCell val={trendMaps?.["15m"].get(key)?.change ?? null} />
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono">
                              <ChangeCell val={trendMaps?.["5m"].get(key)?.change ?? null} />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
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

function ChangeCell({ val }: { val: number | null }) {
  if (val === null) return <span className="text-gray-600">—</span>;
  if (val === 0)    return <span className="text-gray-500">● %0.00</span>;
  return (
    <span className={val > 0 ? "text-emerald-400" : "text-red-400"}>
      {val > 0 ? "▲" : "▼"} %{Math.abs(val).toFixed(2)}
    </span>
  );
}

function Th({
  col, label, sc, sd, onSort, className,
}: {
  col: SortCol;
  label: string;
  sc: SortCol | null;
  sd: "asc" | "desc";
  onSort: (c: SortCol) => void;
  className?: string;
}) {
  const active = sc === col;
  return (
    <th
      onClick={() => onSort(col)}
      className={`px-3 py-2 cursor-pointer select-none hover:text-gray-200 transition-colors whitespace-nowrap ${className ?? ""}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={`text-[9px] ${active ? "text-emerald-400" : "text-gray-600"}`}>
          {active ? (sd === "asc" ? "▲" : "▼") : "⇅"}
        </span>
      </span>
    </th>
  );
}

function agfColor(rate: number | null): string {
  if (rate === null) return "text-gray-500";
  if (rate >= 20)   return "text-emerald-400";
  if (rate >= 10)   return "text-yellow-400";
  return "text-red-400";
}
