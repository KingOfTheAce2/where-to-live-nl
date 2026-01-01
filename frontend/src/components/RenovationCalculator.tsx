'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  Calculator,
  Leaf,
  Sun,
  Flame,
  Droplets,
  Zap,
  Home,
  TrendingUp,
  Euro,
  Clock,
  ExternalLink,
  Info,
  ChevronDown,
  ChevronRight,
  Sparkles,
  ThermometerSun
} from 'lucide-react'

// Types
type EnergyLabel = 'A++++' | 'A+++' | 'A++' | 'A+' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
type HeatingType = 'gas' | 'electric' | 'district' | 'oil' | 'heatpump'
type InsulationLevel = 'none' | 'basic' | 'good' | 'excellent'
type RoofOrientation = 'south' | 'east-west' | 'north' | 'flat'
type InvestmentCategory = 'quick' | 'medium' | 'major'

interface RenovationItem {
  id: string
  name: string
  category: InvestmentCategory
  costMin: number
  costMax: number
  savingsMin: number
  savingsMax: number
  paybackYearsMin: number
  paybackYearsMax: number
  subsidyAvailable: boolean
  subsidyName?: string
  subsidyAmount?: string
  co2ReductionKg?: number
  labelImprovement?: number // Steps improvement in energy label
  icon: React.ReactNode
  requirements?: string[]
  tips?: string
}

interface CalculatorProps {
  currentLabel?: EnergyLabel
  buildingYear?: number
  sizeM2?: number
  postalCode?: string
}

