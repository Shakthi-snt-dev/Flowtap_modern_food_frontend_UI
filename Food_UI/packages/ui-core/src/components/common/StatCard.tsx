import React from 'react'
import { cn } from '@flowtap/shared'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  change?: number
  changeLabel?: string
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red'
}

const colors = {
  // blue/orange use --a-* CSS vars → auto-respond to active accent (food-orange, blue, etc.)
  blue:   'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
  green:  'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
  purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
  orange: 'bg-primary-50 text-blue-600 dark:bg-primary-900/20 dark:text-blue-400',   // food-orange via --a-* vars
  red:    'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  change,
  changeLabel,
  color = 'blue',
}) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-card" style={{ border: '1px solid var(--card-border)' }}>
    <div className="flex items-start justify-between mb-3">
      <div className={cn('p-2.5 rounded-xl', colors[color])}>{icon}</div>
      {change !== undefined && (
        <div
          className={cn(
            'flex items-center gap-1 text-xs font-medium',
            change >= 0 ? 'text-green-600' : 'text-red-500'
          )}
        >
          {change >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          {Math.abs(change)}%
        </div>
      )}
    </div>
    <div className="text-2xl font-bold text-gray-900 dark:text-white mb-0.5">{value}</div>
    <div className="text-sm text-gray-500 dark:text-gray-400">{title}</div>
    {changeLabel && <div className="text-xs text-gray-400 mt-1">{changeLabel}</div>}
  </div>
)
