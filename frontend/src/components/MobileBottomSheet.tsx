'use client'

import { useState, useRef, useEffect, ReactNode } from 'react'
import { ChevronUp, ChevronDown, X } from 'lucide-react'

interface MobileBottomSheetProps {
  children: ReactNode
  summaryContent?: ReactNode // Content shown when collapsed
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
  snapPoints?: ('collapsed' | 'half' | 'full')[]
  defaultSnap?: 'collapsed' | 'half' | 'full'
  className?: string
}

const snapHeights = {
  collapsed: 80, // Just enough to show the handle and summary
  half: 50, // 50% of viewport
  full: 90, // 90% of viewport
}

export default function MobileBottomSheet({
  children,
  summaryContent,
  isOpen = false,
  onOpenChange,
  snapPoints = ['collapsed', 'half', 'full'],
  defaultSnap = 'collapsed',
  className = ''
}: MobileBottomSheetProps) {
  const [currentSnap, setCurrentSnap] = useState<'collapsed' | 'half' | 'full'>(defaultSnap)
  const [isDragging, setIsDragging] = useState(false)
  const [startY, setStartY] = useState(0)
  const [currentY, setCurrentY] = useState(0)
  const sheetRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Calculate height based on snap point
  const getHeight = () => {
    if (isDragging && currentY !== 0) {
      const viewportHeight = window.innerHeight
      const draggedHeight = viewportHeight - currentY
      const minHeight = snapHeights.collapsed
      const maxHeight = viewportHeight * (snapHeights.full / 100)
      return Math.max(minHeight, Math.min(maxHeight, draggedHeight))
    }

    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800
    switch (currentSnap) {
      case 'collapsed':
        return snapHeights.collapsed
      case 'half':
        return viewportHeight * (snapHeights.half / 100)
      case 'full':
        return viewportHeight * (snapHeights.full / 100)
    }
  }

  // Handle drag start
  const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    setIsDragging(true)
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    setStartY(clientY)
    setCurrentY(clientY)
  }

  // Handle drag move
  const handleDragMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    setCurrentY(clientY)
  }

  // Handle drag end - snap to closest point
  const handleDragEnd = () => {
    if (!isDragging) return
    setIsDragging(false)

    const viewportHeight = window.innerHeight
    const currentHeight = viewportHeight - currentY
    const heightPercentage = (currentHeight / viewportHeight) * 100

    // Find closest snap point
    let newSnap: 'collapsed' | 'half' | 'full' = 'collapsed'

    if (heightPercentage > 70) {
      newSnap = 'full'
    } else if (heightPercentage > 30) {
      newSnap = 'half'
    } else {
      newSnap = 'collapsed'
    }

    // Only use snap points that are enabled
    if (!snapPoints.includes(newSnap)) {
      // Find nearest enabled snap point
      const availableSnaps = snapPoints.filter(s => s !== newSnap)
      newSnap = availableSnaps[0] || 'collapsed'
    }

    setCurrentSnap(newSnap)
    setCurrentY(0)
    onOpenChange?.(newSnap !== 'collapsed')
  }

  // Toggle between collapsed and half
  const handleToggle = () => {
    const newSnap = currentSnap === 'collapsed' ? 'half' : 'collapsed'
    setCurrentSnap(newSnap)
    onOpenChange?.(newSnap !== 'collapsed')
  }

  // Expand to full
  const handleExpand = () => {
    if (snapPoints.includes('full')) {
      setCurrentSnap('full')
      onOpenChange?.(true)
    }
  }

  // Collapse
  const handleCollapse = () => {
    setCurrentSnap('collapsed')
    onOpenChange?.(false)
  }

  // External control
  useEffect(() => {
    if (isOpen && currentSnap === 'collapsed') {
      setCurrentSnap('half')
    } else if (!isOpen && currentSnap !== 'collapsed') {
      setCurrentSnap('collapsed')
    }
  }, [isOpen])

  return (
    <div
      ref={sheetRef}
      className={`fixed bottom-0 left-0 right-0 z-40 bg-white rounded-t-2xl shadow-2xl transition-all duration-300 ease-out ${isDragging ? 'transition-none' : ''} ${className}`}
      style={{
        height: getHeight(),
        maxHeight: '90vh'
      }}
    >
      {/* Drag Handle */}
      <div
        className="sticky top-0 bg-white rounded-t-2xl z-10 cursor-grab active:cursor-grabbing"
        onTouchStart={handleDragStart}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
        onMouseDown={handleDragStart}
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
      >
        {/* Handle bar */}
        <div className="flex justify-center py-2">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Summary header when collapsed */}
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between">
            {currentSnap === 'collapsed' && summaryContent ? (
              <div className="flex-1" onClick={handleToggle}>
                {summaryContent}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCollapse}
                  className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500"
                  aria-label="Collapse"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
                {currentSnap !== 'full' && snapPoints.includes('full') && (
                  <button
                    onClick={handleExpand}
                    className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500"
                    aria-label="Expand"
                  >
                    <ChevronUp className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}

            {currentSnap !== 'collapsed' && (
              <button
                onClick={handleCollapse}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div
        ref={contentRef}
        className="overflow-y-auto overscroll-contain"
        style={{
          height: `calc(100% - 60px)`,
          display: currentSnap === 'collapsed' ? 'none' : 'block'
        }}
      >
        {children}
      </div>
    </div>
  )
}