// Renovation items data
const RENOVATION_ITEMS: RenovationItem[] = [
  // Quick Wins (€100-2,000)
  {
    id: 'led',
    name: 'LED Lighting',
    category: 'quick',
    costMin: 100,
    costMax: 300,
    savingsMin: 50,
    savingsMax: 100,
    paybackYearsMin: 1,
    paybackYearsMax: 3,
    subsidyAvailable: false,
    co2ReductionKg: 50,
    icon: <Zap className="w-4 h-4" />,
    tips: 'Replace all bulbs at once for best savings'
  },
  {
    id: 'thermostat',
    name: 'Smart Thermostat',
    category: 'quick',
    costMin: 150,
    costMax: 400,
    savingsMin: 100,
    savingsMax: 200,
    paybackYearsMin: 1,
    paybackYearsMax: 3,
    subsidyAvailable: false,
    co2ReductionKg: 150,
    icon: <ThermometerSun className="w-4 h-4" />,
    tips: 'Tado, Nest, or Honeywell recommended'
  },
  {
    id: 'draft_strips',
    name: 'Draft Strips & Sealing',
    category: 'quick',
    costMin: 50,
    costMax: 150,
    savingsMin: 50,
    savingsMax: 100,
    paybackYearsMin: 0.5,
    paybackYearsMax: 2,
    subsidyAvailable: false,
    co2ReductionKg: 80,
    icon: <Home className="w-4 h-4" />,
    tips: 'Focus on doors and windows first'
  },
  {
    id: 'radiator_foil',
    name: 'Radiator Foil',
    category: 'quick',
    costMin: 20,
    costMax: 50,
    savingsMin: 30,
    savingsMax: 60,
    paybackYearsMin: 0.3,
    paybackYearsMax: 1,
    subsidyAvailable: false,
    co2ReductionKg: 40,
    icon: <Flame className="w-4 h-4" />,
    tips: 'Install behind all radiators on outside walls'
  },
  {
    id: 'shower_wtw',
    name: 'Shower Heat Recovery (WTW)',
    category: 'quick',
    costMin: 500,
    costMax: 1500,
    savingsMin: 50,
    savingsMax: 150,
    paybackYearsMin: 5,
    paybackYearsMax: 10,
    subsidyAvailable: true,
    subsidyName: 'ISDE',
    subsidyAmount: '€300-500',
    co2ReductionKg: 100,
    icon: <Droplets className="w-4 h-4" />,
    tips: 'Best for households with frequent showers'
  },

  // Medium Investments (€3,000-15,000)
  {
    id: 'hr_glazing',
    name: 'HR++ Double Glazing',
    category: 'medium',
    costMin: 3000,
    costMax: 8000,
    savingsMin: 200,
    savingsMax: 400,
    paybackYearsMin: 10,
    paybackYearsMax: 20,
    subsidyAvailable: true,
    subsidyName: 'ISDE',
    subsidyAmount: 'up to 30%',
    labelImprovement: 1,
    co2ReductionKg: 400,
    icon: <Home className="w-4 h-4" />,
    requirements: ['Current single/double glazing'],
    tips: 'Combine with frame replacement if frames are old'
  },
  {
    id: 'cavity_wall',
    name: 'Cavity Wall Insulation',
    category: 'medium',
    costMin: 1000,
    costMax: 3000,
    savingsMin: 200,
    savingsMax: 500,
    paybackYearsMin: 3,
    paybackYearsMax: 8,
    subsidyAvailable: true,
    subsidyName: 'ISDE',
    subsidyAmount: 'up to 30%',
    labelImprovement: 1,
    co2ReductionKg: 500,
    icon: <Home className="w-4 h-4" />,
    requirements: ['Home built 1920-1980', 'Unfilled cavity walls'],
    tips: 'Check if your home has cavity walls first'
  },
  {
    id: 'floor_insulation',
    name: 'Floor Insulation',
    category: 'medium',
    costMin: 1500,
    costMax: 4000,
    savingsMin: 100,
    savingsMax: 300,
    paybackYearsMin: 8,
    paybackYearsMax: 15,
    subsidyAvailable: true,
    subsidyName: 'ISDE',
    subsidyAmount: 'up to 30%',
    labelImprovement: 0.5,
    co2ReductionKg: 250,
    icon: <Home className="w-4 h-4" />,
    requirements: ['Crawl space accessible'],
    tips: 'Often DIY possible with insulation plates'
  },
  {
    id: 'roof_insulation',
    name: 'Roof Insulation',
    category: 'medium',
    costMin: 3000,
    costMax: 10000,
    savingsMin: 300,
    savingsMax: 600,
    paybackYearsMin: 8,
    paybackYearsMax: 15,
    subsidyAvailable: true,
    subsidyName: 'ISDE',
    subsidyAmount: 'up to 30%',
    labelImprovement: 1,
    co2ReductionKg: 600,
    icon: <Home className="w-4 h-4" />,
    tips: 'Best done during roof renovation'
  },
  {
    id: 'hr_boiler',
    name: 'HR107 CV Boiler',
    category: 'medium',
    costMin: 1500,
    costMax: 3000,
    savingsMin: 100,
    savingsMax: 300,
    paybackYearsMin: 5,
    paybackYearsMax: 15,
    subsidyAvailable: false,
    co2ReductionKg: 200,
    icon: <Flame className="w-4 h-4" />,
    requirements: ['Current boiler >15 years old'],
    tips: 'Consider hybrid heat pump instead for future-proofing'
  },

  // Major Investments (€4,000-25,000)
  {
    id: 'hybrid_heatpump',
    name: 'Hybrid Heat Pump',
    category: 'major',
    costMin: 4000,
    costMax: 8000,
    savingsMin: 400,
    savingsMax: 800,
    paybackYearsMin: 6,
    paybackYearsMax: 12,
    subsidyAvailable: true,
    subsidyName: 'ISDE',
    subsidyAmount: '€1,000-3,000',
    labelImprovement: 1,
    co2ReductionKg: 1000,
    icon: <Leaf className="w-4 h-4" />,
    tips: 'Works with existing radiators, best transition option'
  },
  {
    id: 'full_heatpump',
    name: 'Full Electric Heat Pump',
    category: 'major',
    costMin: 10000,
    costMax: 20000,
    savingsMin: 600,
    savingsMax: 1200,
    paybackYearsMin: 10,
    paybackYearsMax: 20,
    subsidyAvailable: true,
    subsidyName: 'ISDE',
    subsidyAmount: '€3,000-5,000',
    labelImprovement: 2,
    co2ReductionKg: 2000,
    icon: <Leaf className="w-4 h-4" />,
    requirements: ['Good insulation (label C or better)', 'Underfloor heating preferred'],
    tips: 'Best combined with solar panels'
  },
  {
    id: 'solar_panels',
    name: 'Solar Panels (10 panels)',
    category: 'major',
    costMin: 4000,
    costMax: 8000,
    savingsMin: 400,
    savingsMax: 800,
    paybackYearsMin: 6,
    paybackYearsMax: 12,
    subsidyAvailable: true,
    subsidyName: '0% BTW',
    subsidyAmount: '21% tax saving',
    labelImprovement: 1,
    co2ReductionKg: 1500,
    icon: <Sun className="w-4 h-4" />,
    tips: 'South-facing roof is ideal, east-west also works'
  },
  {
    id: 'solar_boiler',
    name: 'Solar Boiler',
    category: 'major',
    costMin: 2000,
    costMax: 5000,
    savingsMin: 150,
    savingsMax: 300,
    paybackYearsMin: 8,
    paybackYearsMax: 20,
    subsidyAvailable: true,
    subsidyName: 'ISDE',
    subsidyAmount: '€500-1,000',
    co2ReductionKg: 300,
    icon: <Sun className="w-4 h-4" />,
    tips: 'Good for households with high hot water usage'
  },
  {
    id: 'home_battery',
    name: 'Home Battery',
    category: 'major',
    costMin: 5000,
    costMax: 12000,
    savingsMin: 200,
    savingsMax: 500,
    paybackYearsMin: 15,
    paybackYearsMax: 30,
    subsidyAvailable: false,
    co2ReductionKg: 200,
    icon: <Zap className="w-4 h-4" />,
    requirements: ['Solar panels installed'],
    tips: 'Best combined with dynamic energy contract'
  },
  {
    id: 'ev_charger',
    name: 'EV Charger',
    category: 'major',
    costMin: 1000,
    costMax: 2500,
    savingsMin: 0,
    savingsMax: 0,
    paybackYearsMin: 0,
    paybackYearsMax: 0,
    subsidyAvailable: true,
    subsidyName: 'Municipal',
    subsidyAmount: 'Varies',
    co2ReductionKg: 0,
    icon: <Zap className="w-4 h-4" />,
    tips: 'Essential for EV owners, increases home value'
  }
]

