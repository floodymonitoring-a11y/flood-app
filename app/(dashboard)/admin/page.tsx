"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  Shield,
  Users,
  Settings,
  Save,
  Trash2,
  Edit2,
  X,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  role: string;
  created_at: string;
};

type SmsThresholds = {
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
};

const DEFAULT_THRESHOLDS: SmsThresholds = {
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
};

export default function AdminPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileRole, setProfileRole] = useState<string | null>(null);
  const [tab, setTab] = useState<"users" | "settings">("users");

  // Users state
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState("user");
  const [searchQuery, setSearchQuery] = useState("");
  const editingProfile = profiles.find((p) => p.id === editingId) || null;

  const filteredProfiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) => {
      const name = (p.full_name || "").toLowerCase();
      const email = (p.email || "").toLowerCase();
      const phone = (p.phone || "").toLowerCase();
      const role = (p.role || "").toLowerCase();
      return name.includes(q) || email.includes(q) || phone.includes(q) || role.includes(q);
    });
  }, [profiles, searchQuery]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Settings state
  const [thresholds, setThresholds] = useState<SmsThresholds>(DEFAULT_THRESHOLDS);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        router.replace("/login");
        return;
      }
      setCurrentUserId(user.id);
      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (!active) return;
      if (pErr) setProfileError(pErr.message);
      setProfileRole(profile?.role ?? null);
      const admin = profile?.role === "admin";
      setIsAdmin(admin);
      setChecking(false);
      if (!admin) return;
      // load data
      loadUsers();
      loadSettings();
    };
    init();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, router]);

  const loadUsers = async () => {
    setUsersLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, phone, role, created_at")
      .order("created_at", { ascending: false });
    if (!error && data) setProfiles(data as Profile[]);
    setUsersLoading(false);
  };

  const loadSettings = async () => {
    setSettingsLoading(true);
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "sms_thresholds")
      .single();
    if (!error && data?.value) {
      setThresholds({ ...DEFAULT_THRESHOLDS, ...(data.value as Partial<SmsThresholds>) });
    }
    setSettingsLoading(false);
  };

  const startEdit = (p: Profile) => {
    setEditingId(p.id);
    setEditName(p.full_name || "");
    setEditPhone(p.phone || "");
    setEditRole(p.role);
    setMessage(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditPhone("");
    setEditRole("user");
  };

  const saveEdit = async (id: string) => {
    setSaving(true);
    setMessage(null);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: editName, phone: editPhone, role: editRole, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      setMessage({ type: "err", text: error.message });
    } else {
      setMessage({ type: "ok", text: "User updated successfully." });
      setProfiles((prev) =>
        prev.map((p) => (p.id === id ? { ...p, full_name: editName, phone: editPhone, role: editRole } : p))
      );
      cancelEdit();
    }
    setSaving(false);
  };

  const deleteUser = async (id: string) => {
    if (id === currentUserId) {
      setMessage({ type: "err", text: "You cannot delete your own account." });
      return;
    }
    if (!confirm("Delete this user's profile? This cannot be undone.")) return;
    const { error } = await supabase.from("profiles").delete().eq("id", id);
    if (error) {
      setMessage({ type: "err", text: error.message });
    } else {
      setMessage({ type: "ok", text: "User profile deleted." });
      setProfiles((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const saveSettings = async () => {
    setSettingsSaving(true);
    setMessage(null);
    const { error } = await supabase
      .from("app_settings")
      .upsert(
        {
          key: "sms_thresholds",
          value: thresholds,
          updated_at: new Date().toISOString(),
          updated_by: currentUserId,
        },
        { onConflict: "key" }
      );
    if (error) {
      setMessage({ type: "err", text: error.message });
    } else {
      setMessage({ type: "ok", text: "Settings saved. (SMS integration is not yet enabled.)" });
    }
    setSettingsSaving(false);
  };

  if (checking) {
    return (
      <main className="py-6">
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="py-6">
        <div className="flex flex-col items-center justify-center h-[60vh] gap-3 text-center px-4">
          <Shield className="h-10 w-10 text-red-500" />
          <h1 className="text-xl font-semibold text-gray-900">Access Denied</h1>
          <p className="text-sm text-gray-500">You do not have administrator privileges.</p>
          <div className="mt-4 text-xs text-gray-400 space-y-1 max-w-md">
            <p>User ID: {currentUserId || "-"}</p>
            <p>Profile role found: {profileRole || "(none)"}</p>
            {profileError && <p className="text-red-500">Error: {profileError}</p>}
            <p className="mt-2">
              If the role is not &quot;admin&quot;, run in Supabase SQL Editor:
            </p>
            <code className="block bg-gray-100 rounded px-2 py-1 text-gray-700">
              update public.profiles set role = &apos;admin&apos; where id = &apos;{currentUserId}&apos;;
            </code>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="py-6 pb-10 space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Admin Panel</h1>
          <p className="text-sm text-gray-500 mt-1">Manage users and system settings</p>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-gray-400" />
          <span className="text-sm text-gray-500">Administrator</span>
        </div>
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
            message.type === "ok"
              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {message.type === "ok" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          {message.text}
        </div>
      )}

      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setTab("users")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "users"
              ? "border-gray-900 text-gray-900"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <Users className="h-4 w-4" /> Users
        </button>
        <button
          onClick={() => setTab("settings")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "settings"
              ? "border-gray-900 text-gray-900"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <Settings className="h-4 w-4" /> Settings
        </button>
      </div>

      {tab === "users" && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-medium text-gray-900">User Management</h2>
                <p className="text-sm text-gray-500">
                  {filteredProfiles.length} of {profiles.length} user(s)
                </p>
              </div>
              <button
                onClick={loadUsers}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Refresh
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, CP number, or role..."
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
              <button
                onClick={() => setSearchQuery(searchQuery.trim())}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-gray-900 text-white hover:bg-gray-800"
              >
                Search
              </button>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Clear
              </button>
              )}
            </div>
          </div>
          {usersLoading ? (
            <div className="px-6 py-10 text-center text-sm text-gray-500">Loading users...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left font-medium text-gray-600 px-6 py-3">Email</th>
                    <th className="text-left font-medium text-gray-600 px-6 py-3">Full Name</th>
                    <th className="text-left font-medium text-gray-600 px-6 py-3">CP Number</th>
                    <th className="text-left font-medium text-gray-600 px-6 py-3">Role</th>
                    <th className="text-left font-medium text-gray-600 px-6 py-3">Created</th>
                    <th className="text-right font-medium text-gray-600 px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredProfiles.map((p) => (
                    <tr key={p.id}>
                      <td className="px-6 py-3 text-gray-900">{p.email || "-"}</td>
                      <td className="px-6 py-3">
                        <span className="text-gray-900">{p.full_name || "-"}</span>
                      </td>
                      <td className="px-6 py-3">
                        <span className="text-gray-900">{p.phone || "-"}</span>
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${
                            p.role === "admin"
                              ? "bg-sky-50 text-sky-700 border-sky-200"
                              : "bg-gray-50 text-gray-600 border-gray-200"
                          }`}
                        >
                          {p.role}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-500">
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => startEdit(p)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                          >
                            <Edit2 className="h-3 w-3" /> Edit
                          </button>
                          <button
                            onClick={() => deleteUser(p.id)}
                            disabled={p.id === currentUserId}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredProfiles.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-500">
                        No users found. Make sure the profiles table exists (see supabase_admin.sql).
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {editingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-medium text-gray-900">Edit User</h3>
              <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500">{editingProfile.email}</p>
            <label className="space-y-1 block">
              <span className="text-xs font-medium text-gray-700">Full Name</span>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                placeholder="Enter full name"
              />
            </label>
            <label className="space-y-1 block">
              <span className="text-xs font-medium text-gray-700">CP Number (Philippine mobile)</span>
              <input
                type="tel"
                inputMode="numeric"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                placeholder="09XXXXXXXXX"
              />
            </label>
            <label className="space-y-1 block">
              <span className="text-xs font-medium text-gray-700">Role</span>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              >
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
            </label>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={cancelEdit}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => saveEdit(editingProfile.id)}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "settings" && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-6">
          <div>
            <h2 className="text-base font-medium text-gray-900">SMS Alert Thresholds</h2>
            <p className="text-sm text-gray-500 mt-1">
              Configure the thresholds that trigger SMS alerts. SMS integration is not yet enabled — these
              values are stored for future use.
            </p>
          </div>

          {settingsLoading ? (
            <div className="text-sm text-gray-500">Loading settings...</div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="space-y-1 block">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700">Water Level — Alert (cm)</span>
                    <label className="flex items-center gap-1 text-xs text-gray-500">
                      <input
                        type="checkbox"
                        checked={thresholds.water_level_alert_enabled}
                        onChange={(e) =>
                          setThresholds({ ...thresholds, water_level_alert_enabled: e.target.checked })
                        }
                        className="h-4 w-4"
                      />
                      Enable
                    </label>
                  </div>
                  <input
                    type="number"
                    value={thresholds.water_level_alert_cm}
                    onChange={(e) =>
                      setThresholds({ ...thresholds, water_level_alert_cm: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  />
                </label>
                <label className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700">Water Level — Warning (cm)</span>
                    <label className="flex items-center gap-1 text-xs text-gray-500">
                      <input
                        type="checkbox"
                        checked={thresholds.water_level_warning_enabled}
                        onChange={(e) =>
                          setThresholds({ ...thresholds, water_level_warning_enabled: e.target.checked })
                        }
                        className="h-4 w-4"
                      />
                      Enable
                    </label>
                  </div>
                  <input
                    type="number"
                    value={thresholds.water_level_warning_cm}
                    onChange={(e) =>
                      setThresholds({ ...thresholds, water_level_warning_cm: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  />
                </label>
                <label className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700">Water Level — Critical (cm)</span>
                    <label className="flex items-center gap-1 text-xs text-gray-500">
                      <input
                        type="checkbox"
                        checked={thresholds.water_level_critical_enabled}
                        onChange={(e) =>
                          setThresholds({ ...thresholds, water_level_critical_enabled: e.target.checked })
                        }
                        className="h-4 w-4"
                      />
                      Enable
                    </label>
                  </div>
                  <input
                    type="number"
                    value={thresholds.water_level_critical_cm}
                    onChange={(e) =>
                      setThresholds({ ...thresholds, water_level_critical_cm: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  />
                </label>
                <label className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700">Wind Speed — Elevated (km/h)</span>
                    <label className="flex items-center gap-1 text-xs text-gray-500">
                      <input
                        type="checkbox"
                        checked={thresholds.wind_speed_elevated_enabled}
                        onChange={(e) =>
                          setThresholds({ ...thresholds, wind_speed_elevated_enabled: e.target.checked })
                        }
                        className="h-4 w-4"
                      />
                      Enable
                    </label>
                  </div>
                  <input
                    type="number"
                    value={thresholds.wind_speed_elevated_kmh}
                    onChange={(e) =>
                      setThresholds({ ...thresholds, wind_speed_elevated_kmh: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  />
                </label>
                <label className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700">Rain Rate — Yellow (mm/hr)</span>
                    <label className="flex items-center gap-1 text-xs text-gray-500">
                      <input
                        type="checkbox"
                        checked={thresholds.rain_rate_yellow_enabled}
                        onChange={(e) =>
                          setThresholds({ ...thresholds, rain_rate_yellow_enabled: e.target.checked })
                        }
                        className="h-4 w-4"
                      />
                      Enable
                    </label>
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    value={thresholds.rain_rate_yellow_mmhr}
                    onChange={(e) =>
                      setThresholds({ ...thresholds, rain_rate_yellow_mmhr: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  />
                </label>
                <label className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700">Rain Rate — Orange (mm/hr)</span>
                    <label className="flex items-center gap-1 text-xs text-gray-500">
                      <input
                        type="checkbox"
                        checked={thresholds.rain_rate_orange_enabled}
                        onChange={(e) =>
                          setThresholds({ ...thresholds, rain_rate_orange_enabled: e.target.checked })
                        }
                        className="h-4 w-4"
                      />
                      Enable
                    </label>
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    value={thresholds.rain_rate_orange_mmhr}
                    onChange={(e) =>
                      setThresholds({ ...thresholds, rain_rate_orange_mmhr: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  />
                </label>
                <label className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700">Rain Rate — Red (mm/hr)</span>
                    <label className="flex items-center gap-1 text-xs text-gray-500">
                      <input
                        type="checkbox"
                        checked={thresholds.rain_rate_red_enabled}
                        onChange={(e) =>
                          setThresholds({ ...thresholds, rain_rate_red_enabled: e.target.checked })
                        }
                        className="h-4 w-4"
                      />
                      Enable
                    </label>
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    value={thresholds.rain_rate_red_mmhr}
                    onChange={(e) =>
                      setThresholds({ ...thresholds, rain_rate_red_mmhr: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  />
                </label>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={saveSettings}
                  disabled={settingsSaving}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {settingsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Settings
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
