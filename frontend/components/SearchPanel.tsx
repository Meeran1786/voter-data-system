'use client'

import { useEffect, useState, useCallback } from 'react'
import { Search, SlidersHorizontal, X, ChevronDown } from 'lucide-react'
import { getFilterOptions } from '@/lib/api'
import type { FilterOptions, SearchParams } from '@/types/voter'

interface Props {
  params: SearchParams
  onChange: (params: SearchParams) => void
  onSearch: () => void
  onReset: () => void
  isLoading: boolean
}

export default function SearchPanel({
  params,
  onChange,
  onSearch,
  onReset,
  isLoading,
}: Props) {
  const [showFilters, setShowFilters] = useState(false)
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    states: [],
    districts: [],
    parliamentary_constituencies: [],
    assembly_constituencies: [],
  })

  const loadFilterOptions = useCallback(async () => {
    try {
      const opts = await getFilterOptions(params.state, params.district)
      setFilterOptions(opts)
    } catch {
      // non-critical — dropdowns just stay empty
    }
  }, [params.state, params.district])

  useEffect(() => {
    loadFilterOptions()
  }, [loadFilterOptions])

  const set = (key: keyof SearchParams, value: string | number | undefined) => {
    onChange({ ...params, [key]: value || undefined, page: 1 })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onSearch()
  }

  const hasActiveFilters = Object.entries(params).some(
    ([k, v]) => !['page', 'page_size', 'sort_by', 'sort_order'].includes(k) && v
  )

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
      {/* Global search bar */}
      <div className="flex items-center gap-3 p-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, EPIC number, constituency, polling station…"
            value={params.q ?? ''}
            onChange={(e) => set('q', e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       placeholder:text-slate-400 bg-slate-50"
          />
          {params.q && (
            <button
              onClick={() => set('q', undefined)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          onClick={onSearch}
          disabled={isLoading}
          className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg
                     hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {isLoading ? 'Searching…' : 'Search'}
        </button>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors
            ${showFilters
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {hasActiveFilters && (
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
          )}
          <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>

        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-slate-500
                       hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
            Clear
          </button>
        )}
      </div>

      {/* Advanced filter panel */}
      {showFilters && (
        <div className="border-t border-slate-100 p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {/* EPIC No */}
            <FilterInput
              label="EPIC / Voter ID"
              value={params.voter_id ?? ''}
              onChange={(v) => set('voter_id', v)}
              placeholder="e.g. DL/04/101/123456"
            />

            {/* Name */}
            <FilterInput
              label="Full Name"
              value={params.full_name ?? ''}
              onChange={(v) => set('full_name', v)}
              placeholder="Voter name"
            />

            {/* Father/Husband */}
            <FilterInput
              label="Father / Husband Name"
              value={params.father_or_husband_name ?? ''}
              onChange={(v) => set('father_or_husband_name', v)}
              placeholder="Relation name"
            />

            {/* State */}
            <FilterSelect
              label="State"
              value={params.state ?? ''}
              onChange={(v) => { set('state', v); set('district', undefined) }}
              options={filterOptions.states}
              placeholder="All states"
            />

            {/* District */}
            <FilterSelect
              label="District"
              value={params.district ?? ''}
              onChange={(v) => set('district', v)}
              options={filterOptions.districts}
              placeholder="All districts"
            />

            {/* Parliamentary Constituency */}
            <FilterSelect
              label="Parliamentary Constituency"
              value={params.parliamentary_constituency ?? ''}
              onChange={(v) => set('parliamentary_constituency', v)}
              options={filterOptions.parliamentary_constituencies}
              placeholder="All PCs"
            />

            {/* Assembly Constituency */}
            <FilterSelect
              label="Assembly Constituency"
              value={params.assembly_constituency ?? ''}
              onChange={(v) => set('assembly_constituency', v)}
              options={filterOptions.assembly_constituencies}
              placeholder="All ACs"
            />

            {/* Section No */}
            <FilterInput
              label="Section No"
              value={params.section_no?.toString() ?? ''}
              onChange={(v) => set('section_no', v ? Number(v) : undefined)}
              placeholder="e.g. 1"
              type="number"
            />

            {/* Part No */}
            <FilterInput
              label="Part No"
              value={params.part_no?.toString() ?? ''}
              onChange={(v) => set('part_no', v ? Number(v) : undefined)}
              placeholder="e.g. 78"
              type="number"
            />

            {/* Polling Station No */}
            <FilterInput
              label="Polling Station No"
              value={params.polling_station_no?.toString() ?? ''}
              onChange={(v) => set('polling_station_no', v ? Number(v) : undefined)}
              placeholder="e.g. 5"
              type="number"
            />

            {/* Relation Type */}
            <FilterSelect
              label="Relation Type (Rln)"
              value={params.relation_type ?? ''}
              onChange={(v) => set('relation_type', v)}
              options={['O - Other', 'H - Husband', 'F - Father', 'S - Self']}
              rawValues={['O', 'H', 'F', 'S']}
              placeholder="All types"
            />

            {/* Gender */}
            <FilterSelect
              label="Gender"
              value={params.gender ?? ''}
              onChange={(v) => set('gender', v)}
              options={['Male', 'Female', 'Transgender']}
              rawValues={['M', 'F', 'T']}
              placeholder="All genders"
            />

            {/* Age range */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Age Range</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={params.age_min?.toString() ?? ''}
                  onChange={(e) => set('age_min', e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-2.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={params.age_max?.toString() ?? ''}
                  onChange={(e) => set('age_max', e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-2.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-4 pt-3 border-t border-slate-100">
            <button
              onClick={onSearch}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function FilterInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg
                   focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
      />
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  rawValues,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
  rawValues?: string[]   // if provided, option[i] displays options[i] but sends rawValues[i]
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg
                   focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 appearance-none"
      >
        <option value="">{placeholder}</option>
        {options.map((opt, i) => {
          const val = rawValues ? rawValues[i] : opt
          return <option key={val} value={val}>{opt}</option>
        })}
      </select>
    </div>
  )
}
