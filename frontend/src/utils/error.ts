export function extractError(err: any): string {
  const data = err?.response?.data

  if (data?.detail) {
    if (Array.isArray(data.detail)) {
      const msgs = data.detail.map((d: any) => {
        const field = Array.isArray(d.loc) ? d.loc.filter(Boolean).join('.') : ''
        const msg = d.msg || ''
        return field ? `${field}: ${msg}` : msg
      })
      return msgs.join('; ')
    }
    if (typeof data.detail === 'string') {
      return data.detail
    }
  }

  if (err?.code === 'ERR_NETWORK') {
    return 'Cannot connect to server'
  }

  return err?.message || 'An unexpected error occurred'
}
