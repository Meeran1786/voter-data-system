export interface Voter {
  id: number
  voter_id: string | null

  // English names
  full_name: string
  father_or_husband_name: string | null

  // Regional-script (bilingual) names
  full_name_regional: string | null
  father_or_husband_name_regional: string | null

  // Relation type: O=Other, H=Husband, F=Father, S=Self
  relation_type: string | null

  age: number | null
  gender: string | null

  // Geographic hierarchy
  state: string | null
  district: string | null
  parliamentary_constituency: string | null
  assembly_constituency: string | null
  assembly_constituency_no: number | null

  // Polling unit
  section_no: number | null
  part_no: number | null
  part_name: string | null
  serial_no: number | null
  polling_station_no: number | null
  polling_station_name: string | null

  // Address
  house_door_no: string | null

  // Source tracking
  source_file: string | null
  source_format: string | null
  created_at: string | null
}

export interface PaginatedVoterResponse {
  total: number
  page: number
  page_size: number
  total_pages: number
  results: Voter[]
  // Context for the table header banner
  assembly_constituency_context: string | null
  ps_no_context: number | null
}

export interface FilterOptions {
  states: string[]
  districts: string[]
  parliamentary_constituencies: string[]
  assembly_constituencies: string[]
}

export interface SearchParams {
  q?: string
  voter_id?: string
  full_name?: string
  father_or_husband_name?: string
  relation_type?: string
  state?: string
  district?: string
  parliamentary_constituency?: string
  assembly_constituency?: string
  section_no?: number
  part_no?: number
  polling_station_no?: number
  gender?: string
  age_min?: number
  age_max?: number
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface UploadJob {
  id: number
  filename: string
  file_format: string
  file_size_bytes: number | null
  status: 'pending' | 'processing' | 'done' | 'failed'
  records_parsed: number
  records_inserted: number
  records_skipped: number
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string | null
}
