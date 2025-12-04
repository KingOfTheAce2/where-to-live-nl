export type Destination = {
  id: string
  label: string
  address: string
  maxMinutes: number
  modes: ('bike' | 'pt' | 'both')[]
  coordinates?: [number, number]  // [lng, lat]
}
