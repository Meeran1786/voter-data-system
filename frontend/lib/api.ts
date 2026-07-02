import type {
  FilterOptions,
  PaginatedVoterResponse,
  SearchParams,
  UploadJob,
  Voter,
} from '@/types/voter'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

function toQueryString(params: Record<string, unknown>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      q.set(k, String(v))
    }
  }
  return q.toString()
}

// ─── Voters ──────────────────────────────────────────────────────────────────

export async function searchVoters(
  params: SearchParams
): Promise<PaginatedVoterResponse> {
  const qs = toQueryString(params as Record<string, unknown>)
  const res = await fetch(`${BASE}/api/voters/search?${qs}`)
  if (!res.ok) throw new Error(`Search failed: ${res.statusText}`)
  return res.json()
}

export async function getVoter(voterIdOrDbId: string): Promise<Voter> {
  const res = await fetch(`${BASE}/api/voters/${encodeURIComponent(voterIdOrDbId)}`)
  if (!res.ok) throw new Error('Voter not found')
  return res.json()
}

export async function getFilterOptions(
  state?: string,
  district?: string
): Promise<FilterOptions> {
  const qs = toQueryString({ state, district })
  const res = await fetch(`${BASE}/api/voters/filter-options?${qs}`)
  if (!res.ok) throw new Error('Could not load filter options')
  return res.json()
}

// ─── Upload ───────────────────────────────────────────────────────────────────

export async function uploadFile(file: File): Promise<UploadJob> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(`${BASE}/api/upload/`, { method: 'POST', body: fd })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail ?? `Upload failed: ${res.statusText}`)
  }
  return res.json()
}

export async function getUploadJob(jobId: number): Promise<UploadJob> {
  const res = await fetch(`${BASE}/api/upload/jobs/${jobId}`)
  if (!res.ok) throw new Error('Job not found')
  return res.json()
}

export async function listUploadJobs(): Promise<UploadJob[]> {
  const res = await fetch(`${BASE}/api/upload/jobs`)
  if (!res.ok) throw new Error('Could not load jobs')
  return res.json()
}

// ─── Export ───────────────────────────────────────────────────────────────────

function buildExportUrl(format: 'xlsx' | 'pdf', params: SearchParams): string {
  const qs = toQueryString({ ...params, limit: 50_000 } as Record<string, unknown>)
  return `${BASE}/api/export/${format}?${qs}`
}

export function exportXlsx(params: SearchParams): void {
  window.open(buildExportUrl('xlsx', params), '_blank')
}

export function exportPdf(params: SearchParams): void {
  window.open(buildExportUrl('pdf', params), '_blank')
}
