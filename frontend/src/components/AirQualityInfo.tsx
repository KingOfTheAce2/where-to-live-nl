'use client'

import { useState } from 'react'
import { Info, ChevronDown, ChevronUp } from 'lucide-react'

/**
 * Air Quality Information Component
 *
 * Provides comprehensive information about air pollutants and their health effects
 */

type Pollutant = {
  name: string
  formula: string
  description: string
  sources: string[]
  healthEffects: string
  whoLimit: string
  euLimit: string
}

const POLLUTANTS: Record<string, Pollutant> = {
  NO2: {
    name: 'Nitrogen Dioxide',
    formula: 'NO₂',
    description: 'A reddish-brown gas formed by combustion processes, particularly from vehicle engines and power plants.',
    sources: ['Traffic emissions', 'Industrial combustion', 'Power plants', 'Heating systems'],
    healthEffects: 'Respiratory irritation, increased asthma symptoms, reduced lung function, increased susceptibility to respiratory infections.',
    whoLimit: '25 µg/m³ (annual average)',
    euLimit: '40 µg/m³ (annual average)'
  },
  PM10: {
    name: 'Particulate Matter (PM10)',
    formula: 'PM10',
    description: 'Particles with diameter less than 10 micrometers. Includes dust, pollen, mold, and combustion particles.',
    sources: ['Road dust', 'Construction', 'Agriculture', 'Brake/tire wear', 'Industrial processes'],
    healthEffects: 'Respiratory problems, cardiovascular disease, premature death. Can penetrate deep into lungs.',
    whoLimit: '45 µg/m³ (annual), 15 µg/m³ (24-hour)',
    euLimit: '40 µg/m³ (annual), 50 µg/m³ (24-hour)'
  },
  PM25: {
    name: 'Fine Particulate Matter (PM2.5)',
    formula: 'PM2.5',
    description: 'Very fine particles less than 2.5 micrometers in diameter. Most dangerous form of particulate pollution.',
    sources: ['Vehicle exhaust', 'Wood burning', 'Industrial emissions', 'Secondary formation from other pollutants'],
    healthEffects: 'Heart attacks, strokes, lung cancer, premature death. Can enter bloodstream and affect organs.',
    whoLimit: '5 µg/m³ (annual), 15 µg/m³ (24-hour)',
    euLimit: '25 µg/m³ (annual)'
  },
  O3: {
    name: 'Ozone',
    formula: 'O₃',
    description: 'Ground-level ozone is a secondary pollutant formed by reaction of sunlight with NO₂ and volatile organic compounds.',
    sources: ['Formed from traffic emissions', 'Industrial emissions', 'Solvents', 'Higher in summer/sunny days'],
    healthEffects: 'Respiratory irritation, reduced lung function, aggravated asthma, long-term lung damage.',
    whoLimit: '100 µg/m³ (8-hour average)',
    euLimit: '120 µg/m³ (8-hour average)'
  },
  SO2: {
    name: 'Sulfur Dioxide',
    formula: 'SO₂',
    description: 'A colorless gas with a pungent odor, produced by burning fossil fuels containing sulfur.',
    sources: ['Coal/oil combustion', 'Industrial processes', 'Shipping', 'Refineries'],
    healthEffects: 'Respiratory irritation, aggravated asthma, reduced lung function, cardiovascular effects.',
    whoLimit: '40 µg/m³ (24-hour)',
    euLimit: '125 µg/m³ (24-hour)'
  },
  CO: {
    name: 'Carbon Monoxide',
    formula: 'CO',
    description: 'A colorless, odorless toxic gas produced by incomplete combustion.',
    sources: ['Vehicle exhaust', 'Faulty heating systems', 'Industrial processes', 'Cigarette smoke'],
    healthEffects: 'Reduces oxygen delivery to organs, headaches, dizziness, confusion, can be fatal at high levels.',
    whoLimit: '4 mg/m³ (24-hour)',
    euLimit: '10 mg/m³ (8-hour)'
  },
  NH3: {
    name: 'Ammonia',
    formula: 'NH₃',
    description: 'A colorless gas with a pungent smell, primarily from agricultural activities.',
    sources: ['Livestock farming', 'Fertilizer application', 'Industrial processes', 'Waste treatment'],
    healthEffects: 'Eye and respiratory irritation, contributes to formation of PM2.5. Environmental acidification.',
    whoLimit: 'No specific guideline',
    euLimit: 'Not regulated (only emissions)'
  },
  C6H6: {
    name: 'Benzene',
    formula: 'C₆H₆',
    description: 'A carcinogenic aromatic hydrocarbon from incomplete combustion and petroleum products.',
    sources: ['Gasoline evaporation', 'Vehicle exhaust', 'Industrial emissions', 'Tobacco smoke'],
    healthEffects: 'Leukemia, blood disorders, immune system effects, reproductive harm, carcinogenic.',
    whoLimit: 'No safe level (carcinogen)',
    euLimit: '5 µg/m³ (annual)'
  },
  UFP: {
    name: 'Ultrafine Particles',
    formula: 'UFP (<0.1 µm)',
    description: 'Extremely small particles less than 0.1 micrometers. Can penetrate cell membranes.',
    sources: ['Vehicle exhaust', 'Aircraft', 'Industrial processes', 'Combustion', 'Secondary formation'],
    healthEffects: 'Cardiovascular effects, inflammation, oxidative stress, potential brain effects.',
    whoLimit: 'No specific guideline yet',
    euLimit: 'Not yet regulated'
  },
  Soot: {
    name: 'Black Carbon / Soot',
    formula: 'BC',
    description: 'Fine carbon particles from incomplete combustion, component of PM2.5.',
    sources: ['Diesel engines', 'Wood burning', 'Coal combustion', 'Shipping', 'Aviation'],
    healthEffects: 'Respiratory disease, cardiovascular effects, climate warming, premature death.',
    whoLimit: 'Included in PM2.5',
    euLimit: 'Included in PM2.5'
  }
}

