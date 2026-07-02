'use client'

import { useRef } from 'react'
import { X, Download, Share2 } from 'lucide-react'
import type { Voter } from '@/types/voter'

interface Props {
  voter: Voter
  onClose: () => void
}

/* ── Voter Helpline hand-cursor logo (SVG recreation) ─────────────────── */
function VoterHelplineLogo() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      {/* Dark blue circle background */}
      <circle cx="22" cy="22" r="22" fill="#1a3272" />
      {/* Stylised pointing hand / cursor */}
      <g fill="white">
        {/* Palm */}
        <rect x="17" y="20" width="10" height="12" rx="2" />
        {/* Index finger */}
        <rect x="20" y="12" width="4" height="11" rx="2" />
        {/* Ballot-box lines (simplified) */}
        <rect x="14" y="26" width="3" height="1.5" rx="0.5" fill="#FF9900" />
        <rect x="27" y="26" width="3" height="1.5" rx="0.5" fill="#FF9900" />
      </g>
      {/* Orange accent dot at fingertip */}
      <circle cx="22" cy="13" r="2.5" fill="#FF9900" />
    </svg>
  )
}

/* ── ECI diagonal watermark ──────────────────────────────────────────── */
function ECIWatermark() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden select-none">
      <div
        style={{ transform: 'rotate(-35deg)', transformOrigin: 'center' }}
        className="opacity-[0.07] text-center"
      >
        <p className="text-[11px] font-bold text-slate-800 tracking-widest uppercase whitespace-nowrap">
          भारत निर्वाचन आयोग
        </p>
        <p className="text-[10px] font-semibold text-slate-800 tracking-wider whitespace-nowrap">
          Election Commission of India
        </p>
      </div>
    </div>
  )
}

/* ── A single labelled row inside the card ──────────────────────────── */
function Row({
  label,
  value,
  valueRegional,
  valueEn,
}: {
  label: string
  value?: string | number | null
  valueRegional?: string | null
  valueEn?: string | null
}) {
  if (!value && !valueRegional && !valueEn) return null
  return (
    <div className="flex items-start gap-2 py-2.5 border-b border-slate-100 last:border-b-0">
      <span className="text-xs text-slate-500 shrink-0 w-36 leading-tight pt-0.5">{label}</span>
      <div className="flex-1 min-w-0">
        {valueRegional && (
          <p className="text-sm font-medium text-slate-700 font-devanagari leading-tight">
            {valueRegional}
          </p>
        )}
        {(valueEn ?? value) && (
          <p className="text-sm font-semibold text-slate-800 leading-tight">
            {String(valueEn ?? value)}
          </p>
        )}
      </div>
    </div>
  )
}

function RowInline({
  label,
  value,
}: {
  label: string
  value?: string | number | null
}) {
  if (value === null || value === undefined) return null
  return (
    <div className="flex items-center gap-2 py-2.5 border-b border-slate-100 last:border-b-0">
      <span className="text-xs text-slate-500 w-36 shrink-0">{label}</span>
      <span className="text-sm font-semibold text-slate-800">{String(value)}</span>
    </div>
  )
}

