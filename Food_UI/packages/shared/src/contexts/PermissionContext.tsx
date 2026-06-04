import React, { createContext, useContext, useMemo } from 'react'
import { useAppSelector } from '@flowtap/store'

interface PermissionContextValue {
  can: (module: string) => boolean
  isAdmin: boolean
  isEmployee: boolean
  modules: string[]
}

const PermissionContext = createContext<PermissionContextValue>({
  can: () => true,
  isAdmin: true,
  isEmployee: false,
  modules: [],
})

export const PermissionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const tenantModules = useAppSelector((s) => s.tenant.tenant?.modules ?? [])
  const user          = useAppSelector((s) => s.auth.user)
  const ownerUser     = useAppSelector((s) => s.auth.ownerUser)

  const isPinEmployee    = ownerUser !== null
  const isDirectEmployee = !isPinEmployee && !!user?.role && user.role !== 'Owner' && user.role !== 'Admin'
  const isEmployee = isPinEmployee || isDirectEmployee

  const value = useMemo<PermissionContextValue>(() => {
    if (isPinEmployee) {
      const empPerms: Record<string, boolean> = user?.permissions ?? {}
      const can = (module: string): boolean => {
        if (tenantModules.length > 0 && !tenantModules.includes(module)) return false
        return empPerms[module] === true
      }
      return { can, isAdmin: false, isEmployee: true, modules: tenantModules }
    }
    if (isDirectEmployee) {
      const empPerms: Record<string, boolean> = user?.permissions ?? {}
      const can = (module: string): boolean => {
        if (module !== 'Settings' && tenantModules.length > 0 && !tenantModules.includes(module)) return false
        if (empPerms[module] === true) return true
        if (module === 'Settings') return false
        return true
      }
      return { can, isAdmin: false, isEmployee: true, modules: tenantModules }
    }
    return { can: () => true, isAdmin: true, isEmployee: false, modules: tenantModules }
  }, [isPinEmployee, isDirectEmployee, user?.permissions, tenantModules])

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  )
}

export const usePermission = () => useContext(PermissionContext)
// re-export so consumers have the type
export type { PermissionContextValue }