export default function AirQualityInfo() {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedPollutant, setSelectedPollutant] = useState<string | null>(null)

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white p-4 flex items-center justify-between hover:from-green-700 hover:to-green-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Info className="w-5 h-5" />
          <h3 className="font-semibold">Air Quality Information</h3>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {/* Content */}
      {isOpen && (
        <div className="p-4 space-y-4">
          {/* Introduction */}
          <div className="text-sm text-gray-700">
            <p className="mb-2">
              Air quality affects your health and well-being. The Netherlands monitors various pollutants to ensure public health protection.
            </p>
            <p className="text-xs text-gray-600">
              Data source: RIVM (National Institute for Public Health and the Environment)
            </p>
          </div>

          {/* Pollutant Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select pollutant for details:
            </label>
            <select
              value={selectedPollutant || ''}
              onChange={(e) => setSelectedPollutant(e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">Select a pollutant...</option>
              <option value="NO2">NO₂ - Nitrogen Dioxide</option>
              <option value="PM10">PM10 - Particulate Matter</option>
              <option value="PM25">PM2.5 - Fine Particles</option>
              <option value="O3">O₃ - Ozone</option>
              <option value="SO2">SO₂ - Sulfur Dioxide</option>
              <option value="CO">CO - Carbon Monoxide</option>
              <option value="NH3">NH₃ - Ammonia</option>
              <option value="C6H6">C₆H₆ - Benzene</option>
              <option value="UFP">UFP - Ultrafine Particles</option>
              <option value="Soot">Black Carbon / Soot</option>
            </select>
          </div>

          {/* Pollutant Details */}
          {selectedPollutant && POLLUTANTS[selectedPollutant] && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
              <div>
                <h4 className="font-semibold text-green-900 flex items-center gap-2">
                  {POLLUTANTS[selectedPollutant].formula}
                  <span className="text-sm font-normal text-green-700">
                    ({POLLUTANTS[selectedPollutant].name})
                  </span>
                </h4>
              </div>

              <div>
                <p className="text-sm text-gray-700">{POLLUTANTS[selectedPollutant].description}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1">Main Sources:</p>
                <ul className="list-disc list-inside text-xs text-gray-600 space-y-1">
                  {POLLUTANTS[selectedPollutant].sources.map((source, idx) => (
                    <li key={idx}>{source}</li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1">Health Effects:</p>
                <p className="text-xs text-gray-600">{POLLUTANTS[selectedPollutant].healthEffects}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-green-200">
                <div>
                  <p className="text-xs font-semibold text-gray-700">WHO Guideline:</p>
                  <p className="text-xs text-gray-600">{POLLUTANTS[selectedPollutant].whoLimit}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-700">EU Limit:</p>
                  <p className="text-xs text-gray-600">{POLLUTANTS[selectedPollutant].euLimit}</p>
                </div>
              </div>
            </div>
          )}

          {/* Air Quality Index Explanation */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs space-y-2">
            <p className="font-semibold text-blue-900">💡 Understanding Air Quality</p>
            <div className="space-y-1 text-blue-800">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                <span><strong>Good:</strong> Air quality is satisfactory</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                <span><strong>Moderate:</strong> Acceptable, but sensitive groups should limit prolonged outdoor activity</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                <span><strong>Unhealthy for Sensitive:</strong> Children, elderly, and people with respiratory conditions should reduce outdoor activity</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                <span><strong>Unhealthy:</strong> Everyone should limit outdoor exertion</span>
              </div>
            </div>
          </div>

          {/* Link to RIVM */}
          <div className="text-xs text-center text-gray-500">
            <a
              href="https://www.rivm.nl/lucht"
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-600 hover:underline"
            >
              More information at RIVM.nl →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
