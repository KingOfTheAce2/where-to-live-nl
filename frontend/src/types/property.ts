export interface Property {
  id: string
  address: {
    street: string
    number: number
    addition: string
    postcode: string
    city: string
  }
  coordinates: {
    lat: number
    lng: number
  }
  property: {
    type: PropertyType
    living_area_m2: number
    plot_area_m2: number
    rooms: number
    year_built: number
    energy_label: EnergyLabel
  }
  valuation: {
    woz_value: number
    woz_year: number
    price_per_m2: number
  }
  metadata?: {
    generated?: boolean
    generated_at?: string
  }
}

export type PropertyType =
  | 'appartement'
  | 'tussenwoning'
  | 'hoekwoning'
  | 'vrijstaand'
  | '2-onder-1-kap'

export type EnergyLabel =
  | 'A++'
  | 'A+'
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'

export interface PropertyFilters {
  minLat?: number
  maxLat?: number
  minLng?: number
  maxLng?: number
  minPrice?: number
  maxPrice?: number
  propertyTypes?: PropertyType[]
  minRooms?: number
  maxRooms?: number
  minArea?: number
  maxArea?: number
}

export interface PropertiesResponse {
  success: boolean
  count: number
  total: number
  properties: Property[]
}

export interface PropertyResponse {
  success: boolean
  property: Property
}

// Helper functions
export function formatPrice(price: number): string {
  return `€${price.toLocaleString('nl-NL')}`
}

export function formatAddress(address: Property['address']): string {
  const { street, number, addition, city } = address
  const fullNumber = addition ? `${number}${addition}` : number
  return `${street} ${fullNumber}, ${city}`
}

export function getPropertyTypeLabel(type: PropertyType): string {
  const labels: Record<PropertyType, string> = {
    'appartement': 'Appartement',
    'tussenwoning': 'Tussenwoning',
    'hoekwoning': 'Hoekwoning',
    'vrijstaand': 'Vrijstaande woning',
    '2-onder-1-kap': '2-onder-1-kap woning',
  }
  return labels[type]
}

export function getEnergyLabelColor(label: EnergyLabel): string {
  const colors: Record<EnergyLabel, string> = {
    'A++': '#22c55e',
    'A+': '#22c55e',
    'A': '#84cc16',
    'B': '#a3e635',
    'C': '#facc15',
    'D': '#fb923c',
    'E': '#f87171',
    'F': '#ef4444',
    'G': '#dc2626',
  }
  return colors[label]
}
