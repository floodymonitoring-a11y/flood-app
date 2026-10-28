"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import {
  Download,
  FileText,
  Filter,
  BarChart3,
  Droplets,
  Waves,
  Wind,
  AlertTriangle,
  Clock,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
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

export default function ReportsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [readings, setReadings] = useState<FloodReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<DatePreset>("last7");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    let active = true;
    const fetchReadings = async (showLoading = true) => {
      if (showLoading) setLoading(true);
      const { data, error } = await supabase
        .from("flood_readings")
        .select("*")
        .order("created_at", { ascending: true });

      if (!error && data && active) {
        setReadings(data as FloodReading[]);
      }
      if (active && showLoading) setLoading(false);
    };
    fetchReadings(true);
    const interval = setInterval(() => {
      if (active) fetchReadings(false);
    }, 60000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [supabase]);

  const filtered = useMemo(() => {
    let result = [...readings].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
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
    return result;
  }, [readings, preset, startDate, endDate, startTime, endTime, mounted]);

  const stats = useMemo(() => {
    const total = filtered.length;
    let alerts = 0;
    let warnings = 0;
    let critical = 0;
    let wlSum = 0;
    let wlCount = 0;
    let wlMax = 0;
    let rainSum = 0;
    let rainCount = 0;
    let rainMax = 0;
    let windMax = 0;
    filtered.forEach((r) => {
      const wl = getWaterLevelStatus(r.water_level_cm);
      const rf = getRainfallStatus(r.rain_rate_mm_hr);
      const flood = getFloodWarningStatus(wl, rf);
      if (flood === "Alert") alerts++;
      if (flood === "Warning") warnings++;
      if (flood === "Critical") critical++;
      if (r.water_level_cm != null) {
        wlSum += r.water_level_cm;
        wlCount++;
        wlMax = Math.max(wlMax, r.water_level_cm);
      }
      if (r.rain_rate_mm_hr != null) {
        rainSum += r.rain_rate_mm_hr;
        rainCount++;
        rainMax = Math.max(rainMax, r.rain_rate_mm_hr);
      }
      if (r.wind_speed_kmh != null) {
        windMax = Math.max(windMax, r.wind_speed_kmh);
      }
    });
    return {
      total,
      alerts,
      warnings,
      critical,
      wlAvg: wlCount ? (wlSum / wlCount).toFixed(1) : "-",
      wlMax: wlMax || "-",
      rainAvg: rainCount ? (rainSum / rainCount).toFixed(1) : "-",
      rainMax: rainMax || "-",
      windMax: windMax || "-",
    };
  }, [filtered]);

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
    link.download = `flood_report_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`;
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
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `flood_report_${format(new Date(), "yyyyMMdd_HHmmss")}.xlsx`);
  };

  if (loading) {
    return (
      <main className="py-6">
        <div className="flex items-center justify-center h-[60vh]">
          <p className="text-sm text-gray-500">Loading report data...</p>
        </div>
      </main>
    );
  }

  return (
    <div className="py-6 pb-10 space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-1">Summary and export of flood monitoring data</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            onClick={exportXLSX}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            Export Excel
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
          <Filter className="h-4 w-4" />
          Date Range
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as DatePreset)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 bg-white"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last7">Last 7 days</option>
            <option value="last30">Last 30 days</option>
            <option value="custom">Custom range</option>
          </select>
          {preset === "custom" && (
            <>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 bg-white"
              />
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="rounded-lg border border-gray-200 px-2 py-2 text-sm text-gray-900 bg-white"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 bg-white"
              />
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="rounded-lg border border-gray-200 px-2 py-2 text-sm text-gray-900 bg-white"
              />
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Total Readings</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Alerts</p>
          <p className="text-2xl font-semibold text-amber-600 mt-1">{stats.alerts}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Warnings</p>
          <p className="text-2xl font-semibold text-orange-600 mt-1">{stats.warnings}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Critical</p>
          <p className="text-2xl font-semibold text-red-600 mt-1">{stats.critical}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Avg Water Level</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{stats.wlAvg} <span className="text-base font-medium text-gray-500">cm</span></p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Max Wind</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{stats.windMax} <span className="text-base font-medium text-gray-500">km/h</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Max Water Level</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">{stats.wlMax} cm</p>
          </div>
          <Waves className="h-5 w-5 text-sky-600" />
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Avg Rain Rate</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">{stats.rainAvg} mm/hr</p>
          </div>
          <Droplets className="h-5 w-5 text-cyan-600" />
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Max Rain Rate</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">{stats.rainMax} mm/hr</p>
          </div>
          <Wind className="h-5 w-5 text-blue-600" />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-gray-400" />
          <div>
            <h2 className="text-base font-medium text-gray-900">Alert Occurrences Over Time</h2>
            <p className="text-sm text-gray-500">Number of non-normal readings per day</p>
          </div>
        </div>
        <div className="p-4 sm:p-6 h-[300px]">
          {alertOccurrences.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-gray-500">No alerts in the selected range.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={alertOccurrences}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb" }} />
                <Bar dataKey="count" name="Alerts/Warnings" fill="#ef4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <FileText className="h-5 w-5 text-gray-400" />
          <div>
            <h2 className="text-base font-medium text-gray-900">Report Summary</h2>
            <p className="text-sm text-gray-500">
              {filtered.length} record(s) in selected range · Generated {mounted ? format(new Date(), "MMM dd, yyyy HH:mm") : "-"}
            </p>
          </div>
        </div>
        <div className="px-6 py-4 text-sm text-gray-600 space-y-1">
          <p>This report summarizes flood monitoring readings for the selected date range.</p>
          <p className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Export the full dataset using the buttons above.
          </p>
        </div>
      </div>
    </div>
  );
}
