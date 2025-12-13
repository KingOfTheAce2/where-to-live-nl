/**
 * PDF Export utility for comparison reports
 *
 * This is a PREMIUM feature - requires authentication
 */

import { jsPDF } from 'jspdf'

export type ComparisonItemData = {
  id: string
  address: string
  coordinates: [number, number]
  areaCode?: string
  snapshot: any
}

type TranslationFunction = (key: string, params?: Record<string, any>) => string

/**
 * Generate a PDF comparison report
 *
 * @param items - Array of comparison items with snapshot data
 * @param type - 'neighborhood' or 'house'
 * @param t - Translation function
 * @returns Promise<void> - Downloads the PDF
 */
export async function generateComparisonPDF(
  items: ComparisonItemData[],
  type: 'neighborhood' | 'house',
  t: TranslationFunction
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - (margin * 2)

  let yPos = margin

  // Header
  doc.setFillColor(37, 99, 235) // Blue-600
  doc.rect(0, 0, pageWidth, 35, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text(
    type === 'neighborhood' ? t('neighborhoodComparison') : t('houseComparison'),
    margin,
    20
  )

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, margin, 28)
  doc.text('Where-to-Live-NL', pageWidth - margin - 40, 28)

  yPos = 45

  // Reset text color
  doc.setTextColor(0, 0, 0)

  // Calculate column width based on number of items
  const colWidth = (contentWidth - ((items.length - 1) * 5)) / items.length
  const colGap = 5

  // Location headers
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')

  items.forEach((item, idx) => {
    const xPos = margin + (idx * (colWidth + colGap))

    // Column header background
    doc.setFillColor(243, 244, 246) // Gray-100
    doc.roundedRect(xPos, yPos, colWidth, 20, 2, 2, 'F')

    doc.setTextColor(37, 99, 235) // Blue-600
    doc.text(`${type === 'neighborhood' ? t('neighborhood') : t('property')} #${idx + 1}`, xPos + 3, yPos + 7)

    doc.setTextColor(0, 0, 0)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')

    // Truncate address if too long
    const maxChars = Math.floor(colWidth / 2)
    const displayAddress = item.address.length > maxChars
      ? item.address.substring(0, maxChars - 3) + '...'
      : item.address
    doc.text(displayAddress, xPos + 3, yPos + 14)
  })

  yPos += 28

  // Metrics sections
  const metrics = [
    {
      label: t('livabilityScore'),
      icon: '★',
      getValue: (s: any) => s?.snapshot?.livability?.overall_score,
      format: (v: number) => `${v.toFixed(1)}/10`,
      lowerIsBetter: false
    },
    {
      label: t('crimeRate'),
      icon: '⚑',
      getValue: (s: any) => s?.snapshot?.crime?.crime_rate_per_1000,
      format: (v: number) => `${v.toFixed(2)}/1000`,
      lowerIsBetter: true
    },
    {
      label: t('airQuality'),
      icon: '◎',
      getValue: (s: any) => s?.snapshot?.air_quality?.pm25,
      format: (v: number) => `${v.toFixed(1)} µg/m³`,
      lowerIsBetter: true
    },
    {
      label: t('trainStationDistance'),
      icon: '⚡',
      getValue: (s: any) => s?.snapshot?.nearest_train_station?.distance_km,
      format: (v: number) => `${v.toFixed(1)} km`,
      lowerIsBetter: true
    },
    {
      label: t('population'),
      icon: '☆',
      getValue: (s: any) => s?.snapshot?.demographics?.population,
      format: (v: number) => v.toLocaleString(),
      lowerIsBetter: null // No comparison
    },
    {
      label: t('avgPropertyValue'),
      icon: '€',
      getValue: (s: any) => s?.snapshot?.demographics?.avg_woz_value,
      format: (v: number) => `€${v.toLocaleString()}`,
      lowerIsBetter: null
    },
    {
      label: t('monthlyEnergyCost'),
      icon: '⚡',
      getValue: (s: any) => s?.snapshot?.energy_consumption?.monthly_cost_eur,
      format: (v: number) => `€${v}/mo`,
      lowerIsBetter: true
    }
  ]

  // Draw metrics
  for (const metric of metrics) {
    const values = items.map(item => metric.getValue(item.snapshot))

    // Skip if no values
    if (values.every(v => v === undefined || v === null)) continue

    // Check if we need a new page
    if (yPos > pageHeight - 30) {
      doc.addPage()
      yPos = margin
    }

    // Metric label
    doc.setFillColor(249, 250, 251) // Gray-50
    doc.rect(margin, yPos, contentWidth, 18, 'F')

    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(75, 85, 99) // Gray-600
    doc.text(`${metric.icon} ${metric.label}`, margin + 3, yPos + 6)

    // Values for each column
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)

    // Find best value for highlighting
    const validValues = values.filter((v): v is number => v !== undefined && v !== null)
    let bestIdx = -1
    if (metric.lowerIsBetter !== null && validValues.length > 1) {
      const bestValue = metric.lowerIsBetter
        ? Math.min(...validValues)
        : Math.max(...validValues)
      bestIdx = values.findIndex(v => v === bestValue)
    }

    items.forEach((item, idx) => {
      const xPos = margin + (idx * (colWidth + colGap))
      const value = values[idx]

      if (value !== undefined && value !== null) {
        // Highlight best value
        if (idx === bestIdx) {
          doc.setTextColor(22, 163, 74) // Green-600
          doc.setFont('helvetica', 'bold')
        } else {
          doc.setTextColor(0, 0, 0)
          doc.setFont('helvetica', 'normal')
        }

        doc.text(metric.format(value), xPos + 3, yPos + 13)
      } else {
        doc.setTextColor(156, 163, 175) // Gray-400
        doc.text('N/A', xPos + 3, yPos + 13)
      }
    })

    yPos += 22
  }

  // Demographics section
  yPos += 5
  if (yPos > pageHeight - 60) {
    doc.addPage()
    yPos = margin
  }

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(37, 99, 235)
  doc.text(t('ageDistribution'), margin, yPos)
  yPos += 8

  const ageGroups = [
    { key: 'age_0_15', label: '0-15' },
    { key: 'age_15_25', label: '15-25' },
    { key: 'age_25_45', label: '25-45' },
    { key: 'age_45_65', label: '45-65' },
    { key: 'age_65_plus', label: '65+' }
  ]

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0, 0, 0)

  for (const age of ageGroups) {
    items.forEach((item, idx) => {
      const xPos = margin + (idx * (colWidth + colGap))
      const demographics = item.snapshot?.snapshot?.demographics
      if (demographics && demographics[age.key] !== undefined && demographics.population) {
        const pct = Math.round((demographics[age.key] / demographics.population) * 100)
        doc.text(`${age.label}: ${pct}%`, xPos + 3, yPos)
      }
    })
    yPos += 5
  }

  // Amenities section
  yPos += 8
  if (yPos > pageHeight - 50) {
    doc.addPage()
    yPos = margin
  }

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(37, 99, 235)
  doc.text(t('amenities2km'), margin, yPos)
  yPos += 8

  const amenityTypes = [
    { key: 'supermarkets', label: t('supermarkets') },
    { key: 'healthcare', label: t('healthcare') },
    { key: 'playgrounds', label: t('playgrounds') },
    { key: 'parks', label: t('parks') }
  ]

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0, 0, 0)

  for (const amenity of amenityTypes) {
    items.forEach((item, idx) => {
      const xPos = margin + (idx * (colWidth + colGap))
      const amenities = item.snapshot?.snapshot?.amenities
      if (amenities && amenities[amenity.key]) {
        doc.text(`${amenity.label}: ${amenities[amenity.key].count}`, xPos + 3, yPos)
      }
    })
    yPos += 5
  }

  // Footer
  const footerY = pageHeight - 10
  doc.setFontSize(8)
  doc.setTextColor(156, 163, 175)
  doc.text(
    'Data from Dutch government open sources (BAG, CBS, Leefbaarometer, RIVM). For informational purposes only.',
    margin,
    footerY
  )
  doc.text(
    'where-to-live-nl.com',
    pageWidth - margin - 30,
    footerY
  )

  // Generate filename
  const timestamp = new Date().toISOString().split('T')[0]
  const typeLabel = type === 'neighborhood' ? 'neighborhoods' : 'houses'
  const filename = `comparison-${typeLabel}-${timestamp}.pdf`

  // Download the PDF
  doc.save(filename)
}

/**
 * Check if user has premium access for PDF export
 * For now, this is a placeholder - implement actual auth check
 */
export function hasPremiumAccess(): boolean {
  // TODO: Implement actual premium check via authentication
  // For MVP, return true to allow testing
  return true
}
