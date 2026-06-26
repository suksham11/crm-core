import { useState, useEffect } from "react";
import { fetchLeadStats } from "../api/leads";
import type { LeadStats } from "../api/leads";
import KpiCard from "../components/KpiCard";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  total: { label: "Total Leads", color: "bg-indigo-600", icon: "Σ" },
  new: { label: "New", color: "bg-blue-500", icon: "N" },
  contacted: { label: "Contacted", color: "bg-yellow-500", icon: "C" },
  qualified: { label: "Qualified", color: "bg-purple-500", icon: "Q" },
  proposal: { label: "Proposal", color: "bg-indigo-500", icon: "P" },
  won: { label: "Won", color: "bg-green-500", icon: "W" },
  lost: { label: "Lost", color: "bg-red-500", icon: "L" },
};

export default function Dashboard() {
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeadStats()
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-5 flex items-end justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Dashboard
        </h1>
      </div>
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {stats &&
            Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <KpiCard
                key={key}
                label={cfg.label}
                value={(stats as any)[key] ?? 0}
                gradient={cfg.color}
                icon={<span className="text-lg font-bold">{cfg.icon}</span>}
              />
            ))}
        </div>
      )}
    </div>
  );
}
