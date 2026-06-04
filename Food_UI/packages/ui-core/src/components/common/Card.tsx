import React from 'react'
import { cn } from '@flowtap/shared'

interface CardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
  hoverable?: boolean
}

export const Card: React.FC<CardProps> = ({ children, className, onClick, hoverable }) => (
  <div
    onClick={onClick}
    className={cn(
      'bg-white dark:bg-gray-800 rounded-xl shadow-card',
      hoverable && 'cursor-pointer hover:shadow-md transition-all',
      className
    )}
    style={{ border: '1px solid var(--card-border)' }}
  >
    {children}
  </div>
)

export const CardHeader: React.FC<{ title: string; subtitle?: React.ReactNode; action?: React.ReactNode }> = ({
  title,
  subtitle,
  action,
}) => (
  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
    <div>
      <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
      {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
    {action}
  </div>
)

export const CardBody: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cn('p-6', className)}>{children}</div>
)
