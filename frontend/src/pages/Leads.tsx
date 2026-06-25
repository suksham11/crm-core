import { useState, useEffect, useCallback, useRef } from 'react'
import VirtualizedTable from '../components/VirtualizedTable'
import LeadDrawer from '../components/LeadDrawer'
import SearchBar from '../components/SearchBar'
import AddLeadModal from '../components/AddLeadModal'
import ImportCsvModal from '../components/ImportCsvModal'
import ConfirmDialog from '../components/ConfirmDialog'
import * as leadsApi from '../api/leads'
import type { Lead } from '../api/leads'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { extractError } from '../utils/error'

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  qualified: 'bg-purple-100 text-purple-800',
  proposal: 'bg-indigo-100 text-indigo-800',
  won: 'bg-green-100 text-green-800',
  lost: 'bg-red-100 text-red-800',
}

const canDelete = (role?: string) => role === 'admin' || role === 'manager'

export default function Leads() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [leads, setLeads] = useState<Lead[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [loading, setLoading] = useState(true)
  const pageSize = 50
  const fetchIdRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  const loadLeads = useCallback(async (query: string, pageNum: number) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const id = ++fetchIdRef.current
    setLoading(true)
    try {
      const params: any = { page: pageNum, page_size: pageSize, sort_by: 'created_at', sort_order: 'desc' }
      if (query) params.search = query
      const res = await leadsApi.fetchLeads(params, controller.signal)
      if (id === fetchIdRef.current) {
        setLeads(res.items)
        setTotal(res.total)
      }
    } catch (err: any) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return
      throw err
    } finally {
      if (id === fetchIdRef.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    loadLeads(search, page)
    return () => abortRef.current?.abort()
  }, [search, page, loadLeads])

  function handleSearch(query: string) {
    setSearch(query)
    setPage(1)
  }

  function handleRowClick(lead: Lead) {
    setSelectedLead(lead)
    setDrawerOpen(true)
  }

  function handleUpdated(lead: Lead) {
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? lead : l)))
    addToast('Lead updated', 'success')
  }

  function handleCreated() {
    setPage(1)
    loadLeads(search, 1)
  }

  function handleImported() {
    setPage(1)
    loadLeads(search, 1)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await leadsApi.deleteLead(deleteTarget.id)
      addToast('Lead deleted', 'success')
      setDeleteTarget(null)
      loadLeads(search, page)
    } catch (err: any) {
      addToast(extractError(err), 'error')
    } finally {
      setDeleting(false)
    }
  }

  const columns = [
    { key: 'name', header: 'Name', width: 180, render: (r: Lead) => `${r.first_name} ${r.last_name}` },
    { key: 'email', header: 'Email', width: 220, render: (r: Lead) => r.email },
    { key: 'phone', header: 'Phone', width: 140, render: (r: Lead) => r.phone },
    { key: 'company', header: 'Company', width: 150, render: (r: Lead) => r.company || '—' },
    {
      key: 'status',
      header: 'Status',
      width: 110,
      render: (r: Lead) => (
        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] || ''}`}>
          {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
        </span>
      ),
    },
    { key: 'created_at', header: 'Created', width: 130, render: (r: Lead) => new Date(r.created_at).toLocaleDateString() },
    {
      key: 'actions',
      header: '',
      width: 90,
      render: (r: Lead) => (
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => { setSelectedLead(r); setDrawerOpen(true) }}
            className="px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded"
          >
            Edit
          </button>
          {canDelete(user?.role) && (
            <button
              onClick={() => setDeleteTarget(r)}
              className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
            >
              Delete
            </button>
          )}
        </div>
      ),
    },
  ]

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Leads</h1>
        <div className="flex items-center gap-3">
          <SearchBar onSearch={handleSearch} />
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAddModalOpen(true)}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
          >
            + Add Lead
          </button>
          <button
            onClick={() => setImportModalOpen(true)}
            className="px-4 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
          >
            Import CSV
          </button>
        </div>
        <span className="text-sm text-gray-500">{total.toLocaleString()} total</span>
      </div>

      {loading ? (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <div className="h-4 bg-gray-200 rounded w-1/4 animate-pulse" />
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-4 py-3 border-b border-gray-100">
              <div className="h-4 bg-gray-100 rounded w-3/4 animate-pulse" />
            </div>
          ))}
        </div>
      ) : leads.length === 0 ? (
        <div className="border border-gray-200 rounded-lg bg-white p-12 text-center">
          <p className="text-gray-400 text-lg mb-2">No leads found</p>
          <p className="text-gray-400 text-sm mb-4">
            {search ? 'Try a different search term' : 'Add your first lead to get started.'}
          </p>
          {!search && (
            <button
              onClick={() => setAddModalOpen(true)}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              + Add Lead
            </button>
          )}
        </div>
      ) : (
        <VirtualizedTable columns={columns} data={leads} onRowClick={handleRowClick} />
      )}

      {!loading && leads.length > 0 && (
        <div className="flex items-center justify-between mt-4">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            Page {page} of {totalPages.toLocaleString()}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}

      <LeadDrawer
        lead={selectedLead}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onUpdated={handleUpdated}
      />
      <AddLeadModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onCreated={handleCreated}
      />
      <ImportCsvModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImported={handleImported}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Lead"
        message={`Are you sure you want to delete ${deleteTarget?.first_name} ${deleteTarget?.last_name}? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  )
}
