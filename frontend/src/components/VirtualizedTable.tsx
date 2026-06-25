import { useRef, useCallback, type ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

interface Column<T> {
  key: string
  header: string
  width?: number
  render: (row: T) => ReactNode
}

interface Props<T> {
  columns: Column<T>[]
  data: T[]
  onRowClick?: (row: T) => void
}

export default function VirtualizedTable<T extends { id: string }>({
  columns,
  data,
  onRowClick,
}: Props<T>) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 10,
  })

  const handleClick = useCallback(
    (row: T) => {
      onRowClick?.(row)
    },
    [onRowClick],
  )

  return (
    <div ref={parentRef} className="border border-gray-200 rounded-lg overflow-auto" style={{ height: '600px' }}>
      <table className="w-full border-collapse">
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 border-b border-gray-200"
                style={{ width: col.width }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const row = data[virtualItem.index]!
            return (
              <tr
                key={row.id}
                className="hover:bg-indigo-50 cursor-pointer border-b border-gray-100"
                style={{ height: `${virtualItem.size}px`, transform: `translateY(${virtualItem.start}px)` }}
                onClick={() => handleClick(row)}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-sm text-gray-700 truncate">
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
