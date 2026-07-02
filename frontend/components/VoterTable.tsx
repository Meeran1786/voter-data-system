'use client'

import { useState } from 'react'
import {
  ChevronUp, ChevronDown, ChevronsUpDown,
  Eye, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight,
  Download, X, Users,
} from 'lucide-react'
import type { Voter, SearchParams } from '@/types/voter'
import { exportXlsx, exportPdf } from '@/lib/api'

interface Props {
  voters: Voter[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  params: SearchParams
  onParamsChange: (p: SearchParams) => void
  onViewCard: (voter: Voter) => void
  onClose: () => void
  isLoading: boolean
  assemblyConstituencyContext?: string | null
  psNoContext?: number | null
}

// Relation type → human-readable label
const RLN_LABELS: Record<string, { label: string; color: string }> = {
  O: { label: 'O', color: 'text-slate-600 bg-slate-100' },
  H: { label: 'H', color: 'text-blue-700 bg-blue-50' },
  F: { label: 'F', color: 'text-green-700 bg-green-50' },
  S: { label: 'S', color: 'text-purple-700 bg-purple-50' },
}

function SortBtn({ col, params, onChange }: {
  col: string
  params: SearchParams
  onChange: (p: SearchParams) => void
}) {
  const active = params.sort_by === col
  const toggle = () => {
    const newOrder = active && params.sort_order === 'asc' ? 'desc' : 'asc'
    onChange({ ...params, sort_by: col, sort_order: newOrder, page: 1 })
  }
  return (
    <button onClick={toggle} className="ml-1 inline-flex opacity-60 hover:opacity-100">
      {!active
        ? <ChevronsUpDown className="w-3 h-3" />
        : params.sort_order === 'asc'
          ? <ChevronUp className="w-3 h-3 text-blue-600" />
          : <ChevronDown className="w-3 h-3 text-blue-600" />
      }
    </button>
  )
}

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 10 }).map((_, i) => (
        <tr key={i} className="animate-pulse border-b border-slate-100">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-2 py-2">
              <div className="h-3.5 bg-slate-100 rounded w-3/4" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export default function VoterTable({
  voters,
  total,
  page,
  pageSize,
  totalPages,
  params,
  onParamsChange,
  onViewCard,
  onClose,
  isLoading,
  assemblyConstituencyContext,
  psNoContext,
}: Props) {
  const startIdx = (page - 1) * pageSize + 1
  const endIdx = Math.min(page * pageSize, total)

  const handlePage = (p: number) => onParamsChange({ ...params, page: p })

  const handleDownload = () => exportXlsx(params)

  return (
    <div className="flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">

      {/* ── ECI-style constituency header banner ───────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5
                      bg-gradient-to-r from-slate-700 to-slate-800 text-white text-xs font-medium">
        <span>
          {assemblyConstituencyContext ? (
            <>
              <span className="text-slate-300 mr-1">Assembly Constituency No &amp; Name:</span>
              <span className="text-white font-semibold">{assemblyConstituencyContext}</span>
            </>
          ) : (
            <span className="text-slate-400">All Constituencies</span>
          )}
        </span>
        {psNoContext && (
          <span>
            <span className="text-slate-300 mr-1">PS No:</span>
            <span className="text-white font-semibold">{psNoContext}</span>
          </span>
        )}
      </div>

      {/* ── Record count + action buttons ──────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <Users className="w-3.5 h-3.5 text-slate-400" />
          {isLoading ? (
            <span className="animate-pulse text-slate-400">Loading…</span>
          ) : (
            <>
              <span className="font-semibold text-slate-800">{total.toLocaleString()}</span>
              <span>record{total !== 1 ? 's' : ''} found</span>
              {total > 0 && (
                <span className="text-slate-400">
                  — {startIdx}–{endIdx}
                </span>
              )}
            </>
          )}
        </div>

        {/* Close + Download — positioned exactly like in the screenshot */}
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold
                       bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors shadow-sm"
          >
            <X className="w-3.5 h-3.5" />
            Close
          </button>
          <button
            onClick={handleDownload}
            disabled={total === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold
                       bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors
                       shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </button>
        </div>
      </div>

      {/* ── Main table ────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-slate-300">
              {/* Fixed ECI column order matching the screenshot exactly */}
              <Th label="PS No" col="polling_station_no" params={params} onChange={onParamsChange} center />
              <Th label="Sl. No" col="serial_no" params={params} onChange={onParamsChange} center />
              <Th label="Section No" col="section_no" params={params} onChange={onParamsChange} center />
              <Th label="House No" />
              <Th label="Elector Name" col="full_name" params={params} onChange={onParamsChange} />
              <Th label="Rln Type" center />
              <Th label="Relation Name" />
              <Th label="Gender" center />
              <Th label="Age" col="age" params={params} onChange={onParamsChange} center />
              <Th label="EPIC No" col="voter_id" params={params} onChange={onParamsChange} />
              <th className="px-2 py-2.5 text-left text-xs font-bold text-slate-600 uppercase tracking-wider w-10" />
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <SkeletonRows cols={11} />
            ) : voters.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <Users className="w-10 h-10 text-slate-200" />
                    <p className="font-medium text-slate-500 text-sm">No records found</p>
                    <p className="text-xs">Adjust your search or import voter data</p>
                  </div>
                </td>
              </tr>
            ) : (
              voters.map((voter, idx) => (
                <VoterRow
                  key={voter.id}
                  voter={voter}
                  idx={idx}
                  onViewCard={onViewCard}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ────────────────────────────────────────────────────── */}
      {total > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">
              Page {page} of {totalPages.toLocaleString()}
            </span>
            <select
              value={pageSize}
              onChange={(e) => onParamsChange({ ...params, page_size: Number(e.target.value), page: 1 })}
              className="text-xs border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n} / page</option>)}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <PagBtn onClick={() => handlePage(1)} disabled={page === 1}><ChevronsLeft className="w-3.5 h-3.5" /></PagBtn>
            <PagBtn onClick={() => handlePage(page - 1)} disabled={page === 1}><ChevronLeft className="w-3.5 h-3.5" /></PagBtn>
            {getPaginationRange(page, totalPages).map((p, i) =>
              p === '...' ? (
                <span key={`e${i}`} className="px-1.5 text-slate-400 text-xs">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => handlePage(p as number)}
                  className={`w-7 h-7 rounded text-xs font-medium transition-colors
                    ${p === page ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >{p}</button>
              )
            )}
            <PagBtn onClick={() => handlePage(page + 1)} disabled={page === totalPages}><ChevronRight className="w-3.5 h-3.5" /></PagBtn>
            <PagBtn onClick={() => handlePage(totalPages)} disabled={page === totalPages}><ChevronsRight className="w-3.5 h-3.5" /></PagBtn>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

function Th({
  label, col, params, onChange, center
}: {
  label: string
  col?: string
  params?: SearchParams
  onChange?: (p: SearchParams) => void
  center?: boolean
}) {
  return (
    <th className={`px-2 py-2.5 text-xs font-bold text-slate-700 uppercase tracking-wider
                    border-r border-slate-200 last:border-r-0 whitespace-nowrap
                    ${center ? 'text-center' : 'text-left'}`}>
      <span className="inline-flex items-center">
        {label}
        {col && params && onChange && (
          <SortBtn col={col} params={params} onChange={onChange} />
        )}
      </span>
    </th>
  )
}

function VoterRow({
  voter, idx, onViewCard,
}: {
  voter: Voter
  idx: number
  onViewCard: (v: Voter) => void
}) {
  const isEven = idx % 2 === 0
  const rln = voter.relation_type?.toUpperCase() ?? ''
  const rlnStyle = RLN_LABELS[rln] ?? { label: rln || '—', color: 'text-slate-500 bg-slate-50' }

  return (
    <tr className={`hover:bg-blue-50/40 transition-colors ${isEven ? 'bg-white' : 'bg-slate-50/40'}`}>
      {/* PS No */}
      <td className="px-2 py-1.5 text-center border-r border-slate-100 font-mono text-slate-600">
        {voter.polling_station_no ?? <Dash />}
      </td>

      {/* Sl. No */}
      <td className="px-2 py-1.5 text-center border-r border-slate-100 font-mono text-slate-600">
        {voter.serial_no ?? <Dash />}
      </td>

      {/* Section No */}
      <td className="px-2 py-1.5 text-center border-r border-slate-100 font-mono text-slate-600">
        {voter.section_no ?? <Dash />}
      </td>

      {/* House No */}
      <td className="px-2 py-1.5 border-r border-slate-100 text-slate-700 font-mono text-[11px]">
        {voter.house_door_no ?? <Dash />}
      </td>

      {/* Elector Name — shows bilingual if available */}
      <td className="px-2 py-1.5 border-r border-slate-100 min-w-[140px]">
        <p className="font-semibold text-slate-800 leading-tight">{voter.full_name}</p>
        {voter.full_name_regional && (
          <p className="text-[10px] text-slate-500 leading-tight mt-0.5 font-devanagari">
            {voter.full_name_regional}
          </p>
        )}
      </td>

      {/* Rln Type */}
      <td className="px-2 py-1.5 text-center border-r border-slate-100">
        {rln ? (
          <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-[11px] font-bold ${rlnStyle.color}`}>
            {rlnStyle.label}
          </span>
        ) : <Dash />}
      </td>

      {/* Relation Name */}
      <td className="px-2 py-1.5 border-r border-slate-100 min-w-[120px]">
        {voter.father_or_husband_name ? (
          <>
            <p className="text-slate-700 leading-tight">{voter.father_or_husband_name}</p>
            {voter.father_or_husband_name_regional && (
              <p className="text-[10px] text-slate-500 leading-tight mt-0.5 font-devanagari">
                {voter.father_or_husband_name_regional}
              </p>
            )}
          </>
        ) : <Dash />}
      </td>

      {/* Gender */}
      <td className="px-2 py-1.5 text-center border-r border-slate-100">
        {voter.gender ? (
          <GenderBadge gender={voter.gender} />
        ) : <Dash />}
      </td>

      {/* Age */}
      <td className="px-2 py-1.5 text-center border-r border-slate-100 text-slate-700">
        {voter.age ?? <Dash />}
      </td>

      {/* EPIC No */}
      <td className="px-2 py-1.5 border-r border-slate-100">
        {voter.voter_id ? (
          <span className="font-mono text-[11px] text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">
            {voter.voter_id}
          </span>
        ) : <Dash />}
      </td>

      {/* View card action */}
      <td className="px-2 py-1.5 text-center">
        <button
          onClick={() => onViewCard(voter)}
          title="View Digital Voter Card"
          className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  )
}

function Dash() {
  return <span className="text-slate-300 text-center block">—</span>
}

function GenderBadge({ gender }: { gender: string }) {
  const g = gender.toUpperCase()
  const isMale = g.startsWith('M')
  const isFemale = g.startsWith('F')
  return (
    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold
      ${isMale ? 'bg-blue-50 text-blue-700' : isFemale ? 'bg-pink-50 text-pink-700' : 'bg-purple-50 text-purple-700'}`}>
      {isMale ? 'M' : isFemale ? 'F' : 'T'}
    </span>
  )
}

function PagBtn({ children, onClick, disabled }: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-7 h-7 flex items-center justify-center rounded text-slate-500
                 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
    >
      {children}
    </button>
  )
}

function getPaginationRange(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const range: (number | '...')[] = [1]
  const left = Math.max(2, current - 1)
  const right = Math.min(total - 1, current + 1)
  if (left > 2) range.push('...')
  for (let i = left; i <= right; i++) range.push(i)
  if (right < total - 1) range.push('...')
  range.push(total)
  return range
}
