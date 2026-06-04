import React, { useState, useEffect, useCallback } from 'react'
import { useAppDispatch } from '@flowtap/store'
import { logout } from '@flowtap/store'
import { superAdminApi } from '@flowtap/api-core'
import {
  Building2, Users, LogOut, RefreshCw, Search, ShieldCheck,
  ToggleLeft, ToggleRight, KeyRound, X, Eye, EyeOff,
} from 'lucide-react'
import { cn } from '@flowtap/shared'

interface TenantSummary {
  id: string
  title: string
  businessType: string
  country: string
  isActive: boolean
  storeCount: number
  userCount: number
  plan: string
  createdAt: string
}

interface UserSummary {
  id: string
  name: string
  email: string
  accountType: string
  companyName: string
  isActive: boolean
  createdAt: string
}

export const SuperAdminPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const [tab, setTab] = useState<'companies' | 'users'>('companies')

  // Companies
  const [tenants, setTenants] = useState<TenantSummary[]>([])
  const [tenantsLoading, setTenantsLoading] = useState(false)
  const [tenantSearch, setTenantSearch] = useState('')

  // Users
  const [users, setUsers] = useState<UserSummary[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [userPage, setUserPage] = useState(1)
  const [userTotal, setUserTotal] = useState(0)

  // Reset password modal
  const [resetUserId, setResetUserId] = useState<string | null>(null)
  const [resetUserName, setResetUserName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState('')

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const loadTenants = useCallback(async () => {
    setTenantsLoading(true)
    try {
      const res = await superAdminApi.getTenants()
      setTenants(res.data?.data ?? [])
    } catch {
      showToast('Failed to load companies', 'error')
    } finally {
      setTenantsLoading(false)
    }
  }, [])

  const loadUsers = useCallback(async () => {
    setUsersLoading(true)
    try {
      const res = await superAdminApi.getUsers({ search: userSearch || undefined, page: userPage, pageSize: 30 })
      const d = res.data?.data
      setUsers(d?.items ?? d ?? [])
      setUserTotal(d?.totalCount ?? 0)
    } catch {
      showToast('Failed to load users', 'error')
    } finally {
      setUsersLoading(false)
    }
  }, [userSearch, userPage])

  useEffect(() => { loadTenants() }, [loadTenants])
  useEffect(() => { if (tab === 'users') loadUsers() }, [tab, loadUsers])

  const handleToggleUser = async (userId: string) => {
    try {
      const res = await superAdminApi.toggleUser(userId)
      const newActive = res.data?.data ?? false
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, isActive: newActive } : u))
      showToast(newActive ? 'User activated' : 'User deactivated')
    } catch {
      showToast('Failed to toggle user', 'error')
    }
  }

  const handleResetPassword = async () => {
    if (!resetUserId) return
    if (newPassword.length < 6) { setResetError('Password must be at least 6 characters'); return }
    setResetLoading(true)
    setResetError('')
    try {
      await superAdminApi.resetPassword(resetUserId, newPassword)
      showToast('Password reset successfully')
      setResetUserId(null)
      setNewPassword('')
    } catch {
      setResetError('Failed to reset password')
    } finally {
      setResetLoading(false)
    }
  }

  const filteredTenants = tenants.filter(t =>
    !tenantSearch ||
    t.title.toLowerCase().includes(tenantSearch.toLowerCase()) ||
    t.businessType.toLowerCase().includes(tenantSearch.toLowerCase()) ||
    t.country.toLowerCase().includes(tenantSearch.toLowerCase())
  )

  const handleLogout = () => {
    dispatch(logout())
    window.location.href = '/login'
  }

  const ROLE_COLOR: Record<string, string> = {
    Owner: 'bg-purple-100 text-purple-700',
    Admin: 'bg-blue-100 text-blue-700',
    Staff: 'bg-gray-100 text-gray-600',
    SuperAdmin: 'bg-red-100 text-red-700',
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium',
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        )}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900 dark:text-white">Super Admin Panel</h1>
              <p className="text-xs text-gray-500">Platform management</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-6 pt-6">
        <div className="flex gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-1 w-fit mb-6">
          <button
            onClick={() => setTab('companies')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              tab === 'companies'
                ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            )}
          >
            <Building2 className="w-4 h-4" />
            Companies
            <span className="text-xs bg-gray-700 dark:bg-gray-300 text-white dark:text-gray-800 rounded-full px-1.5 py-0.5 ml-1">
              {tenants.length}
            </span>
          </button>
          <button
            onClick={() => setTab('users')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              tab === 'users'
                ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            )}
          >
            <Users className="w-4 h-4" />
            Users
            {userTotal > 0 && (
              <span className="text-xs bg-gray-700 dark:bg-gray-300 text-white dark:text-gray-800 rounded-full px-1.5 py-0.5 ml-1">
                {userTotal}
              </span>
            )}
          </button>
        </div>

        {/* Companies Tab */}
        {tab === 'companies' && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search companies…"
                  value={tenantSearch}
                  onChange={e => setTenantSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={loadTenants}
                disabled={tenantsLoading}
                className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <RefreshCw className={cn('w-4 h-4', tenantsLoading && 'animate-spin')} />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50 text-left">
                    <th className="px-5 py-3 font-semibold text-gray-600 dark:text-gray-400">Company</th>
                    <th className="px-5 py-3 font-semibold text-gray-600 dark:text-gray-400">Business Type</th>
                    <th className="px-5 py-3 font-semibold text-gray-600 dark:text-gray-400">Country</th>
                    <th className="px-5 py-3 font-semibold text-gray-600 dark:text-gray-400">Plan</th>
                    <th className="px-5 py-3 font-semibold text-gray-600 dark:text-gray-400 text-center">Stores</th>
                    <th className="px-5 py-3 font-semibold text-gray-600 dark:text-gray-400 text-center">Users</th>
                    <th className="px-5 py-3 font-semibold text-gray-600 dark:text-gray-400">Status</th>
                    <th className="px-5 py-3 font-semibold text-gray-600 dark:text-gray-400">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {tenantsLoading && (
                    <tr><td colSpan={8} className="px-5 py-8 text-center text-gray-400">Loading…</td></tr>
                  )}
                  {!tenantsLoading && filteredTenants.length === 0 && (
                    <tr><td colSpan={8} className="px-5 py-8 text-center text-gray-400">No companies found</td></tr>
                  )}
                  {filteredTenants.map(t => (
                    <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-white">{t.title}</td>
                      <td className="px-5 py-3.5 text-gray-600 dark:text-gray-400">{t.businessType}</td>
                      <td className="px-5 py-3.5 text-gray-600 dark:text-gray-400">{t.country}</td>
                      <td className="px-5 py-3.5">
                        <span className="px-2 py-0.5 text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full">
                          {t.plan}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center text-gray-700 dark:text-gray-300">{t.storeCount}</td>
                      <td className="px-5 py-3.5 text-center text-gray-700 dark:text-gray-300">{t.userCount}</td>
                      <td className="px-5 py-3.5">
                        <span className={cn(
                          'px-2 py-0.5 text-xs font-medium rounded-full',
                          t.isActive
                            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                            : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                        )}>
                          {t.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">
                        {new Date(t.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {tab === 'users' && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or email…"
                  value={userSearch}
                  onChange={e => { setUserSearch(e.target.value); setUserPage(1) }}
                  onKeyDown={e => e.key === 'Enter' && loadUsers()}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={loadUsers}
                disabled={usersLoading}
                className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <RefreshCw className={cn('w-4 h-4', usersLoading && 'animate-spin')} />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50 text-left">
                    <th className="px-5 py-3 font-semibold text-gray-600 dark:text-gray-400">Name</th>
                    <th className="px-5 py-3 font-semibold text-gray-600 dark:text-gray-400">Email</th>
                    <th className="px-5 py-3 font-semibold text-gray-600 dark:text-gray-400">Role</th>
                    <th className="px-5 py-3 font-semibold text-gray-600 dark:text-gray-400">Company</th>
                    <th className="px-5 py-3 font-semibold text-gray-600 dark:text-gray-400">Status</th>
                    <th className="px-5 py-3 font-semibold text-gray-600 dark:text-gray-400">Joined</th>
                    <th className="px-5 py-3 font-semibold text-gray-600 dark:text-gray-400 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {usersLoading && (
                    <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">Loading…</td></tr>
                  )}
                  {!usersLoading && users.length === 0 && (
                    <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">No users found</td></tr>
                  )}
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-white">{u.name}</td>
                      <td className="px-5 py-3.5 text-gray-600 dark:text-gray-400 font-mono text-xs">{u.email}</td>
                      <td className="px-5 py-3.5">
                        <span className={cn(
                          'px-2 py-0.5 text-xs font-medium rounded-full',
                          ROLE_COLOR[u.accountType] ?? 'bg-gray-100 text-gray-600'
                        )}>
                          {u.accountType}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-600 dark:text-gray-400">{u.companyName}</td>
                      <td className="px-5 py-3.5">
                        <span className={cn(
                          'px-2 py-0.5 text-xs font-medium rounded-full',
                          u.isActive
                            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                            : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                        )}>
                          {u.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-center gap-2">
                          {/* Toggle active */}
                          <button
                            onClick={() => handleToggleUser(u.id)}
                            title={u.isActive ? 'Disable user' : 'Enable user'}
                            className={cn(
                              'p-1.5 rounded-lg transition-colors',
                              u.isActive
                                ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                                : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                            )}
                          >
                            {u.isActive
                              ? <ToggleRight className="w-4 h-4" />
                              : <ToggleLeft className="w-4 h-4" />
                            }
                          </button>
                          {/* Reset password */}
                          <button
                            onClick={() => { setResetUserId(u.id); setResetUserName(u.name); setNewPassword(''); setResetError('') }}
                            title="Reset password"
                            className="p-1.5 text-gray-500 hover:text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {userTotal > 30 && (
              <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-sm">
                <span className="text-gray-500">
                  Showing {(userPage - 1) * 30 + 1}–{Math.min(userPage * 30, userTotal)} of {userTotal}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setUserPage(p => Math.max(1, p - 1))}
                    disabled={userPage === 1}
                    className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setUserPage(p => p + 1)}
                    disabled={userPage * 30 >= userTotal}
                    className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="pb-12" />
      </div>

      {/* Reset Password Modal */}
      {resetUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 dark:text-white">Reset Password</h2>
              <button
                onClick={() => setResetUserId(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Set a new password for <span className="font-medium text-gray-700 dark:text-gray-300">{resetUserName}</span>
            </p>

            <div className="relative mb-4">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="New password (min 6 chars)"
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setResetError('') }}
                onKeyDown={e => e.key === 'Enter' && handleResetPassword()}
                className="w-full px-3 py-2 pr-10 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {resetError && <p className="text-xs text-red-500 mb-3">{resetError}</p>}

            <div className="flex gap-2">
              <button
                onClick={() => setResetUserId(null)}
                className="flex-1 px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                disabled={resetLoading || !newPassword}
                className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {resetLoading ? 'Resetting…' : 'Reset Password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
