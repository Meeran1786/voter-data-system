'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Upload, X, FileText, CheckCircle2, AlertCircle, Loader2, RefreshCw, Link, Download } from 'lucide-react'
import { uploadFile, getUploadJob, listUploadJobs } from '@/lib/api'
import type { UploadJob } from '@/types/voter'

interface Props {
  onClose: () => void
  onUploadComplete: () => void
}

const ACCEPT = '.csv,.xlsx,.xls,.docx,.doc,.pdf,.png,.jpg,.jpeg,.tiff,.bmp,.webp'

const FORMAT_INFO: Record<string, { color: string; bg: string }> = {
  csv:  { color: 'text-green-700',   bg: 'bg-green-50'   },
  xlsx: { color: 'text-emerald-700', bg: 'bg-emerald-50' },
  xls:  { color: 'text-emerald-700', bg: 'bg-emerald-50' },
  pdf:  { color: 'text-red-700',     bg: 'bg-red-50'     },
  docx: { color: 'text-blue-700',    bg: 'bg-blue-50'    },
  doc:  { color: 'text-blue-700',    bg: 'bg-blue-50'    },
  png:  { color: 'text-purple-700',  bg: 'bg-purple-50'  },
  jpg:  { color: 'text-purple-700',  bg: 'bg-purple-50'  },
  jpeg: { color: 'text-purple-700',  bg: 'bg-purple-50'  },
}

// Telangana CEO direct roll download links (by district)
const TELANGANA_LINKS = [
  { label: 'CEO Telangana — Electoral Rolls Portal', url: 'https://ceotelangana.nic.in' },
  { label: 'ECI Voter Services Portal', url: 'https://voters.eci.gov.in' },
]

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function StatusBadge({ status }: { status: UploadJob['status'] }) {
  const map = {
    pending:    { icon: <Loader2 className="w-3 h-3 animate-spin" />, label: 'Pending',    cls: 'text-slate-500 bg-slate-100' },
    processing: { icon: <Loader2 className="w-3 h-3 animate-spin" />, label: 'Processing', cls: 'text-blue-600 bg-blue-50' },
    done:       { icon: <CheckCircle2 className="w-3 h-3" />,          label: 'Done',       cls: 'text-green-600 bg-green-50' },
    failed:     { icon: <AlertCircle className="w-3 h-3" />,           label: 'Failed',     cls: 'text-red-600 bg-red-50' },
  }
  const { icon, label, cls } = map[status]
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
      {icon}{label}
    </span>
  )
}

