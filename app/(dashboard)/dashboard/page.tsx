"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import {
  Activity,
  AlertTriangle,
  Clock,
  Droplets,
  MapPin,
  MessageSquare,
  Radio,
  Waves,
  Wind,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  getWaterLevelStatus,
  getRainfallStatus,
  getWindSpeedStatus,
  getCommStatus,
  getFloodWarningStatus,
  getSmsAlertStatus,
  waterLevelColor,
  rainfallColor,
  windColor,
  floodColor,
  commColor,
  smsColor,
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

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const [readings, setReadings] = useState<FloodReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let mounted = true;
    const fetchReadings = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("flood_readings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (!error && data && mounted) {
        setReadings(data as FloodReading[]);
      }
      if (mounted) {
        setLoading(false);
      }
    };

    fetchReadings();

    const channel = supabase
      .channel("flood-readings-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "flood_readings" },
        (payload) => {
          setReadings((prev) => [payload.new as FloodReading, ...prev].slice(0, 50));
        }
      )
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") {
          console.warn("Realtime status:", status);
        }
      });

    // Polling fallback in case realtime is unavailable
    const interval = setInterval(() => {
      if (mounted) fetchReadings();
    }, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const latest = readings[0];
  const history = useMemo(
    () =>
      [...readings]
        .slice(0, 15)
        .reverse()
        .map((r) => ({
          time: format(new Date(r.created_at), "HH:mm"),
          fullTime: format(new Date(r.created_at), "MMM dd, yyyy HH:mm:ss"),
          water_level_cm: r.water_level_cm ?? 0,
          rain_rate_mm_hr: r.rain_rate_mm_hr ?? 0,
          wind_speed_kmh: r.wind_speed_kmh ?? 0,
        })),
    [readings]
  );

  const recentAlerts = useMemo(() => {
    return readings
      .map((r) => {
        const wl = getWaterLevelStatus(r.water_level_cm);
        const rf = getRainfallStatus(r.rain_rate_mm_hr);
        const flood = getFloodWarningStatus(wl, rf);
        if (flood === "Normal") return null;
        return {
          id: r.id,
          time: format(new Date(r.created_at), "MMM dd, yyyy HH:mm:ss"),
          message: `Flood Status: ${flood} | Water Level: ${wl} (${r.water_level_cm ?? "-"} cm) | Rainfall: ${rf} (${r.rain_rate_mm_hr ?? "-"} mm/hr)`,
          level: flood,
        };
      })
      .filter(Boolean)
      .slice(0, 5);
  }, [readings]);

  const wlStatus = getWaterLevelStatus(latest?.water_level_cm);
  const rfStatus = getRainfallStatus(latest?.rain_rate_mm_hr);
  const wsStatus = getWindSpeedStatus(latest?.wind_speed_kmh);
  const commStatus = mounted ? getCommStatus(latest?.created_at) : "Offline";
  const floodStatus = getFloodWarningStatus(wlStatus, rfStatus);
  const smsStatus = getSmsAlertStatus(floodStatus);

  if (loading && !latest) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-center h-[60vh]">
          <p className="text-sm text-gray-500">Loading flood monitoring data...</p>
        </div>
      </main>
    );
  }

  return (
    <div className="py-6 pb-10 space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
            <MapPin className="h-4 w-4" />
            Monitoring Location: San Juan, Cabagan, Isabela
          </p>
        </div>
        <div className="text-sm text-gray-500 flex items-center gap-1.5">
          <Clock className="h-4 w-4" />
          Latest Reading:{" "}
          {latest ? format(new Date(latest.created_at), "MMM dd, yyyy HH:mm:ss") : "-"}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Current Water Level</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">
                {latest?.water_level_cm ?? "-"} <span className="text-base font-medium text-gray-500">cm</span>
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-sky-50 flex items-center justify-center">
              <Waves className="h-5 w-5 text-sky-600" />
            </div>
          </div>
          <div className="mt-3">
            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${waterLevelColor[wlStatus]}`}>
              {wlStatus}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Current Rainfall (Rain Rate)</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">
                {latest?.rain_rate_mm_hr ?? "-"} <span className="text-base font-medium text-gray-500">mm/hr</span>
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-cyan-50 flex items-center justify-center">
              <Droplets className="h-5 w-5 text-cyan-600" />
            </div>
          </div>
          <div className="mt-3">
            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${rainfallColor[rfStatus]}`}>
              {rfStatus}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Current Wind Speed</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">
                {latest?.wind_speed_kmh ?? "-"} <span className="text-base font-medium text-gray-500">km/h</span>
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
              <Wind className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          <div className="mt-3">
            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${windColor[wsStatus]}`}>
              {wsStatus}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Current Flood / Warning Status</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">{floodStatus}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-rose-50 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
            </div>
          </div>
          <div className="mt-3">
            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${floodColor[floodStatus]}`}>
              Overall System Status
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">SMS Alert Status</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">Auto-triggered on Alert/Warning/Critical</p>
          </div>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-gray-400" />
            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${smsColor[smsStatus]}`}>
              {smsStatus}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">System Communication Status</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">Status</p>
          </div>
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-gray-400" />
            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${commColor[commStatus]}`}>
              {commStatus}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Device ID</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">{latest?.device_id ? "San Juan, Cabagan, Isabela Device 1" : "N/A"}</p>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-gray-400" />
            <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs bg-gray-50 text-gray-600 border-gray-200">
              {latest?.rain_intensity ? `Intensity: ${latest.rain_intensity}` : "Intensity: -"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-medium text-gray-900">Water Level vs. Time</h2>
                <p className="text-sm text-gray-500">Trend based on recent readings</p>
              </div>
            </div>
            <div className="p-4 sm:p-6 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="time" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" unit=" cm" />
                  <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb" }} labelFormatter={(_, payload) => payload?.[0]?.payload?.fullTime || ""} />
                  <Legend />
                  <Line type="monotone" dataKey="water_level_cm" name="Water Level (cm)" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-base font-medium text-gray-900">Rainfall vs. Time</h2>
                <p className="text-sm text-gray-500">Rain rate in mm/hr</p>
              </div>
              <div className="p-4 sm:p-6 h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="time" tick={{ fontSize: 12 }} stroke="#94a3b8" />
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
                <p className="text-sm text-gray-500">Wind speed in km/h</p>
              </div>
              <div className="p-4 sm:p-6 h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="time" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" unit=" km/h" />
                    <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb" }} labelFormatter={(_, payload) => payload?.[0]?.payload?.fullTime || ""} />
                    <Legend />
                    <Line type="monotone" dataKey="wind_speed_kmh" name="Wind Speed (km/h)" stroke="#2563eb" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6 xl:sticky xl:top-20 xl:self-start">
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-medium text-gray-900">Recent Alerts</h2>
              <p className="text-sm text-gray-500">Top 5 latest alerts</p>
            </div>
            <div className="divide-y divide-gray-100">
              {recentAlerts.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <p className="text-sm text-gray-500">No active alerts at the moment.</p>
                  <p className="text-xs text-gray-400 mt-1">System is currently normal.</p>
                </div>
              ) : (
                recentAlerts.map((alert: any) => (
                  <div key={alert.id} className="px-6 py-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 h-8 w-8 rounded-full bg-rose-50 flex items-center justify-center">
                        <AlertTriangle className="h-4 w-4 text-rose-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">{alert.message}</p>
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {alert.time}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-medium text-gray-900">Status Legend</h2>
              <p className="text-sm text-gray-500">Quick reference</p>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Water Level</p>
                <div className="flex flex-wrap gap-2">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${waterLevelColor["Normal"]}`}>Normal</span>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${waterLevelColor["Alert"]}`}>Alert</span>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${waterLevelColor["Warning"]}`}>Warning</span>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${waterLevelColor["Critical"]}`}>Critical</span>
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Rainfall (mm/hr)</p>
                <div className="flex flex-wrap gap-2">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${rainfallColor["Normal"]}`}>Normal</span>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${rainfallColor["Yellow Rainfall Warning"]}`}>Yellow</span>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${rainfallColor["Orange Rainfall Warning"]}`}>Orange</span>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${rainfallColor["Red Rainfall Warning"]}`}>Red</span>
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Wind Speed</p>
                <div className="flex flex-wrap gap-2">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${windColor["Normal"]}`}>Normal</span>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${windColor["Elevated"]}`}>Elevated</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

