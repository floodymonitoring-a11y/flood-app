"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import {
  AlertTriangle,
  Bell,
  Clock,
  Filter,
  Radio,
  Waves,
  Droplets,
} from "lucide-react";
import {
  getWaterLevelStatus,
  getRainfallStatus,
  getFloodWarningStatus,
  waterLevelColor,
  rainfallColor,
  floodColor,
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

type AlertLevel = "All" | "Alert" | "Warning" | "Critical";

type AlertItem = {
  id: number;
  created_at: string;
  device_id: string | null;
  water_level_cm: number | null;
  rain_rate_mm_hr: number | null;
  level: "Alert" | "Warning" | "Critical";
  message: string;
};

export default function AlertsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [readings, setReadings] = useState<FloodReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState<AlertLevel>("All");

  useEffect(() => {
    let mounted = true;
    const fetchReadings = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("flood_readings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (!error && data && mounted) {
        setReadings(data as FloodReading[]);
      }
      if (mounted) setLoading(false);
    };

    fetchReadings();

    const channel = supabase
      .channel("alerts-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "flood_readings" },
        (payload) => {
          setReadings((prev) => [payload.new as FloodReading, ...prev].slice(0, 500));
        }
      )
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") console.warn("Alerts realtime:", status);
      });

    const interval = setInterval(() => {
      if (mounted) fetchReadings();
    }, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const alerts: AlertItem[] = useMemo(() => {
    return readings
      .map((r) => {
        const wl = getWaterLevelStatus(r.water_level_cm);
        const rf = getRainfallStatus(r.rain_rate_mm_hr);
        const flood = getFloodWarningStatus(wl, rf);
        if (flood === "Normal" || flood === "Advisory") return null;
        const level = flood as "Alert" | "Warning" | "Critical";
        return {
          id: r.id,
          created_at: r.created_at,
          device_id: r.device_id,
          water_level_cm: r.water_level_cm,
          rain_rate_mm_hr: r.rain_rate_mm_hr,
          level,
          message: `Water Level: ${wl} (${r.water_level_cm ?? "-"} cm) | Rainfall: ${rf} (${r.rain_rate_mm_hr ?? "-"} mm/hr)`,
        };
      })
      .filter(Boolean) as AlertItem[];
  }, [readings]);

  const filtered = useMemo(() => {
    if (levelFilter === "All") return alerts;
    return alerts.filter((a) => a.level === levelFilter);
  }, [alerts, levelFilter]);

  const counts = useMemo(() => {
    const c = { Alert: 0, Warning: 0, Critical: 0 };
    alerts.forEach((a) => {
      c[a.level]++;
    });
    return c;
  }, [alerts]);

  if (loading) {
    return (
      <main className="py-6">
        <div className="flex items-center justify-center h-[60vh]">
          <p className="text-sm text-gray-500">Loading alerts...</p>
        </div>
      </main>
    );
  }

  return (
    <div className="py-6 pb-10 space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Alerts</h1>
          <p className="text-sm text-gray-500 mt-1">Flood alerts and notifications from sensor readings</p>
        </div>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-gray-400" />
          <span className="text-sm text-gray-500">{alerts.length} total alert(s)</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Alert</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{counts.Alert}</p>
          </div>
          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${floodColor["Alert"]}`}>Alert</span>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Warning</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{counts.Warning}</p>
          </div>
          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${floodColor["Warning"]}`}>Warning</span>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Critical</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{counts.Critical}</p>
          </div>
          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${floodColor["Critical"]}`}>Critical</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-900 mb-3">
          <Filter className="h-4 w-4" />
          Filter by level
        </div>
        <div className="flex flex-wrap gap-2">
          {(["All", "Alert", "Warning", "Critical"] as AlertLevel[]).map((lvl) => (
            <button
              key={lvl}
              onClick={() => setLevelFilter(lvl)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                levelFilter === lvl
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-medium text-gray-900">Recent Alerts</h2>
          <p className="text-sm text-gray-500">Showing {filtered.length} alert(s)</p>
        </div>
        {filtered.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-gray-500">No alerts at the moment.</p>
            <p className="text-xs text-gray-400 mt-1">System is currently normal.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((alert) => (
              <div key={alert.id} className="px-6 py-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-9 w-9 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                    <AlertTriangle className="h-4 w-4 text-rose-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${floodColor[alert.level]}`}>
                        {alert.level}
                      </span>
                      {alert.device_id && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Radio className="h-3 w-3" />
                          San Juan, Cabagan, Isabela Device 1
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-900 mt-1">{alert.message}</p>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {format(new Date(alert.created_at), "MMM dd, yyyy HH:mm:ss")}
                    </p>
                  </div>
                  <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Waves className="h-3.5 w-3.5" /> {alert.water_level_cm ?? "-"} cm
                    </span>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Droplets className="h-3.5 w-3.5" /> {alert.rain_rate_mm_hr ?? "-"} mm/hr
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
