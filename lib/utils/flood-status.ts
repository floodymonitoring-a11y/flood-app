import { differenceInSeconds } from "date-fns";

export type WaterLevelStatus = "Normal" | "Alert" | "Warning" | "Critical";
export type RainfallStatus =
  | "Normal"
  | "Yellow Rainfall Warning"
  | "Orange Rainfall Warning"
  | "Red Rainfall Warning";
export type WindSpeedStatus = "Normal" | "Elevated";
export type CommStatus = "Online" | "Offline";

export function getWaterLevelStatus(cm: number | null | undefined): WaterLevelStatus {
  if (cm === null || cm === undefined) return "Normal";
  if (cm >= 90) return "Critical";
  if (cm >= 70) return "Warning";
  if (cm >= 50) return "Alert";
  return "Normal";
}

export function getRainfallStatus(mmHr: number | null | undefined): RainfallStatus {
  if (mmHr === null || mmHr === undefined) return "Normal";
  if (mmHr > 15) return "Red Rainfall Warning";
  if (mmHr >= 7.5) return "Orange Rainfall Warning";
  if (mmHr >= 2.5) return "Yellow Rainfall Warning";
  return "Normal";
}

export function getWindSpeedStatus(kmh: number | null | undefined): WindSpeedStatus {
  if (kmh === null || kmh === undefined) return "Normal";
  if (kmh >= 30) return "Elevated";
  return "Normal";
}

export function getCommStatus(lastDate: string | Date | null | undefined): CommStatus {
  if (!lastDate) return "Offline";
  try {
    const diff = differenceInSeconds(new Date(), new Date(lastDate));
    if (diff <= 100) return "Online";
    return "Offline";
  } catch {
    return "Offline";
  }
}

export function getFloodWarningStatus(
  water: WaterLevelStatus,
  rain: RainfallStatus
): "Normal" | "Advisory" | "Alert" | "Warning" | "Critical" {
  if (water === "Critical" || rain === "Red Rainfall Warning") return "Critical";
  if (water === "Warning" || rain === "Orange Rainfall Warning") return "Warning";
  if (water === "Alert" || rain === "Yellow Rainfall Warning") return "Alert";
  return "Normal";
}

export function getSmsAlertStatus(
  flood: "Normal" | "Advisory" | "Alert" | "Warning" | "Critical"
): "Standby" | "Active" {
  if (flood === "Critical" || flood === "Warning" || flood === "Alert") return "Active";
  return "Standby";
}

export const waterLevelColor: Record<WaterLevelStatus, string> = {
  Normal: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Alert: "bg-amber-50 text-amber-700 border-amber-200",
  Warning: "bg-orange-50 text-orange-700 border-orange-200",
  Critical: "bg-red-50 text-red-700 border-red-200",
};

export const rainfallColor: Record<RainfallStatus, string> = {
  Normal: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Yellow Rainfall Warning": "bg-yellow-50 text-yellow-800 border-yellow-200",
  "Orange Rainfall Warning": "bg-orange-50 text-orange-700 border-orange-200",
  "Red Rainfall Warning": "bg-red-50 text-red-700 border-red-200",
};

export const windColor: Record<WindSpeedStatus, string> = {
  Normal: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Elevated: "bg-amber-50 text-amber-700 border-amber-200",
};

export const floodColor: Record<string, string> = {
  Normal: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Advisory: "bg-sky-50 text-sky-700 border-sky-200",
  Alert: "bg-amber-50 text-amber-700 border-amber-200",
  Warning: "bg-orange-50 text-orange-700 border-orange-200",
  Critical: "bg-red-50 text-red-700 border-red-200",
};

export const commColor: Record<CommStatus, string> = {
  Online: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Offline: "bg-red-50 text-red-700 border-red-200",
};

export const smsColor: Record<string, string> = {
  Standby: "bg-gray-50 text-gray-600 border-gray-200",
  Active: "bg-red-50 text-red-700 border-red-200",
};