// Subsidy programs
const SUBSIDY_PROGRAMS = {
  isde: {
    name: 'ISDE (Investeringssubsidie Duurzame Energie)',
    description: 'Government subsidy for sustainable energy investments',
    url: 'https://www.rvo.nl/subsidies-financiering/isde',
    measures: ['Heat pumps', 'Solar boilers', 'Insulation', 'HR++ glazing']
  },
  seeh: {
    name: 'SEEH (Subsidie Energiebesparing Eigen Huis)',
    description: 'Subsidy for combining 2+ insulation measures',
    url: 'https://www.rvo.nl/subsidies-financiering/seeh',
    measures: ['Floor insulation', 'Roof insulation', 'Wall insulation', 'Glazing']
  },
  btw: {
    name: '0% BTW on Solar Panels',
    description: 'No VAT on solar panel purchases for homes',
    url: 'https://www.belastingdienst.nl/wps/wcm/connect/nl/btw/content/btw-tarief-zonnepanelen',
    measures: ['Solar panels']
  }
}

// Energy label order for calculations
const LABEL_ORDER: EnergyLabel[] = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'A+', 'A++', 'A+++', 'A++++']

function getLabelIndex(label: EnergyLabel): number {
  return LABEL_ORDER.indexOf(label)
}

function getProjectedLabel(currentLabel: EnergyLabel, improvement: number): EnergyLabel {
  const currentIndex = getLabelIndex(currentLabel)
  const newIndex = Math.min(currentIndex + Math.round(improvement), LABEL_ORDER.length - 1)
  return LABEL_ORDER[newIndex]
}

