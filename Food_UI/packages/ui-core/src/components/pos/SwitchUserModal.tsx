import React, { useState } from 'react'
import { X, LogIn, ArrowLeft, UserCircle2, Delete } from 'lucide-react'
import { employeesApi } from '@flowtap/api-core'
import { useAppDispatch, useAppSelector } from '@flowtap/store'
import { loginAsEmployee, loginAsOwnerViaPin, switchBackToOwner } from '@flowtap/store'
import { clearCashier } from '@flowtap/store'
import { cn } from '@flowtap/shared'
import toast from 'react-hot-toast'

interface EmployeeListItem {
  id: string
  name: string
  jobTitle?: string
  avatarInitials?: string
}

interface SwitchUserModalProps {
  companyId: string
  employees: EmployeeListItem[]
  onClose: () => void
}

// ─── PIN Pad ──────────────────────────────────────────────────────────────────

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const

const PinPad: React.FC<{
  companyId: string
  employee: EmployeeListItem
  onSuccess: () => void
  onBack: () => void
}> = ({ companyId, employee, onSuccess, onBack }) => {
  const dispatch = useAppDispatch()
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)
  const MAX = 6

  const handleKey = (k: string) => {
    if (k === 'del') { setPin((p) => p.slice(0, -1)); return }
    if (pin.length >= MAX) return
    const next = pin + k
    setPin(next)
    if (next.length >= 4) tryLogin(next)
  }

  const tryLogin = async (value: string) => {
    setLoading(true)
    try {
      const res = await employeesApi.pinLogin(companyId, value)
      const data = res.data?.data
      if (!data) throw new Error('No data')

      const sessionUser = {
        id:          data.userAccountId,
        email:       data.email ?? '',
        name:        data.name,
        employeeId:  data.employeeId,
        jobTitle:    data.jobTitle,
        permissions: data.permissions,
        defaultLocationId: data.defaultLocationId,
      }

      if (data.isOwner) {
        // Owner / Admin PIN — restore full unrestricted session, clear any employee stack
        dispatch(loginAsOwnerViaPin({ token: data.accessToken, user: sessionUser }))
        toast.success(`Switched to owner: ${data.name}`)
      } else {
        // Regular employee PIN — restricted to their granted permissions
        dispatch(loginAsEmployee({ token: data.accessToken, user: sessionUser }))
        toast.success(`Logged in as ${data.name}`)
      }

      onSuccess()
    } catch {
      setShake(true)
      setPin('')
      setTimeout(() => setShake(false), 500)
      toast.error('Wrong PIN — try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      {/* Avatar + name */}
      <div className="flex flex-col items-center gap-2">
        <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-2xl font-bold text-blue-700 dark:text-blue-300">
          {employee.avatarInitials ?? employee.name[0]?.toUpperCase() ?? '?'}
        </div>
        <div className="text-center">
          <p className="font-semibold text-gray-900 dark:text-white">{employee.name}</p>
          {employee.jobTitle && <p className="text-xs text-gray-500">{employee.jobTitle}</p>}
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">Enter your PIN to log in</p>
        </div>
      </div>

      {/* PIN dots */}
      <div className={cn('flex gap-3', shake && 'animate-shake')}>
        {Array.from({ length: MAX }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'w-4 h-4 rounded-full border-2 transition-all duration-100',
              i < pin.length
                ? 'bg-blue-600 border-blue-600 scale-110'
                : 'border-gray-300 dark:border-gray-600'
            )}
          />
        ))}
      </div>

      {loading && (
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      )}

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-[240px]">
        {KEYS.map((k, i) => {
          if (k === '') return <div key={i} />
          if (k === 'del') return (
            <button
              key={k}
              onClick={() => handleKey('del')}
              disabled={loading || pin.length === 0}
              className="h-14 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-40 active:scale-95"
            >
              <Delete className="w-5 h-5" />
            </button>
          )
          return (
            <button
              key={k}
              onClick={() => handleKey(k)}
              disabled={loading || pin.length >= MAX}
              className="h-14 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-semibold text-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-40 active:scale-95"
            >
              {k}
            </button>
          )
        })}
      </div>

      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
    </div>
  )
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export const SwitchUserModal: React.FC<SwitchUserModalProps> = ({
  companyId, employees, onClose,
}) => {
  const dispatch = useAppDispatch()
  const currentUser = useAppSelector((s) => s.auth.user)
  const ownerUser   = useAppSelector((s) => s.auth.ownerUser)
  const [selected, setSelected] = useState<EmployeeListItem | null>(null)

  const handleSuccess = () => onClose()

  const handleSwitchToOwner = () => {
    dispatch(switchBackToOwner())
    dispatch(clearCashier())
    toast.success('Switched back to owner account')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-100 dark:border-gray-700 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            {selected && (
              <button
                onClick={() => setSelected(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <span className="font-semibold text-gray-900 dark:text-white">
              {selected ? 'Enter PIN' : 'Switch Account'}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {selected ? (
            <PinPad
              companyId={companyId}
              employee={selected}
              onSuccess={handleSuccess}
              onBack={() => setSelected(null)}
            />
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Select your account and enter your PIN to log in.
              </p>

              {/* Currently logged-in indicator */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                  {currentUser?.name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 truncate">
                    {currentUser?.name ?? 'Unknown'}
                  </p>
                  <p className="text-[10px] text-blue-600 dark:text-blue-400">Currently logged in</p>
                </div>
              </div>

              {/* Employee list */}
              {employees.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <UserCircle2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-medium">No employees found</p>
                  <p className="text-xs mt-1">Add employees with PINs in the Employees section</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {employees.map((emp) => {
                    const isCurrent = emp.id === currentUser?.employeeId
                    const initials = emp.avatarInitials
                      ?? emp.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                    return (
                      <button
                        key={emp.id}
                        onClick={() => setSelected(emp)}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all border',
                          isCurrent
                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
                            : 'bg-gray-50 dark:bg-gray-800 border-transparent hover:border-gray-200 dark:hover:border-gray-600 hover:bg-white dark:hover:bg-gray-750'
                        )}
                      >
                        <div className={cn(
                          'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0',
                          isCurrent
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        )}>
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{emp.name}</p>
                          {emp.jobTitle && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{emp.jobTitle}</p>
                          )}
                        </div>
                        <LogIn className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Switch back to owner (only visible when an employee is currently logged in) */}
              {ownerUser && (
                <button
                  onClick={handleSwitchToOwner}
                  className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300">
                    {ownerUser.name?.[0]?.toUpperCase() ?? 'O'}
                  </div>
                  <span>Switch back to <strong>{ownerUser.name}</strong> (owner)</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
