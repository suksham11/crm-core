import type { ReactNode } from 'react'

interface Props {
  label: string
  value: number
  color: string
  icon: ReactNode
}

export default function KpiCard({ label, value, color, icon }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex items-center gap-4">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-white ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
      </div>
    </div>
  )
}