export default function RenovationCalculator({
  currentLabel = 'D',
  buildingYear = 1980,
  sizeM2 = 100,
  postalCode
}: CalculatorProps) {
  const t = useTranslations('renovation')

  // State
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [budget, setBudget] = useState<'quick' | 'medium' | 'major' | 'all'>('all')
  const [showSubsidies, setShowSubsidies] = useState(false)
  const [expandedCategory, setExpandedCategory] = useState<InvestmentCategory | null>('quick')

  // Input state
  const [inputLabel, setInputLabel] = useState<EnergyLabel>(currentLabel)
  const [inputSize, setInputSize] = useState(sizeM2)
  const [heatingType, setHeatingType] = useState<HeatingType>('gas')
  const [roofOrientation, setRoofOrientation] = useState<RoofOrientation>('south')

  // Filter items by budget category
  const filteredItems = useMemo(() => {
    if (budget === 'all') return RENOVATION_ITEMS
    return RENOVATION_ITEMS.filter(item => item.category === budget)
  }, [budget])

  // Group items by category
  const groupedItems = useMemo(() => {
    return {
      quick: RENOVATION_ITEMS.filter(i => i.category === 'quick'),
      medium: RENOVATION_ITEMS.filter(i => i.category === 'medium'),
      major: RENOVATION_ITEMS.filter(i => i.category === 'major')
    }
  }, [])

  // Calculate totals for selected items
  const totals = useMemo(() => {
    const selected = RENOVATION_ITEMS.filter(item => selectedItems.has(item.id))

    const costMin = selected.reduce((sum, item) => sum + item.costMin, 0)
    const costMax = selected.reduce((sum, item) => sum + item.costMax, 0)
    const savingsMin = selected.reduce((sum, item) => sum + item.savingsMin, 0)
    const savingsMax = selected.reduce((sum, item) => sum + item.savingsMax, 0)
    const co2Reduction = selected.reduce((sum, item) => sum + (item.co2ReductionKg || 0), 0)
    const labelImprovement = selected.reduce((sum, item) => sum + (item.labelImprovement || 0), 0)
    const subsidyItems = selected.filter(item => item.subsidyAvailable)

    // Calculate average payback
    const avgPaybackMin = selected.length > 0
      ? costMin / (savingsMax || 1)
      : 0
    const avgPaybackMax = selected.length > 0
      ? costMax / (savingsMin || 1)
      : 0

    // Projected label
    const projectedLabel = getProjectedLabel(inputLabel, labelImprovement)

    return {
      costMin,
      costMax,
      savingsMin,
      savingsMax,
      avgPaybackMin,
      avgPaybackMax,
      co2Reduction,
      labelImprovement,
      projectedLabel,
      subsidyItems,
      itemCount: selected.length
    }
  }, [selectedItems, inputLabel])

  // Toggle item selection
  const toggleItem = (id: string) => {
    const newSet = new Set(selectedItems)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedItems(newSet)
  }

  // Select all in category
  const selectCategory = (category: InvestmentCategory) => {
    const categoryItems = RENOVATION_ITEMS.filter(i => i.category === category)
    const newSet = new Set(selectedItems)
    categoryItems.forEach(item => newSet.add(item.id))
    setSelectedItems(newSet)
  }

  // Clear all selections
  const clearAll = () => {
    setSelectedItems(new Set())
  }

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(amount)
  }

  // Category header component
  const CategoryHeader = ({
    category,
    title,
    icon,
    budgetRange
  }: {
    category: InvestmentCategory
    title: string
    icon: React.ReactNode
    budgetRange: string
  }) => {
    const isExpanded = expandedCategory === category
    const categoryItems = groupedItems[category]
    const selectedCount = categoryItems.filter(i => selectedItems.has(i.id)).length

    return (
      <button
        onClick={() => setExpandedCategory(isExpanded ? null : category)}
        className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon}
          <div className="text-left">
            <div className="font-medium text-gray-900">{title}</div>
            <div className="text-xs text-gray-500">{budgetRange}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedCount > 0 && (
            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
              {selectedCount} selected
            </span>
          )}
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>
    )
  }

  // Renovation item card
  const RenovationItemCard = ({ item }: { item: RenovationItem }) => {
    const isSelected = selectedItems.has(item.id)

    return (
      <div
        onClick={() => toggleItem(item.id)}
        className={`p-3 rounded-lg border cursor-pointer transition-all ${
          isSelected
            ? 'bg-green-50 border-green-300 ring-1 ring-green-300'
            : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded ${isSelected ? 'bg-green-100' : 'bg-gray-100'}`}>
              {item.icon}
            </div>
            <div>
              <div className={`font-medium text-sm ${isSelected ? 'text-green-900' : 'text-gray-900'}`}>
                {item.name}
              </div>
              <div className="text-xs text-gray-500">
                {formatCurrency(item.costMin)} - {formatCurrency(item.costMax)}
              </div>
            </div>
          </div>
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
            isSelected
              ? 'bg-green-500 border-green-500'
              : 'border-gray-300'
          }`}>
            {isSelected && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1 text-gray-600">
            <Euro className="w-3 h-3" />
            <span>{formatCurrency(item.savingsMin)}-{formatCurrency(item.savingsMax)}/yr</span>
          </div>
          <div className="flex items-center gap-1 text-gray-600">
            <Clock className="w-3 h-3" />
            <span>{item.paybackYearsMin}-{item.paybackYearsMax} yr payback</span>
          </div>
        </div>

        {item.subsidyAvailable && (
          <div className="mt-2 flex items-center gap-1 text-xs text-blue-600">
            <Sparkles className="w-3 h-3" />
            <span>{item.subsidyName}: {item.subsidyAmount}</span>
          </div>
        )}

        {item.tips && (
          <div className="mt-2 text-xs text-gray-500 italic">
            💡 {item.tips}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-700 text-white p-4">
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5" />
          <h3 className="font-semibold">{t('title')}</h3>
        </div>
        <p className="text-sm text-green-100 mt-1">{t('subtitle')}</p>
      </div>

      {/* Property Inputs */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {t('currentLabel')}
            </label>
            <select
              value={inputLabel}
              onChange={(e) => setInputLabel(e.target.value as EnergyLabel)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              {LABEL_ORDER.map(label => (
                <option key={label} value={label}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {t('homeSize')}
            </label>
            <input
              type="number"
              value={inputSize}
              onChange={(e) => setInputSize(parseInt(e.target.value) || 0)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
              min="20"
              max="500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {t('heatingType')}
            </label>
            <select
              value={heatingType}
              onChange={(e) => setHeatingType(e.target.value as HeatingType)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="gas">{t('heatingGas')}</option>
              <option value="electric">{t('heatingElectric')}</option>
              <option value="district">{t('heatingDistrict')}</option>
              <option value="heatpump">{t('heatingHeatpump')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {t('roofOrientation')}
            </label>
            <select
              value={roofOrientation}
              onChange={(e) => setRoofOrientation(e.target.value as RoofOrientation)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="south">{t('roofSouth')}</option>
              <option value="east-west">{t('roofEastWest')}</option>
              <option value="north">{t('roofNorth')}</option>
              <option value="flat">{t('roofFlat')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Results */}
      {totals.itemCount > 0 && (
        <div className="p-4 border-b border-gray-200 bg-gradient-to-br from-green-50 to-emerald-50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">
              {t('selectedMeasures', { count: totals.itemCount })}
            </span>
            <button
              onClick={clearAll}
              className="text-xs text-red-600 hover:text-red-800"
            >
              {t('clearAll')}
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Total Cost */}
            <div className="bg-white rounded-lg p-3 border border-green-200">
              <div className="text-xs text-gray-500 mb-1">{t('totalCost')}</div>
              <div className="text-lg font-bold text-gray-900">
                {formatCurrency(totals.costMin)} - {formatCurrency(totals.costMax)}
              </div>
            </div>

            {/* Annual Savings */}
            <div className="bg-white rounded-lg p-3 border border-green-200">
              <div className="text-xs text-gray-500 mb-1">{t('annualSavings')}</div>
              <div className="text-lg font-bold text-green-600">
                {formatCurrency(totals.savingsMin)} - {formatCurrency(totals.savingsMax)}
              </div>
            </div>

            {/* Payback Period */}
            <div className="bg-white rounded-lg p-3 border border-green-200">
              <div className="text-xs text-gray-500 mb-1">{t('paybackPeriod')}</div>
              <div className="text-lg font-bold text-gray-900">
                {totals.avgPaybackMin.toFixed(0)} - {totals.avgPaybackMax.toFixed(0)} {t('years')}
              </div>
            </div>

            {/* Label Improvement */}
            <div className="bg-white rounded-lg p-3 border border-green-200">
              <div className="text-xs text-gray-500 mb-1">{t('labelProjection')}</div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-sm font-bold ${
                  getLabelIndex(inputLabel) < 4 ? 'bg-red-100 text-red-700' :
                  getLabelIndex(inputLabel) < 6 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {inputLabel}
                </span>
                <TrendingUp className="w-4 h-4 text-gray-400" />
                <span className={`px-2 py-0.5 rounded text-sm font-bold ${
                  getLabelIndex(totals.projectedLabel) < 4 ? 'bg-red-100 text-red-700' :
                  getLabelIndex(totals.projectedLabel) < 6 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {totals.projectedLabel}
                </span>
              </div>
            </div>
          </div>

          {/* CO2 Reduction */}
          {totals.co2Reduction > 0 && (
            <div className="mt-3 flex items-center gap-2 text-sm text-green-700">
              <Leaf className="w-4 h-4" />
              <span>{t('co2Reduction', { amount: totals.co2Reduction })}</span>
            </div>
          )}

          {/* Subsidy Indicator */}
          {totals.subsidyItems.length > 0 && (
            <div className="mt-2 flex items-center gap-2 text-sm text-blue-700">
              <Sparkles className="w-4 h-4" />
              <span>{t('subsidyAvailable', { count: totals.subsidyItems.length })}</span>
              <button
                onClick={() => setShowSubsidies(!showSubsidies)}
                className="text-blue-600 hover:underline"
              >
                {showSubsidies ? t('hideDetails') : t('showDetails')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Subsidy Details */}
      {showSubsidies && (
        <div className="p-4 border-b border-gray-200 bg-blue-50">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            {t('availableSubsidies')}
          </h4>
          <div className="space-y-3">
            {Object.entries(SUBSIDY_PROGRAMS).map(([key, program]) => (
              <div key={key} className="bg-white rounded-lg p-3 border border-blue-200">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-sm text-gray-900">{program.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{program.description}</div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {program.measures.map(measure => (
                        <span key={measure} className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                          {measure}
                        </span>
                      ))}
                    </div>
                  </div>
                  <a
                    href={program.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Renovation Items */}
      <div className="p-4 space-y-4">
        {/* Quick Wins */}
        <div>
          <CategoryHeader
            category="quick"
            title={t('quickWins')}
            icon={<Zap className="w-5 h-5 text-yellow-500" />}
            budgetRange="€50 - €2,000"
          />
          {expandedCategory === 'quick' && (
            <div className="mt-3 grid gap-2">
              {groupedItems.quick.map(item => (
                <RenovationItemCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>

        {/* Medium Investments */}
        <div>
          <CategoryHeader
            category="medium"
            title={t('mediumInvestments')}
            icon={<Home className="w-5 h-5 text-blue-500" />}
            budgetRange="€1,000 - €10,000"
          />
          {expandedCategory === 'medium' && (
            <div className="mt-3 grid gap-2">
              {groupedItems.medium.map(item => (
                <RenovationItemCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>

        {/* Major Investments */}
        <div>
          <CategoryHeader
            category="major"
            title={t('majorInvestments')}
            icon={<Sun className="w-5 h-5 text-green-500" />}
            budgetRange="€4,000 - €25,000"
          />
          {expandedCategory === 'major' && (
            <div className="mt-3 grid gap-2">
              {groupedItems.major.map(item => (
                <RenovationItemCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-start gap-2 text-xs text-gray-500">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>
            {t('disclaimer')}
          </p>
        </div>
      </div>
    </div>
  )
}
