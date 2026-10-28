"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { Calendar, ChevronLeft, ChevronRight, Download, Filter, RefreshCw, Search } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import * as XLSX from "xlsx";
import {
  getWaterLevelStatus,
  getRainfallStatus,
  getFloodWarningStatus,
} from "@/lib/utils/flood-status";

type FloodReading = {
  id: number;
  created_at: string;
  device_id: string | null;
  wind_speed_ms: number | null;
  wind_speed_kmh: number | null;
  water_level_cm: number | null;
  rain_total_mm: number | null;
  rain_rate_mm_hr: number | null;
  tips_last_minute: number | null;
  rain_intensity: string | null;
};

type DatePreset = "today" | "yesterday" | "last7" | "last30" | "custom";

export default function HistoricalDataPage() {
  const supabase = useMemo(() => createClient(), []);
  const [readings, setReadings] = useState<FloodReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<DatePreset>("today");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [search, setSearch] = useState("");
  const [paramFilter, setParamFilter] = useState("all");
  const [warnFilter, setWarnFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let active = true;
    const fetchReadings = async () => {
      const { data, error } = await supabase
        .from("flood_readings")
        .select("*")
        .order("created_at", { ascending: true });

      if (!error && data && active) {
        setReadings(data as FloodReading[]);
      }
      if (active) setLoading(false);
    };

    fetchReadings();
    const interval = setInterval(() => {
      if (active) fetchReadings();
    }, 60000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [supabase]);

  const filtered = useMemo(() => {
    let result = [...readings].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (!mounted) return result;
    const now = new Date();

    if (preset === "today") {
      const start = startOfDay(now);
      const end = endOfDay(now);
      result = result.filter((r) => {
        const d = new Date(r.created_at);
        return d >= start && d <= end;
      });
    } else if (preset === "yesterday") {
      const yesterday = subDays(now, 1);
      const start = startOfDay(yesterday);
      const end = endOfDay(yesterday);
      result = result.filter((r) => {
        const d = new Date(r.created_at);
        return d >= start && d <= end;
      });
    } else if (preset === "last7") {
      const start = subDays(startOfDay(now), 6);
      result = result.filter((r) => new Date(r.created_at) >= start);
    } else if (preset === "last30") {
      const start = subDays(startOfDay(now), 29);
      result = result.filter((r) => new Date(r.created_at) >= start);
    } else if (preset === "custom") {
      if (startDate) {
        const s = startOfDay(new Date(startDate));
        if (startTime) {
          const [h, m] = startTime.split(":").map(Number);
          s.setHours(h, m, 0, 0);
        }
        result = result.filter((r) => new Date(r.created_at) >= s);
      }
      if (endDate) {
        const e = endOfDay(new Date(endDate));
        if (endTime) {
          const [h, m] = endTime.split(":").map(Number);
          e.setHours(h, m, 59, 999);
        }
        result = result.filter((r) => new Date(r.created_at) <= e);
      }
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((r) => {
        const wl = String(r.water_level_cm ?? "").includes(q);
        const rf = String(r.rain_rate_mm_hr ?? "").includes(q);
        const ws = String(r.wind_speed_kmh ?? "").includes(q);
        const did = (r.device_id || "").toLowerCase().includes(q);
        return wl || rf || ws || did;
      });
    }

    if (warnFilter !== "all") {
      result = result.filter((r) => {
        const wl = getWaterLevelStatus(r.water_level_cm);
        const rf = getRainfallStatus(r.rain_rate_mm_hr);
        const flood = getFloodWarningStatus(wl, rf);
        return flood === warnFilter;
      });
    }

    if (paramFilter !== "all") {
      // keep all params but we'll use for charts display context if needed
    }

    return result;
  }, [readings, preset, startDate, endDate, startTime, endTime, search, warnFilter, mounted]);

  useEffect(() => {
    setPage(1);
  }, [preset, startDate, endDate, startTime, endTime, search, warnFilter, paramFilter]);

  const chartData = useMemo(
    () =>
      filtered.map((r) => ({
        index: format(new Date(r.created_at), "MM/dd HH:mm"),
        fullTime: format(new Date(r.created_at), "MMM dd, yyyy HH:mm:ss"),
        water_level_cm: r.water_level_cm ?? 0,
        rain_rate_mm_hr: r.rain_rate_mm_hr ?? 0,
        wind_speed_kmh: r.wind_speed_kmh ?? 0,
      })),
    [filtered]
  );

  const alertOccurrences = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((r) => {
      const wl = getWaterLevelStatus(r.water_level_cm);
      const rf = getRainfallStatus(r.rain_rate_mm_hr);
      const flood = getFloodWarningStatus(wl, rf);
      if (flood !== "Normal") {
        const key = format(new Date(r.created_at), "MM/dd");
        map.set(key, (map.get(key) || 0) + 1);
      }
    });
    return Array.from(map.entries()).map(([date, count]) => ({ date, count }));
  }, [filtered]);

  const exportCSV = () => {
    const rows = filtered.map((r) => ({
      created_at: format(new Date(r.created_at), "yyyy-MM-dd HH:mm:ss"),
      device_id: r.device_id || "",
      water_level_cm: r.water_level_cm ?? "",
      rain_rate_mm_hr: r.rain_rate_mm_hr ?? "",
      rain_total_mm: r.rain_total_mm ?? "",
      wind_speed_kmh: r.wind_speed_kmh ?? "",
      wind_speed_ms: r.wind_speed_ms ?? "",
      rain_intensity: r.rain_intensity || "",
      tips_last_minute: r.tips_last_minute ?? "",
    }));
    const headers = Object.keys(rows[0] || {});
    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((h) => `"${String((row as any)[h]).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `flood_historical_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`;
    link.click();
  };

  const exportXLSX = () => {
    const rows = filtered.map((r) => ({
      "Date & Time": format(new Date(r.created_at), "yyyy-MM-dd HH:mm:ss"),
      "Device ID": r.device_id || "",
      "Water Level (cm)": r.water_level_cm ?? "",
      "Rain Rate (mm/hr)": r.rain_rate_mm_hr ?? "",
      "Rain Total (mm)": r.rain_total_mm ?? "",
      "Wind Speed (km/h)": r.wind_speed_kmh ?? "",
      "Wind Speed (m/s)": r.wind_speed_ms ?? "",
      "Rain Intensity": r.rain_intensity || "",
      "Tips Last Minute": r.tips_last_minute ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Historical Data");
    XLSX.writeFile(wb, `flood_historical_${format(new Date(), "yyyyMMdd_HHmmss")}.xlsx`);
  };

  if (loading) {
    return (
      <main className="py-6">
        <div className="flex items-center justify-center h-[60vh]">
          <p className="text-sm text-gray-500">Loading historical data...</p>
        </div>
      </main>
    );
  }

  return (
    <div className="py-6 pb-10 space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Historical Data</h1>
          <p className="text-sm text-gray-500 mt-1">Search, filter, visualize and export past flood readings</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setLoading(true);
              supabase
                .from("flood_readings")
                .select("*")
                .order("created_at", { ascending: true })
                .then(({ data, error }) => {
                  if (!error && data) setReadings(data as FloodReading[]);
                  setLoading(false);
                });
            }}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button onClick={exportCSV} className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-900 hover:bg-gray-50">
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button onClick={exportXLSX} className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-900 hover:bg-gray-50">
            <Download className="h-4 w-4" />
            Export Excel
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
          <Filter className="h-4 w-4" />
          Filters
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-gray-500">Date Range</label>
            <select value={preset} onChange={(e) => setPreset(e.target.value as DatePreset)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 bg-white">
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last7">Last 7 days</option>
              <option value="last30">Last 30 days</option>
              <option value="custom">Custom date range</option>
            </select>
          </div>
          {preset === "custom" && (
            <>
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Start Date</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 bg-white" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-500">End Date</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 bg-white" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Start Time</label>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm text-gray-900 bg-white" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-500">End Time</label>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm text-gray-900 bg-white" />
              </div>
            </>
          )}
          <div className="space-y-1">
            <label className="text-xs text-gray-500">Parameter Filter</label>
            <select value={paramFilter} onChange={(e) => setParamFilter(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 bg-white">
              <option value="all">All Parameters</option>
              <option value="water">Water Level</option>
              <option value="rain">Rainfall</option>
              <option value="wind">Wind Speed</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-500">Warning-level Filter</label>
            <select value={warnFilter} onChange={(e) => setWarnFilter(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 bg-white">
              <option value="all">All Levels</option>
              <option value="Alert">Alert</option>
              <option value="Warning">Warning</option>
              <option value="Critical">Critical</option>
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2 lg:col-span-3 xl:col-span-5">
            <label className="text-xs text-gray-500">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by value, device ID..." className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-medium text-gray-900">Water Level vs. Time</h2>
          </div>
          <div className="p-4 sm:p-6 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="index" tick={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" unit=" cm" />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb" }} labelFormatter={(_, payload) => payload?.[0]?.payload?.fullTime || ""} />
                <Legend />
                <Line type="monotone" dataKey="water_level_cm" name="Water Level (cm)" stroke="#0ea5e9" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-medium text-gray-900">Rainfall vs. Time</h2>
          </div>
          <div className="p-4 sm:p-6 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="index" tick={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" unit=" mm/hr" />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb" }} labelFormatter={(_, payload) => payload?.[0]?.payload?.fullTime || ""} />
                <Legend />
                <Line type="monotone" dataKey="rain_rate_mm_hr" name="Rain Rate (mm/hr)" stroke="#06b6d4" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-medium text-gray-900">Wind Speed vs. Time</h2>
          </div>
          <div className="p-4 sm:p-6 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="index" tick={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" unit=" km/h" />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb" }} labelFormatter={(_, payload) => payload?.[0]?.payload?.fullTime || ""} />
                <Legend />
                <Line type="monotone" dataKey="wind_speed_kmh" name="Wind Speed (km/h)" stroke="#2563eb" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-medium text-gray-900">Warning/Alert Occurrences Over Time</h2>
          </div>
          <div className="p-4 sm:p-6 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={alertOccurrences}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb" }} />
                <Bar dataKey="count" name="Alerts/Warnings" fill="#ef4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-medium text-gray-900">Historical Records</h2>
            <p className="text-sm text-gray-500">
              Showing {Math.min(filtered.length, page * pageSize)} of {filtered.length} record(s)
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left font-medium text-gray-600 px-6 py-3">Date & Time</th>
                <th className="text-left font-medium text-gray-600 px-6 py-3">Device ID</th>
                <th className="text-left font-medium text-gray-600 px-6 py-3">Water Level (cm)</th>
                <th className="text-left font-medium text-gray-600 px-6 py-3">Rain Rate (mm/hr)</th>
                <th className="text-left font-medium text-gray-600 px-6 py-3">Rain Total (mm)</th>
                <th className="text-left font-medium text-gray-600 px-6 py-3">Wind Speed (km/h)</th>
                <th className="text-left font-medium text-gray-600 px-6 py-3">Rain Intensity</th>
                <th className="text-left font-medium text-gray-600 px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.slice((page - 1) * pageSize, page * pageSize).map((r) => {
                const wl = getWaterLevelStatus(r.water_level_cm);
                const rf = getRainfallStatus(r.rain_rate_mm_hr);
                const flood = getFloodWarningStatus(wl, rf);
                return (
                  <tr key={r.id}>
                    <td className="px-6 py-3 text-gray-900">{format(new Date(r.created_at), "MMM dd, yyyy HH:mm:ss")}</td>
                    <td className="px-6 py-3 text-gray-500">{r.device_id ? "San Juan, Cabagan, Isabela Device 1" : "-"}</td>
                    <td className="px-6 py-3 text-gray-900">{r.water_level_cm ?? "-"}</td>
                    <td className="px-6 py-3 text-gray-900">{r.rain_rate_mm_hr ?? "-"}</td>
                    <td className="px-6 py-3 text-gray-900">{r.rain_total_mm ?? "-"}</td>
                    <td className="px-6 py-3 text-gray-900">{r.wind_speed_kmh ?? "-"}</td>
                    <td className="px-6 py-3 text-gray-500">{r.rain_intensity || "-"}</td>
                    <td className="px-6 py-3 text-gray-600">{flood}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="px-6 py-10 text-center text-sm text-gray-500">No records found for the selected filters.</div>
          )}
        </div>
        {filtered.length > 0 && (
          <div className="px-4 sm:px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-gray-500">
              Page {page} of {Math.max(1, Math.ceil(filtered.length / pageSize))}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-900 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(Math.max(1, Math.ceil(filtered.length / pageSize)), p + 1))}
                disabled={page === Math.max(1, Math.ceil(filtered.length / pageSize))}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-900 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

