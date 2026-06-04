import React from 'react'
import { cn } from '@flowtap/shared'

export const Spinner: React.FC<{ size?: 'sm' | 'md' | 'lg'; className?: string }> = ({
  size = 'md',
  className,
}) => {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' }
  return (
    <div
      className={cn(
        'border-2 border-blue-500 border-t-transparent rounded-full animate-spin',
        sizes[size],
        className
      )}
    />
  )
}

export const PageLoader: React.FC = () => (
  <div className="flex items-center justify-center h-64">
    <Spinner size="lg" />
  </div>
)
