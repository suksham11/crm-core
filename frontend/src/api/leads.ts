import client from './client'

export interface Lead {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  company: string | null
  status: string
  source: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface LeadListResponse {
  items: Lead[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface LeadCreate {
  first_name: string
  last_name: string
  email: string
  phone: string
  company?: string | null
  source?: string | null
  notes?: string | null
}

export interface LeadUpdate {
  first_name?: string
  last_name?: string
  company?: string | null
  status?: string
  notes?: string | null
}

export async function fetchLeads(
  params: {
    page?: number
    page_size?: number
    search?: string
    status?: string
    sort_by?: string
    sort_order?: string
  },
  signal?: AbortSignal,
): Promise<LeadListResponse> {
  const res = await client.get('/leads', { params, signal })
  return res.data
}

export interface LeadStats {
  total: number
  new: number
  contacted: number
  qualified: number
  proposal: number
  won: number
  lost: number
}

export async function fetchLeadStats(signal?: AbortSignal): Promise<LeadStats> {
  const statuses = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost']
  const totalRes = await client.get('/leads', { params: { page: 1, page_size: 1 }, signal })
  const counts: Record<string, number> = { total: totalRes.data.total }
  const results = await Promise.all(
    statuses.map((s) => client.get('/leads', { params: { page: 1, page_size: 1, status: s }, signal })),
  )
  statuses.forEach((s, i) => {
    counts[s] = results[i]!.data.total
  })
  return counts as LeadStats
}

export async function fetchLead(id: string): Promise<Lead> {
  const res = await client.get(`/leads/${id}`)
  return res.data
}

export async function createLead(data: LeadCreate): Promise<Lead> {
  const res = await client.post('/leads', data)
  return res.data
}

export async function updateLead(id: string, data: LeadUpdate): Promise<Lead> {
  const res = await client.patch(`/leads/${id}`, data)
  return res.data
}

export async function ingestCsv(file: File): Promise<{ ingested: number; filename: string }> {
  const form = new FormData()
  form.append('file', file)
  const res = await client.post('/leads/bulk-ingest', form)
  return res.data
}

export async function deleteLead(id: string): Promise<void> {
  await client.delete(`/leads/${id}`)
}
