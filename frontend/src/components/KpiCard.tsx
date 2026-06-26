import type { ReactNode } from "react";

interface Props {
  label: string;
  value: number;
  gradient: string;
  icon: ReactNode;
  subtitle?: string;
}

export default function KpiCard({
  label,
  value,
  gradient,
  icon,
  subtitle,
}: Props) {
  return (
    <div className="group card-gradient cursor-default rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:-translate-y-0.5 hover:shadow-lg sm:p-5">
      <div className="flex items-center gap-3 sm:gap-4">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm sm:h-12 sm:w-12 ${gradient} group-hover:scale-110 transition-transform duration-200`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm text-gray-500">{label}</p>
          <p className="tabular-nums text-2xl font-bold text-gray-900">
            {value.toLocaleString()}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}