export default function VoterCard({ voter, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null)

  const handleDownload = () => window.print()

  const handleShare = async () => {
    const lines = [
      `EPIC No.: ${voter.voter_id ?? 'N/A'}`,
      `Name: ${voter.full_name}`,
      voter.father_or_husband_name ? `Parent/Spouse: ${voter.father_or_husband_name}` : '',
      voter.assembly_constituency ? `Assembly: ${voter.assembly_constituency}` : '',
      voter.parliamentary_constituency ? `Parliament: ${voter.parliamentary_constituency}` : '',
      voter.district ? `District: ${voter.district}` : '',
      voter.state ? `State: ${voter.state}` : '',
      voter.part_no ? `Part No.: ${voter.part_no}` : '',
      voter.part_name ? `Part Name: ${voter.part_name}` : '',
      voter.serial_no ? `Serial No.: ${voter.serial_no}` : '',
    ].filter(Boolean).join('\n')

    if (navigator.share) {
      await navigator.share({ title: `Voter Card – ${voter.full_name}`, text: lines })
    } else {
      await navigator.clipboard.writeText(lines)
      alert('Voter details copied to clipboard!')
    }
  }

  const genderDisplay = voter.gender
    ? voter.gender.toUpperCase().startsWith('M') ? 'M'
    : voter.gender.toUpperCase().startsWith('F') ? 'F'
    : 'T'
    : null

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Card shell — matches the phone screenshot dimensions */}
      <div
        ref={printRef}
        id="voter-card-print-area"
        className="relative w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-2xl"
        style={{ fontFamily: "'Noto Sans', 'Noto Sans Devanagari', sans-serif" }}
      >

        {/* ── Purple/indigo app header — "Search Your Name in Voter List" ─── */}
        <div className="bg-[#4f3cc9] px-4 pt-4 pb-5 text-white">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-start gap-2 pr-8">
            {/* ECI colorful logo — tricolor ballot boxes icon */}
            <div className="shrink-0 mt-0.5">
              <svg width="32" height="32" viewBox="0 0 32 32">
                <rect width="32" height="32" rx="4" fill="white" fillOpacity="0.15" />
                {/* Saffron ballot */}
                <rect x="4" y="8" width="7" height="16" rx="1.5" fill="#FF9933" />
                <rect x="5.5" y="11" width="4" height="1.5" rx="0.5" fill="white" />
                <rect x="5.5" y="14" width="4" height="1.5" rx="0.5" fill="white" />
                {/* White ballot */}
                <rect x="12.5" y="6" width="7" height="20" rx="1.5" fill="white" />
                <rect x="14" y="10" width="4" height="1.5" rx="0.5" fill="#555" />
                <rect x="14" y="13.5" width="4" height="1.5" rx="0.5" fill="#555" />
                {/* Green ballot */}
                <rect x="21" y="9" width="7" height="15" rx="1.5" fill="#138808" />
                <rect x="22.5" y="12" width="4" height="1.5" rx="0.5" fill="white" />
                <rect x="22.5" y="15" width="4" height="1.5" rx="0.5" fill="white" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-sm leading-tight">Search Your Name in</p>
              <p className="font-bold text-base leading-tight">Voter List</p>
            </div>
          </div>
        </div>

        {/* ── Results count bar ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-100 text-xs">
          <span>
            <span className="font-bold text-slate-800">Number of Record(s)</span>
            <span className="text-slate-500 ml-1">Found: 1</span>
          </span>
          <span className="text-slate-500">Page: <span className="font-semibold text-slate-700">1 out of 1</span></span>
        </div>

        {/* ── Main voter card body ──────────────────────────────────────── */}
        <div className="relative overflow-hidden">
          <ECIWatermark />

          {/* Voter Helpline branding strip */}
          <div className="flex items-center gap-3 px-4 py-3 border-b-2 border-slate-200">
            <VoterHelplineLogo />
            <div>
              <p className="font-bold text-[13px] text-[#1a3272] leading-tight">Voter Helpline</p>
              <p className="text-[11px] text-slate-500 font-devanagari leading-tight">मतदाता हेल्पलाइन</p>
            </div>
          </div>

          {/* EPIC No — large and prominent */}
          <div className="px-4 py-4 text-center border-b border-slate-200">
            <p className="text-2xl font-extrabold text-slate-900 tracking-wider font-mono">
              {voter.voter_id ?? '—'}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">(Voter Id/EPIC NO.)</p>
          </div>

          {/* Field rows — exact order from image_0.png */}
          <div className="px-4 pb-2">
            {/* Name — bilingual */}
            <Row
              label="Name:"
              valueRegional={voter.full_name_regional ?? null}
              valueEn={voter.full_name}
            />

            {/* Age + Gender inline on same divider row */}
            <div className="flex border-b border-slate-100">
              <div className="flex items-center gap-2 py-2.5 flex-1">
                <span className="text-xs text-slate-500 w-16 shrink-0">Age</span>
                <span className="text-sm font-semibold text-slate-800">{voter.age ?? '—'}</span>
              </div>
              <div className="w-px bg-slate-100 mx-2 self-stretch" />
              <div className="flex items-center gap-2 py-2.5 flex-1">
                <span className="text-xs text-slate-500 w-16 shrink-0">Gender</span>
                <span className="text-sm font-semibold text-slate-800">{genderDisplay ?? '—'}</span>
              </div>
            </div>

            {/* Parent/Spouse — bilingual */}
            <Row
              label="Parent/ Spouse"
              valueRegional={voter.father_or_husband_name_regional ?? null}
              valueEn={voter.father_or_husband_name}
            />

            <RowInline label="Assembly Constituency" value={voter.assembly_constituency} />
            <RowInline label="Parliamentary Constituency" value={voter.parliamentary_constituency} />
            <RowInline label="District" value={voter.district} />
            <RowInline label="State" value={voter.state} />
          </div>

          {/* Part / Serial divider section */}
          <div className="px-4 pt-1 pb-3 border-t border-slate-200 mt-1">
            <RowInline label="Part No." value={voter.part_no} />
            <RowInline label="Part Name" value={voter.part_name} />
            <RowInline label="Serial No." value={voter.serial_no} />
            {voter.polling_station_no && (
              <RowInline label="Polling Station No." value={voter.polling_station_no} />
            )}
            {voter.polling_station_name && (
              <RowInline label="Polling Station" value={voter.polling_station_name} />
            )}
            {voter.house_door_no && (
              <RowInline label="House / Door No." value={voter.house_door_no} />
            )}
          </div>
        </div>

        {/* ── Bottom action buttons — Download (blue) + Share (dark) ────── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50">
          <button
            onClick={handleDownload}
            className="w-12 h-12 rounded-full bg-[#1565C0] hover:bg-blue-700 flex items-center
                       justify-center text-white shadow-md hover:shadow-lg transition-all active:scale-95"
            title="Download / Print"
          >
            <Download className="w-5 h-5" />
          </button>

          <div className="text-center">
            <p className="text-[10px] text-slate-400">Tap card to copy details</p>
          </div>

          <button
            onClick={handleShare}
            className="w-12 h-12 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center
                       justify-center text-white shadow-md hover:shadow-lg transition-all active:scale-95"
            title="Share"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Print CSS */}
      <style jsx global>{`
        @media print {
          body > *:not(#__next) { display: none !important; }
          #voter-card-print-area {
            position: fixed !important;
            inset: 0;
            margin: auto;
            max-width: 380px;
            z-index: 9999;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
        }
      `}</style>
    </div>
  )
}
