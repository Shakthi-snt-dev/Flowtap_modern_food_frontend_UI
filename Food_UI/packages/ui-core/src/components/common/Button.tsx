import React from 'react'
import { cn } from '@flowtap/shared'
import { Loader2 } from 'lucide-react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: React.ReactNode
}

const variants = {
  // primary/outline use --a-* CSS vars → automatically pick up the active accent (food-orange, blue, etc.)
  primary:   'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 disabled:bg-blue-300',
  secondary: 'bg-primary-50 text-blue-700 hover:bg-primary-100 focus:ring-blue-400 dark:bg-gray-700 dark:text-gray-200',
  ghost:     'bg-transparent text-gray-600 hover:bg-primary-50 dark:text-gray-300 dark:hover:bg-gray-800',
  danger:    'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:bg-red-300',
  outline:   'border border-blue-300 text-blue-700 hover:bg-primary-50 dark:border-gray-600 dark:text-gray-300',
}

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary', size = 'md', loading, icon, children, className, disabled, ...props
}) => (
  <button
    className={cn(
      'inline-flex items-center gap-2 font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
      variants[variant], sizes[size], className
    )}
    disabled={disabled || loading}
    {...props}
  >
    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
    {children}
  </button>
)
