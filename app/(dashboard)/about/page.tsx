"use client";

import { useState } from "react";

const developers = [
  { name: "Afuan, Jhon Lord D.", image: "/Afuan, Jhon Lord D..jpg", role: "Developer" },
  { name: "Lauan, Klarc Jimwell L.", image: "/Lauan, Klarc Jimwell L..jpg", role: "Developer" },
  { name: "Beltran, Ma. Janica L.", image: "/Beltran, Ma. Janica L..jpg", role: "Developer" },
  { name: "Delgado, Sharlene A.", image: "/Delgado, Sharlene A..jpg", role: "Developer" },
  { name: "Maggay, Precious D.", image: "/Maggay, Precious D..jpg", role: "Developer" },
];

const features = [
  "Real-time monitoring of water level, rainfall, and wind speed from field sensors.",
  "Live dashboard with trend charts for water level, rain rate, and wind speed.",
  "Automated flood status classification (Normal, Alert, Warning, Critical).",
  "Alerts and notifications for non-normal conditions with device and timestamp details.",
  "Historical data search, filtering, visualization, and export (CSV / Excel).",
  "Reports with summary statistics and alert occurrence analytics.",
  "Realtime updates via Supabase subscriptions as new readings arrive.",
  "Responsive design for desktop and mobile devices.",
];

const technologies = [
  "Next.js 16 (App Router)",
  "React 19",
  "TypeScript",
  "Tailwind CSS",
  "Supabase (PostgreSQL + Realtime)",
  "Recharts",
  "Lucide React",
  "date-fns",
  "SheetJS (xlsx)",
];

export default function AboutPage() {
  const [failed, setFailed] = useState<Record<string, boolean>>({});

  return (
    <div className="py-6 pb-10 space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">About</h1>
          <p className="text-sm text-gray-500 mt-1">
            Flood Monitoring System — project overview, features, and the development team
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-3">
        <h2 className="text-base font-medium text-gray-900">Project Overview</h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          The Flood Monitoring System is a web-based platform designed to collect, store, and visualize
          real-time environmental sensor readings from field devices deployed in San Juan, Cabagan, Isabela.
          It tracks water level, rainfall, and wind speed, classifies the overall flood status, and surfaces
          alerts so communities and responders can act quickly during heavy rain and flooding events.
        </p>
        <p className="text-sm text-gray-600 leading-relaxed">
          Developed by <span className="font-medium text-gray-900">ISU Cabagan</span> (Isabela State University —
          Cabagan Campus) as part of an academic project, the system combines a modern web frontend with a
          cloud-hosted database and realtime subscriptions to deliver up-to-date monitoring information to
          administrators and the public.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-3">
        <h2 className="text-base font-medium text-gray-900">Mission &amp; Purpose</h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          The mission of the project is to provide an accessible, reliable, and timely flood monitoring tool
          that helps reduce risk to life and property. By turning raw sensor data into clear status indicators,
          visual trends, and actionable alerts, the system supports early warning and informed decision-making
          for local authorities and residents in flood-prone areas.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-base font-medium text-gray-900 mb-3">Key Features</h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-sky-500 shrink-0" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-base font-medium text-gray-900 mb-3">Technologies Used</h2>
        <div className="flex flex-wrap gap-2">
          {technologies.map((t) => (
            <span
              key={t}
              className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700"
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-base font-medium text-gray-900 mb-2">Monitoring Location</h2>
        <p className="text-sm text-gray-600">
          San Juan, Cabagan, Isabela, Philippines
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Sensors report water level (cm), rain rate (mm/hr), rain total (mm), wind speed (km/h &amp; m/s),
          rain intensity, and device status at regular intervals.
        </p>
      </div>

      <div>
        <h2 className="text-base font-medium text-gray-900 mb-4">Development Team</h2>
        <p className="text-sm text-gray-500 mb-4">
          Developed by students of ISU Cabagan. Listed with male developers first, then female developers,
          each group in alphabetical order by last name.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {developers.map((dev) => (
            <div
              key={dev.name}
              className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col items-center text-center"
            >
              <div className="h-24 w-24 rounded-full overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center">
                {failed[dev.name] ? (
                  <span className="text-xs text-gray-400">No photo</span>
                ) : (
                  <img
                    src={encodeURI(dev.image)}
                    alt={dev.name}
                    className="h-full w-full object-cover"
                    onError={() => setFailed((prev) => ({ ...prev, [dev.name]: true }))}
                  />
                )}
              </div>
              <p className="text-sm font-medium text-gray-900 mt-3">{dev.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{dev.role}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-base font-medium text-gray-900">Acknowledgements</h2>
        <p className="text-sm text-gray-600 leading-relaxed mt-2">
          Special thanks to the faculty advisers and the Isabela State University — Cabagan Campus for
          their guidance and support throughout the development of this project. Data is provided by
          field-deployed flood monitoring devices reporting to the Supabase backend.
        </p>
      </div>
    </div>
  );
}
