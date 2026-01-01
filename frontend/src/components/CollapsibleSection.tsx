'use client'

import { useState, ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface CollapsibleSectionProps {
  title: string
  icon?: string
  children: ReactNode
  defaultOpen?: boolean
  badge?: string | number
  badgeColor?: 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'gray'
  className?: string
}

const badgeColors = {
  red: 'bg-red-100 text-red-700',
  orange: 'bg-orange-100 text-orange-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  green: 'bg-green-100 text-green-700',
  blue: 'bg-blue-100 text-blue-700',
  gray: 'bg-gray-100 text-gray-600',
}

export default function CollapsibleSection({
  title,
  icon,
  children,
  defaultOpen = true,
  badge,
  badgeColor = 'gray',
  className = ''
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className={`border-b border-gray-100 last:border-b-0 ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-3 px-1 hover:bg-gray-50 transition-colors rounded-lg group"
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-base">{icon}</span>}
          <span className="font-semibold text-sm text-gray-800">{title}</span>
          {badge !== undefined && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${badgeColors[badgeColor]}`}>
              {badge}
            </span>
          )}
        </div>
        <div className="text-gray-400 group-hover:text-gray-600 transition-colors">
          {isOpen ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </div>
      </button>

      <div
        className={`overflow-hidden transition-all duration-200 ease-in-out ${
          isOpen ? 'max-h-[2000px] opacity-100 pb-3' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="space-y-3">
          {children}
        </div>
      </div>
    </div>
  )
}
