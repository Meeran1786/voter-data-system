'use client'

import { useState } from 'react'
import { Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react'
import { exportXlsx, exportPdf } from '@/lib/api'
import type { SearchParams } from '@/types/voter'

interface Props {
  params: SearchParams
  total: number
}

export default function ExportButton({ params, total }: Props) {
  const [open, setOpen] = useState(false)

  const handleXlsx = () => {
    exportXlsx(params)
    setOpen(false)
  }

  const handlePdf = () => {
    exportPdf(params)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={total === 0}
        className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-white text-sm font-medium
                   rounded-lg hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed
                   transition-colors"
      >
        <Download className="w-4 h-4" />
        Export
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />

          <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl border border-slate-200
                          shadow-xl z-20 overflow-hidden py-1">
            <div className="px-3 py-2 border-b border-slate-100">
              <p className="text-xs text-slate-500">
                Export {Math.min(total, 50_000).toLocaleString()} records
                {total > 50_000 && <span className="text-orange-500"> (max 50K)</span>}
              </p>
            </div>

            <button
              onClick={handleXlsx}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700
                         hover:bg-slate-50 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-green-600" />
              <div className="text-left">
                <p className="font-medium">Excel (.xlsx)</p>
                <p className="text-xs text-slate-400">Full data with formatting</p>
              </div>
            </button>

            <button
              onClick={handlePdf}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700
                         hover:bg-slate-50 transition-colors"
            >
              <FileText className="w-4 h-4 text-red-600" />
              <div className="text-left">
                <p className="font-medium">PDF (.pdf)</p>
                <p className="text-xs text-slate-400">Printable table (max 1,000)</p>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
