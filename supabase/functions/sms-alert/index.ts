// Supabase Edge Function: sms-alert
// Triggered by a Database Webhook on INSERT into flood_readings.
// Sends SMS via UniSMS only when a threshold is newly crossed UPWARD
// (no repeat while staying at the same level; resets when level drops).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const UNISMS_URL = "https://unismsapi.com/api/sms";
const SENDER_ID = "Unisoft";

type Reading = {
  id: number;
  created_at: string;
  device_id: string | null;
  water_level_cm: number | null;
  rain_rate_mm_hr: number | null;
  wind_speed_kmh: number | null;
};

type Thresholds = {
  water_level_alert_cm: number;
  water_level_warning_cm: number;
  water_level_critical_cm: number;
  rain_rate_yellow_mmhr: number;
  rain_rate_orange_mmhr: number;
  rain_rate_red_mmhr: number;
  wind_speed_elevated_kmh: number;
  water_level_alert_enabled: boolean;
  water_level_warning_enabled: boolean;
  water_level_critical_enabled: boolean;
  rain_rate_yellow_enabled: boolean;
  rain_rate_orange_enabled: boolean;
  rain_rate_red_enabled: boolean;
  wind_speed_elevated_enabled: boolean;
  sms_recipients?: string[];
};

const SEVERITY: Record<string, number> = {
  // water level
  Normal: 0,
  Alert: 1,
  Warning: 2,
  Critical: 3,
  // rain
  "Yellow Rainfall Warning": 1,
  "Orange Rainfall Warning": 2,
  "Red Rainfall Warning": 3,
  // wind
  Elevated: 1,
};

function waterStatus(wl: number | null, t: Thresholds): string {
  if (wl == null) return "Normal";
  if (t.water_level_critical_enabled && wl >= t.water_level_critical_cm) return "Critical";
  if (t.water_level_warning_enabled && wl >= t.water_level_warning_cm) return "Warning";
  if (t.water_level_alert_enabled && wl >= t.water_level_alert_cm) return "Alert";
  return "Normal";
}

function rainStatus(rr: number | null, t: Thresholds): string {
  if (rr == null) return "Normal";
  if (t.rain_rate_red_enabled && rr >= t.rain_rate_red_mmhr) return "Red Rainfall Warning";
  if (t.rain_rate_orange_enabled && rr >= t.rain_rate_orange_mmhr) return "Orange Rainfall Warning";
  if (t.rain_rate_yellow_enabled && rr >= t.rain_rate_yellow_mmhr) return "Yellow Rainfall Warning";
  return "Normal";
}

function windStatus(ws: number | null, t: Thresholds): string {
  if (ws == null) return "Normal";
  if (t.wind_speed_elevated_enabled && ws >= t.wind_speed_elevated_kmh) return "Elevated";
  return "Normal";
}

function sev(s: string): number {
  return SEVERITY[s] ?? 0;
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const record: Reading = payload?.record ?? payload;
    if (!record || !record.id) {
      return new Response(JSON.stringify({ ok: false, error: "no record" }), { status: 400 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SERVICE_ROLE_KEY")!;
    const unismsKey = Deno.env.get("UNISMS_SECRET_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Load settings
    const { data: settingsRow } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "sms_thresholds")
      .single();
    const thresholds: Thresholds = {
      water_level_alert_cm: 50,
      water_level_warning_cm: 70,
      water_level_critical_cm: 90,
      rain_rate_yellow_mmhr: 2.5,
      rain_rate_orange_mmhr: 7.5,
      rain_rate_red_mmhr: 15,
      wind_speed_elevated_kmh: 30,
      water_level_alert_enabled: true,
      water_level_warning_enabled: true,
      water_level_critical_enabled: true,
      rain_rate_yellow_enabled: true,
      rain_rate_orange_enabled: true,
      rain_rate_red_enabled: true,
      wind_speed_elevated_enabled: true,
      ...(settingsRow?.value || {}),
    };

    // Load state
    const { data: stateRow } = await supabase
      .from("sms_alert_state")
      .select("state")
      .eq("id", 1)
      .single();
    const state = (stateRow?.state as any) || {
      water_level: "Normal",
      rain_rate: "Normal",
      wind_speed: "Normal",
      last_reading_id: null,
    };

    const curWater = waterStatus(record.water_level_cm, thresholds);
    const curRain = rainStatus(record.rain_rate_mm_hr, thresholds);
    const curWind = windStatus(record.wind_speed_kmh, thresholds);

    const lastWater = state.water_level || "Normal";
    const lastRain = state.rain_rate || "Normal";
    const lastWind = state.wind_speed || "Normal";

    const waterUp = sev(curWater) > sev(lastWater);
    const rainUp = sev(curRain) > sev(lastRain);
    const windUp = sev(curWind) > sev(lastWind);

    // New state after this reading
    const newState = {
      water_level: waterUp ? curWater : (sev(curWater) < sev(lastWater) ? curWater : lastWater),
      rain_rate: rainUp ? curRain : (sev(curRain) < sev(lastRain) ? curRain : lastRain),
      wind_speed: windUp ? curWind : (sev(curWind) < sev(lastWind) ? curWind : lastWind),
      last_reading_id: record.id,
    };

    // If any newly crossed upward, send SMS
    if (waterUp || rainUp || windUp) {
      // recipients
      let recipients: string[] = [];
      if (Array.isArray(thresholds.sms_recipients) && thresholds.sms_recipients.length) {
        recipients = thresholds.sms_recipients;
      } else {
        const { data: profs } = await supabase
          .from("profiles")
          .select("phone")
          .not("phone", "is", null);
        recipients = (profs || []).map((p: any) => p.phone).filter(Boolean);
      }

      const time = new Date(record.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" });
      const parts: string[] = [];
      if (waterUp) parts.push(`Water Level: ${curWater} (${record.water_level_cm ?? "-"} cm)`);
      if (rainUp) parts.push(`Rain: ${curRain} (${record.rain_rate_mm_hr ?? "-"} mm/hr)`);
      if (windUp) parts.push(`Wind: ${curWind} (${record.wind_speed_kmh ?? "-"} km/h)`);
      const content = `Flood Alert - San Juan, Cabagan: ${parts.join(" | ")}. Time: ${time}.`;

      for (const r of recipients) {
        try {
          const auth = btoa(`${unismsKey}:`);
          const res = await fetch(UNISMS_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Basic ${auth}`,
            },
            body: JSON.stringify({
              recipient: r,
              content,
              sender_id: SENDER_ID,
            }),
          });
          const data = await res.json().catch(() => ({}));
          await supabase.from("sms_alert_log").insert({
            recipient: r,
            content,
            status: res.ok ? "sent" : `error ${res.status}`,
            reference_id: data?.message?.reference_id ?? null,
            reading_id: record.id,
            levels: { water: curWater, rain: curRain, wind: curWind },
          });
        } catch (e) {
          await supabase.from("sms_alert_log").insert({
            recipient: r,
            content,
            status: `exception: ${String(e)}`,
            reading_id: record.id,
            levels: { water: curWater, rain: curRain, wind: curWind },
          });
        }
      }
    }

    // Update state
    await supabase
      .from("sms_alert_state")
      .update({ state: newState, updated_at: new Date().toISOString() })
      .eq("id", 1);

    return new Response(JSON.stringify({ ok: true, sent: waterUp || rainUp || windUp }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 });
  }
});
