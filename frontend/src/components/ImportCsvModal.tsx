import { useState, useRef } from 'react'
import { ingestCsv } from '../api/leads'
import { useToast } from '../contexts/ToastContext'
import { extractError } from '../utils/error'

interface Props {
  open: boolean
  onClose: () => void
  onImported: () => void
}

export default function ImportCsvModal({ open, onClose, onImported }: Props) {
  const { addToast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) {
      setFile(f)
      setResult(null)
    }
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setProgress(50)
    try {
      const res = await ingestCsv(file)
      setProgress(100)
      setResult(`Imported ${res.ingested} records from ${res.filename}`)
      addToast(`Imported ${res.ingested} records`, 'success')
      onImported()
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
      setTimeout(onClose, 1500)
    } catch (err: any) {
      addToast(extractError(err), 'error')
      setResult('Import failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Import CSV</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-500">
            CSV must include headers: <code className="text-indigo-600">first_name, last_name, email, phone</code>
          </p>

          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          />

          {uploading && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {result && (
            <p className={`text-sm ${result.includes('failed') ? 'text-red-600' : 'text-green-600'}`}>
              {result}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {uploading ? 'Importing...' : 'Import'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