function JobRow({ job, onRefresh }: { job: UploadJob; onRefresh: () => void }) {
  const fmt = job.file_format
  const style = FORMAT_INFO[fmt] ?? { color: 'text-slate-700', bg: 'bg-slate-50' }
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 bg-white">
      <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${style.bg}`}>
        <FileText className={`w-4 h-4 ${style.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-800 truncate">{job.filename}</p>
          {job.file_size_bytes && (
            <span className="text-xs text-slate-400 shrink-0">{formatBytes(job.file_size_bytes)}</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <StatusBadge status={job.status} />
          {job.status === 'done' && (
            <span className="text-xs text-slate-500">
              {job.records_inserted.toLocaleString()} inserted
              {job.records_skipped > 0 && `, ${job.records_skipped} skipped`}
            </span>
          )}
          {job.status === 'failed' && (
            <span className="text-xs text-red-500 truncate">{job.error_message}</span>
          )}
        </div>
      </div>
      {(job.status === 'processing' || job.status === 'pending') && (
        <button onClick={onRefresh} className="text-slate-400 hover:text-slate-600">
          <RefreshCw className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

export default function UploadModal({ onClose, onUploadComplete }: Props) {
  const [tab, setTab] = useState<'file' | 'url'>('file')
  const [isDragging, setIsDragging] = useState(false)
  const [jobs, setJobs] = useState<UploadJob[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const [urlFilename, setUrlFilename] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const loadJobs = useCallback(async () => {
    try {
      const data = await listUploadJobs()
      setJobs(data)
      if (data.some((j) => j.status === 'processing' || j.status === 'pending')) {
        pollRef.current = setTimeout(loadJobs, 2000)
      } else if (data.some((j) => j.status === 'done')) {
        onUploadComplete()
      }
    } catch { /* ignore */ }
  }, [onUploadComplete])

  useEffect(() => {
    loadJobs()
    return () => { if (pollRef.current) clearTimeout(pollRef.current) }
  }, [loadJobs])

  const handleFiles = async (files: FileList | File[]) => {
    const fileArr = Array.from(files)
    if (!fileArr.length) return
    setError(null)
    setUploading(true)
    try {
      for (const file of fileArr) await uploadFile(file)
      await loadJobs()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleUrlImport = async () => {
    if (!urlInput.trim()) return
    setError(null)
    setUploading(true)
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
    try {
      const res = await fetch(`${apiBase}/api/upload/from-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: urlInput.trim(),
          filename: urlFilename.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        const detail = data.detail
        throw new Error(
          Array.isArray(detail)
            ? detail.map((e: any) => e.msg ?? String(e)).join('; ')
            : typeof detail === 'string' ? detail : 'Import failed'
        )
      }
      setUrlInput('')
      setUrlFilename('')
      await loadJobs()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Import Voter Data</h2>
            <p className="text-xs text-slate-500 mt-0.5">CSV, Excel, DOCX, PDF, or scanned images</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          <button
            onClick={() => setTab('file')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors border-b-2
              ${tab === 'file' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            <Upload className="w-4 h-4" /> Upload File
          </button>
          <button
            onClick={() => setTab('url')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors border-b-2
              ${tab === 'url' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            <Link className="w-4 h-4" /> Import from URL
          </button>
        </div>

        <div className="p-6">
          {/* ── File Upload Tab ── */}
          {tab === 'file' && (
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files) }}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                  ${isDragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'}`}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isDragging ? 'bg-blue-100' : 'bg-slate-100'}`}>
                    {uploading
                      ? <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                      : <Upload className={`w-6 h-6 ${isDragging ? 'text-blue-600' : 'text-slate-500'}`} />
                    }
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      {uploading ? 'Uploading…' : 'Drop files here or click to browse'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      CSV, XLSX, XLS, DOCX, PDF, PNG, JPG — up to 100 MB each
                    </p>
                  </div>
                </div>
              </div>
              <input ref={fileRef} type="file" accept={ACCEPT} multiple className="hidden"
                onChange={(e) => e.target.files && handleFiles(e.target.files)} />
            </>
          )}

          {/* ── URL Import Tab ── */}
          {tab === 'url' && (
            <div className="space-y-4">
              {/* Telangana quick links */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wide">
                  Telangana Electoral Roll Sources
                </p>
                <p className="text-xs text-blue-600 mb-3">
                  Visit the CEO portal → select District → AC → Part → right-click the PDF link → Copy Link Address → paste below.
                </p>
                <div className="flex flex-col gap-1.5">
                  {TELANGANA_LINKS.map((l) => (
                    <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer"
                       className="flex items-center gap-2 text-xs text-blue-700 hover:text-blue-900 hover:underline">
                      <Download className="w-3 h-3 shrink-0" />
                      {l.label}
                    </a>
                  ))}
                </div>
              </div>

              {/* URL input */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">PDF / File URL</label>
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://ceotelangana.nic.in/.../part_001.pdf"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Filename <span className="text-slate-400">(optional — auto-detected from URL)</span>
                </label>
                <input
                  type="text"
                  value={urlFilename}
                  onChange={(e) => setUrlFilename(e.target.value)}
                  placeholder="e.g. Hyderabad_AC42_Part01.pdf"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                />
              </div>

              <button
                onClick={handleUrlImport}
                disabled={uploading || !urlInput.trim()}
                className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700
                           disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {uploading ? 'Downloading & Importing…' : 'Download & Import'}
              </button>

              {/* Folder watcher tip */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <p className="text-xs font-semibold text-slate-600 mb-1">⚡ Auto-Import via Folder Watcher</p>
                <p className="text-xs text-slate-500">
                  Drop PDFs directly into the <code className="bg-slate-100 px-1 rounded">backend/watch_inbox/</code> folder
                  and run <code className="bg-slate-100 px-1 rounded">python watcher.py</code> in a terminal — files are
                  imported automatically every 10 seconds, no UI needed.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Job history */}
        {jobs.length > 0 && (
          <div className="border-t border-slate-100">
            <div className="px-6 py-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Upload History</span>
              <button onClick={loadJobs} className="text-xs text-blue-600 hover:underline">Refresh</button>
            </div>
            <div className="px-6 pb-6 flex flex-col gap-2 max-h-48 overflow-y-auto">
              {jobs.map((job) => (
                <JobRow key={job.id} job={job} onRefresh={loadJobs} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
