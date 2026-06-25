import { useState } from 'react'
import { createLead } from '../api/leads'
import { useToast } from '../contexts/ToastContext'
import { extractError } from '../utils/error'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export default function AddLeadModal({ open, onClose, onCreated }: Props) {
  const { addToast } = useToast()
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company: '',
    source: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  if (!open) return null

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload: any = { ...form }
      if (!payload.company) payload.company = null
      if (!payload.source) payload.source = null
      if (!payload.notes) payload.notes = null
      await createLead(payload)
      addToast('Lead created successfully', 'success')
      setForm({ first_name: '', last_name: '', email: '', phone: '', company: '', source: '', notes: '' })
      onCreated()
      onClose()
    } catch (err: any) {
      addToast(extractError(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add Lead</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">First Name *</label>
              <input required value={form.first_name} onChange={set('first_name')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Last Name *</label>
              <input required value={form.last_name} onChange={set('last_name')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Email *</label>
            <input required type="email" value={form.email} onChange={set('email')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Phone *</label>
            <input required value={form.phone} onChange={set('phone')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Company</label>
            <input value={form.company} onChange={set('company')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Source</label>
            <input value={form.source} onChange={set('source')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Notes</label>
            <textarea value={form.notes} onChange={set('notes')} rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Creating...' : 'Create Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
