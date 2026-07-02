'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Database, LayoutGrid, AlertTriangle, LogOut, User } from 'lucide-react'
import SearchPanel from '@/components/SearchPanel'
import VoterTable from '@/components/VoterTable'
import VoterCard from '@/components/VoterCard'
import UploadModal from '@/components/UploadModal'
import ExportButton from '@/components/ExportButton'
import { searchVoters } from '@/lib/api'
import type { Voter, PaginatedVoterResponse, SearchParams } from '@/types/voter'

const DEFAULT_PARAMS: SearchParams = {
  page: 1,
  page_size: 50,
  sort_by: 'serial_no',
  sort_order: 'asc',
}

export default function HomePage() {
  const router = useRouter()
  const [params, setParams] = useState<SearchParams>(DEFAULT_PARAMS)
  const [data, setData] = useState<PaginatedVoterResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedVoter, setSelectedVoter] = useState<Voter | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [loggedInUser, setLoggedInUser] = useState<string>('')

  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setLoggedInUser(localStorage.getItem('voter_user') ?? 'admin')
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('voter_token')
    localStorage.removeItem('voter_user')
    document.cookie = 'voter_token=; path=/; max-age=0'
    router.push('/login')
  }

  const doSearch = useCallback(async (searchParams: SearchParams) => {
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()

    setIsLoading(true)
    setError(null)
    setHasSearched(true)

    try {
      const result = await searchVoters(searchParams)
      setData(result)
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Re-run search when pagination or sort changes
  useEffect(() => {
    if (hasSearched) doSearch(params)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.page, params.page_size, params.sort_by, params.sort_order])

  const handleSearch = () => doSearch(params)

  const handleReset = () => {
    const fresh = { ...DEFAULT_PARAMS }
    setParams(fresh)
    setHasSearched(false)
    setData(null)
    setError(null)
  }

  // Table pagination/sort change → immediate re-search
  const handleTableParamsChange = (next: SearchParams) => {
    setParams(next)
    doSearch(next)
  }

  // Close the results table (but keep data in memory)
  const handleClose = () => {
    setHasSearched(false)
    setData(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/20">

      {/* ── Top navbar ────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4f3cc9] to-[#3a2aaa]
                            flex items-center justify-center shadow-sm">
              <LayoutGrid className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-800 leading-none">
                Voter Data System
              </h1>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Indian Electoral Roll Management — Local Database
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {data && data.total > 0 && (
              <ExportButton params={params} total={data.total} />
            )}
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#4f3cc9] text-white text-sm
                         font-medium rounded-lg hover:bg-[#3a2aaa] transition-colors"
            >
              <Upload className="w-4 h-4" />
              Import Data
            </button>
            {/* User + logout */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <User className="w-3.5 h-3.5" />
                <span className="font-medium">{loggedInUser}</span>
              </div>
              <button
                onClick={handleLogout}
                title="Sign out"
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 space-y-4">

        {/* Hero / landing state */}
        {!hasSearched && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-violet-100 flex items-center justify-center mb-4 shadow-inner">
              <Database className="w-8 h-8 text-violet-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">
              Indian Voter Data Management
            </h2>
            <p className="text-slate-500 max-w-md text-sm leading-relaxed mb-8">
              Import electoral rolls from CSV, Excel, DOCX, PDF, or scanned images.
              All data is stored locally — no external connections.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowUpload(true)}
                className="flex items-center gap-2 px-6 py-3 bg-[#4f3cc9] text-white font-medium
                           rounded-xl hover:bg-[#3a2aaa] transition-colors shadow-sm"
              >
                <Upload className="w-5 h-5" />
                Import Voter Rolls
              </button>
              <button
                onClick={handleSearch}
                className="flex items-center gap-2 px-6 py-3 bg-white text-slate-700 font-medium
                           rounded-xl hover:bg-slate-50 border border-slate-200 transition-colors shadow-sm"
              >
                Browse All Records
              </button>
            </div>

            <div className="flex flex-wrap justify-center gap-2 mt-8">
              {['CSV', 'XLSX / XLS', 'DOCX', 'PDF (native)', 'PDF (scanned)', 'PNG / JPG'].map((f) => (
                <span key={f} className="px-3 py-1 text-xs font-medium bg-white border border-slate-200
                                         text-slate-600 rounded-full shadow-sm">{f}</span>
              ))}
            </div>
          </div>
        )}

        {/* Search panel — always shown once user has interacted */}
        <SearchPanel
          params={params}
          onChange={setParams}
          onSearch={handleSearch}
          onReset={handleReset}
          isLoading={isLoading}
        />

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-medium">Search failed</p>
              <p className="text-xs text-red-500 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Results table */}
        {hasSearched && (
          <VoterTable
            voters={data?.results ?? []}
            total={data?.total ?? 0}
            page={data?.page ?? 1}
            pageSize={data?.page_size ?? 50}
            totalPages={data?.total_pages ?? 1}
            params={params}
            onParamsChange={handleTableParamsChange}
            onViewCard={setSelectedVoter}
            onClose={handleClose}
            isLoading={isLoading}
            assemblyConstituencyContext={data?.assembly_constituency_context}
            psNoContext={data?.ps_no_context}
          />
        )}
      </main>

      {/* ── Voter Card modal ────────────────────────────────────────── */}
      {selectedVoter && (
        <VoterCard voter={selectedVoter} onClose={() => setSelectedVoter(null)} />
      )}

      {/* ── Upload modal ─────────────────────────────────────────────── */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onUploadComplete={() => {
            setShowUpload(false)
            doSearch(params)
          }}
        />
      )}
    </div>
  )
}
