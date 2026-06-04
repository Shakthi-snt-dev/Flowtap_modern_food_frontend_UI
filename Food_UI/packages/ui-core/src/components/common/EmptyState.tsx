import React from 'react'
import { PackageOpen } from 'lucide-react'

interface EmptyStateProps {
  title?: string
  description?: string
  action?: React.ReactNode
  icon?: React.ReactNode
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No data found',
  description = 'Get started by creating your first entry.',
  action,
  icon,
}) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="text-gray-300 mb-4">{icon ?? <PackageOpen className="w-16 h-16" />}</div>
    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">{title}</h3>
    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-sm">{description}</p>
    {action}
  </div>
)
