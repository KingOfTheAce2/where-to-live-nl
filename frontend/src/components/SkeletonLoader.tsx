'use client'

interface SkeletonProps {
  className?: string
}

// Basic skeleton line
export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
  )
}

// Skeleton for a card with title and content
export function CardSkeleton() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/3 mb-3"></div>
      <div className="space-y-2">
        <div className="h-3 bg-gray-100 rounded w-full"></div>
        <div className="h-3 bg-gray-100 rounded w-5/6"></div>
        <div className="h-3 bg-gray-100 rounded w-4/6"></div>
      </div>
    </div>
  )
}

// Skeleton for score/stat cards
export function ScoreCardSkeleton() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-2/5 mb-3"></div>
      <div className="flex items-center justify-center py-4">
        <div className="h-12 w-16 bg-gray-200 rounded"></div>
      </div>
      <div className="h-3 bg-gray-100 rounded w-3/4 mx-auto"></div>
    </div>
  )
}

// Skeleton for list items
export function ListSkeleton({ items = 4 }: { items?: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/3 mb-3"></div>
      <div className="space-y-2">
        {[...Array(items)].map((_, i) => (
          <div key={i} className="flex justify-between items-center py-1">
            <div className="h-3 bg-gray-100 rounded w-2/5"></div>
            <div className="h-3 bg-gray-200 rounded w-1/5"></div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Skeleton for the At A Glance card
export function AtAGlanceSkeleton() {
  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-5 w-5 bg-blue-200 rounded"></div>
        <div className="h-5 bg-blue-200 rounded w-2/3"></div>
      </div>
      <div className="grid grid-cols-4 gap-2 mb-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="text-center p-2 bg-blue-100/50 rounded-lg">
            <div className="h-6 bg-blue-200 rounded w-12 mx-auto mb-1"></div>
            <div className="h-2 bg-blue-100 rounded w-3/4 mx-auto"></div>
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-4">
        <div className="h-4 bg-blue-100 rounded w-24"></div>
        <div className="h-4 bg-blue-100 rounded w-24"></div>
      </div>
    </div>
  )
}

// Full sidebar skeleton
export function SidebarSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <AtAGlanceSkeleton />
      <CardSkeleton />
      <ListSkeleton items={3} />
      <ScoreCardSkeleton />
      <ListSkeleton items={5} />
    </div>
  )
}
