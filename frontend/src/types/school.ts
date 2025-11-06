export interface School {
  id: string
  name: string
  type: SchoolType
  denomination: string
  city: string
  coordinates: {
    lat: number
    lng: number
  }
  students: number
  grades?: string
  levels?: string[]
  age_range: string
  metadata?: {
    generated?: boolean
    generated_at?: string
  }
}

export type SchoolType = 'primary' | 'secondary'

export interface SchoolFilters {
  minLat?: number
  maxLat?: number
  minLng?: number
  maxLng?: number
  type?: SchoolType
  city?: string
}

export interface SchoolsResponse {
  success: boolean
  count: number
  total: number
  schools: School[]
}

// Helper functions
export function getSchoolTypeLabel(type: SchoolType): string {
  const labels: Record<SchoolType, string> = {
    'primary': 'Basisschool',
    'secondary': 'Middelbare school',
  }
  return labels[type]
}

export function getSchoolIcon(type: SchoolType): string {
  return type === 'primary' ? '🎒' : '🎓'
}

export function getSchoolColor(type: SchoolType): string {
  return type === 'primary' ? '#f59e0b' : '#8b5cf6'
}
