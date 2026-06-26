interface Props {
  status: string
  size?: 'sm' | 'md'
}

const STATUS_STYLES: Record<string, { base: string; dot: string }> = {
  new: { base: 'badge-new', dot: 'bg-blue-500' },
  contacted: { base: 'badge-contacted', dot: 'bg-amber-500' },
  qualified: { base: 'badge-qualified', dot: 'bg-purple-500' },
  proposal: { base: 'badge-proposal', dot: 'bg-indigo-500' },
  won: { base: 'badge-won', dot: 'bg-emerald-500' },
  lost: { base: 'badge-lost', dot: 'bg-rose-500' },
}

export default function StatusBadge({ status, size = 'sm' }: Props) {
  const style = STATUS_STYLES[status] || { base: 'badge bg-gray-50 text-gray-700 ring-1 ring-gray-200', dot: 'bg-gray-400' }
  const dotSize = size === 'md' ? 'w-2.5 h-2.5' : 'w-2 h-2'

  return (
    <span className={style.base}>
      <span className={`${dotSize} rounded-full ${style.dot}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}
