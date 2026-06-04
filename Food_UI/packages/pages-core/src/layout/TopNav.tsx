import React, { useEffect, useRef, useState } from 'react'
import {
  Menu, Bell, Sun, Moon, ChevronDown, LogOut, User, Settings,
  Store, Check, Ticket, AlertTriangle, Package, RefreshCw, UserCog, ArrowLeftRight,
  Info, Zap, X, MessageSquare,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@flowtap/store'
import { toggleSidebar } from '@flowtap/store'
import { logout } from '@flowtap/store'
import { switchBackToOwner } from '@flowtap/store'
import { authApi } from '@flowtap/api-core'
import { setCurrentStore } from '@flowtap/store'
import { useTheme } from '@flowtap/shared'
import { cn } from '@flowtap/shared'
import { ticketsApi } from '@flowtap/api-core'
import { reportsApi } from '@flowtap/api-core'
import { notificationsApi } from '@flowtap/api-core'
import { messagesApi } from '@flowtap/api-core'
import { SwitchUserModal } from '@flowtap/ui-core'
import { employeesApi } from '@flowtap/api-core'
import toast from 'react-hot-toast'

interface NotifItem {
  id: string
  type: 'ticket' | 'stock' | 'alert'
  title: string
  subtitle: string
}

interface BroadcastItem {
  id: string
  subject: string
  message: string
  severity: 'Information' | 'Warning' | 'Alert'
  sentBy: string
  createdAt: string
}

export const TopNav: React.FC = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { isDark, toggle } = useTheme()
  const user = useAppSelector((s) => s.auth.user)
  const tenant = useAppSelector((s) => s.tenant.tenant)
  const stores = useAppSelector((s) => s.tenant.stores)
  const currentStoreId = useAppSelector((s) => s.tenant.currentStoreId)
  const ownerUser = useAppSelector((s) => s.auth.ownerUser)

  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [storeMenuOpen, setStoreMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifs, setNotifs] = useState<NotifItem[]>([])
  const [notifLoading, setNotifLoading] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>([])
  const [dmUnread, setDmUnread] = useState(0)
  const notifRef = useRef<HTMLDivElement>(null)

  // Switch cashier modal
  const [switchOpen, setSwitchOpen] = useState(false)
  const [employeeList, setEmployeeList] = useState<{ id: string; name: string; jobTitle?: string; avatarInitials?: string }[]>([])

  const currentStore = stores.find((s) => s.id === currentStoreId)
  const storeName = currentStore?.name ?? tenant?.title ?? 'Store'

  // Determine which stores this user is allowed to see / switch to.
  // Owners and Admins see every store.
  // Employees (any other role) are locked to their assigned store(s).
  // role === '' means still loading → treat as admin so nothing flashes away.
  const isAdminOrOwner = !user?.role || user.role === 'Owner' || user.role === 'Admin'
  const visibleStores = React.useMemo(() => {
    if (isAdminOrOwner) return stores

    // 1. Explicit locationIds array (set by PIN-switch with permissions)
    if (user?.locationIds && user.locationIds.length > 0) {
      const filtered = stores.filter((s) => user.locationIds!.includes(s.id))
      if (filtered.length > 0) return filtered
    }

    // 2. defaultLocationId from the employee record
    if (user?.defaultLocationId) {
      const matched = stores.filter((s) => s.id === user.defaultLocationId)
      if (matched.length > 0) return matched
    }

    // 3. Fall back to whichever store is currently active — never show all stores
    //    for a non-admin user (even if their defaultLocationId isn't loaded yet)
    if (currentStoreId) {
      const current = stores.filter((s) => s.id === currentStoreId)
      if (current.length > 0) return current
    }

    return stores
  }, [stores, isAdminOrOwner, user?.locationIds, user?.defaultLocationId, currentStoreId])

  const handleLogout = () => {
    // Fire-and-forget server-side token invalidation, then clear local state
    authApi.logout().catch(() => {})
    dispatch(logout())
    navigate('/login')
  }

  const fetchNotifications = async () => {
    if (!tenant?.id) return
    setNotifLoading(true)
    const items: NotifItem[] = []
    try {
      const [ticketsRes, statsRes, broadcastsRes, dmRes] = await Promise.allSettled([
        ticketsApi.getTickets({ companyId: tenant.id, status: 'Pending', pageSize: 5 }),
        reportsApi.getDashboardStats({ companyId: tenant.id }),
        notificationsApi.getBroadcasts({ companyId: tenant.id, locationId: currentStoreId ?? undefined, limit: 10 }),
        messagesApi.getUnreadCount(),
      ])

      if (ticketsRes.status === 'fulfilled') {
        const raw = ticketsRes.value.data.data
        const list = Array.isArray(raw) ? raw : (raw?.items ?? [])
        list.slice(0, 5).forEach((t: { id: string; ticketNumber?: string; problemDescription?: string }) => {
          items.push({
            id: `ticket-${t.id}`,
            type: 'ticket',
            title: `Ticket ${t.ticketNumber ?? '#' + t.id.slice(-6).toUpperCase()}`,
            subtitle: t.problemDescription ?? 'Pending repair ticket',
          })
        })
      }

      if (statsRes.status === 'fulfilled') {
        const stats = statsRes.value.data.data
        if (stats?.lowStockAlerts > 0) {
          items.push({
            id: 'low-stock',
            type: 'stock',
            title: `${stats.lowStockAlerts} Low Stock Alert${stats.lowStockAlerts > 1 ? 's' : ''}`,
            subtitle: 'Products are running low — check inventory',
          })
        }
      }

      if (broadcastsRes.status === 'fulfilled') {
        const raw: any[] = broadcastsRes.value.data?.data ?? []
        setBroadcasts(raw.map((b: any) => ({
          id:        String(b.id),
          subject:   String(b.subject ?? ''),
          message:   String(b.message ?? ''),
          severity:  (b.severity ?? 'Information') as BroadcastItem['severity'],
          sentBy:    String(b.sentBy ?? 'Admin'),
          createdAt: String(b.createdAt ?? ''),
        })))
      }

      if (dmRes.status === 'fulfilled') {
        setDmUnread(dmRes.value.data?.data ?? 0)
      }
    } finally {
      setNotifLoading(false)
    }
    setNotifs(items)
    // unread count = alerts + broadcasts (broadcasts always "new" until dismissed)
    setUnreadCount(items.length)
  }

  useEffect(() => {
    if (tenant?.id) fetchNotifications()

    const handleRealTimeEvent = () => {
      if (tenant?.id) fetchNotifications()
    }

    window.addEventListener('signalr:new-broadcast', handleRealTimeEvent)
    window.addEventListener('signalr:new-dm', handleRealTimeEvent)
    window.addEventListener('signalr:new-user-notification', handleRealTimeEvent)

    return () => {
      window.removeEventListener('signalr:new-broadcast', handleRealTimeEvent)
      window.removeEventListener('signalr:new-dm', handleRealTimeEvent)
      window.removeEventListener('signalr:new-user-notification', handleRealTimeEvent)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.id, currentStoreId])

  // Load employees for cashier switch (lazy — only when modal is first opened)
  const loadEmployees = async () => {
    if (!tenant?.id || employeeList.length > 0) return
    try {
      const res = await employeesApi.getEmployees({ companyId: tenant.id, isActive: true, pageSize: 200 })
      const raw = res.data?.data?.items ?? res.data?.data ?? []
      const list = (Array.isArray(raw) ? raw : []).map((e: any) => ({
        id: String(e.id),
        name: String(e.name ?? ''),
        jobTitle: e.jobTitle ? String(e.jobTitle) : undefined,
        avatarInitials: String(e.name ?? '').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
      }))
      setEmployeeList(list)
    } catch { /* non-fatal */ }
  }

  const handleOpenSwitch = () => {
    loadEmployees()
    setSwitchOpen(true)
  }

  // Close notif panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const notifIcon = (type: NotifItem['type']) => {
    if (type === 'ticket') return <Ticket className="w-4 h-4 text-orange-500" />
    if (type === 'stock') return <AlertTriangle className="w-4 h-4 text-red-500" />
    return <Package className="w-4 h-4 text-blue-500" />
  }

  return (
    <>
    <header
      className="fixed top-0 right-0 left-0 h-16 z-20 flex items-center px-4 gap-3 border-b"
      style={{ background: 'var(--header-bg)', borderColor: 'var(--header-border)' }}
    >
      <button
        onClick={() => dispatch(toggleSidebar())}
        className="p-2 rounded-lg transition-colors"
        style={{ color: 'var(--header-icon)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--header-hover-bg)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex-1" />

      {/* Store Switcher */}
      <div className="relative">
        {/* Employees with only one store see a non-interactive pill; admins see a dropdown */}
        <button
          onClick={() => visibleStores.length > 1 ? setStoreMenuOpen((p) => !p) : undefined}
          className={['flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors',
            visibleStores.length > 1 ? 'cursor-pointer' : 'cursor-default'].join(' ')}
          style={{ borderColor: 'var(--header-border)', color: 'var(--header-text)' }}
          onMouseEnter={e => visibleStores.length > 1 && (e.currentTarget.style.background = 'var(--header-hover-bg)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <span className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
          <span className="font-medium max-w-[140px] truncate" style={{ color: 'var(--header-text)' }}>{storeName}</span>
          {visibleStores.length > 1 && (
            <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--header-icon)' }} />
          )}
        </button>
        {storeMenuOpen && visibleStores.length > 1 && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setStoreMenuOpen(false)} />
            <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 z-20 py-1">
              <p className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Your Stores</p>
              {visibleStores.map((store) => (
                <button
                  key={store.id}
                  onClick={() => { dispatch(setCurrentStore(store.id)); setStoreMenuOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <Store className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="flex-1 text-left truncate">{store.name}</span>
                  {store.id === currentStoreId && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                </button>
              ))}
              {/* Only admins/owners can add stores */}
              {isAdminOrOwner && (
                <>
                  <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                  <button
                    onClick={() => { navigate('/settings?tab=stores'); setStoreMenuOpen(false) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors font-medium"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Add New Store</span>
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Switch User button */}
      <button
        onClick={handleOpenSwitch}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-colors"
        style={{ borderColor: 'var(--header-border)', color: 'var(--header-text)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--header-hover-bg)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        title="Switch user"
      >
        <UserCog className="w-4 h-4" style={{ color: 'var(--header-icon)' }} />
        <span className="hidden sm:block text-xs font-medium" style={{ color: 'var(--header-text)' }}>
          Switch User
        </span>
      </button>

      {/* Theme Toggle */}
      <button
        onClick={toggle}
        className="p-2 rounded-lg transition-colors"
        style={{ color: 'var(--header-icon)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--header-hover-bg)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      {/* Notification Bell */}
      <div className="relative" ref={notifRef}>
        <button
          onClick={() => { setNotifOpen((p) => !p); if (!notifOpen) setUnreadCount(0) }}
          className="relative p-2 rounded-lg transition-colors"
          style={{ color: 'var(--header-icon)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--header-hover-bg)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <Bell className="w-5 h-5" />
          {(unreadCount + broadcasts.length + dmUnread) > 0 && (
            <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
              {(unreadCount + broadcasts.length + dmUnread) > 9 ? '9+' : (unreadCount + broadcasts.length + dmUnread)}
            </span>
          )}
        </button>

        {notifOpen && (
          <div className="absolute right-0 top-full mt-1 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 z-30">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</span>
              <button
                onClick={fetchNotifications}
                disabled={notifLoading}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 transition-colors"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', notifLoading && 'animate-spin')} />
              </button>
            </div>

            {/* Broadcast Messages — shown first, above system notifs */}
            {broadcasts.length > 0 && (
              <div className="border-b border-gray-100 dark:border-gray-700">
                <p className="px-4 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Messages
                </p>
                {broadcasts.map((b) => {
                  const icon = b.severity === 'Alert'
                    ? <Zap className="w-3.5 h-3.5 text-red-500" />
                    : b.severity === 'Warning'
                      ? <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      : <Info className="w-3.5 h-3.5 text-blue-500" />
                  const bg = b.severity === 'Alert'
                    ? 'bg-red-50 dark:bg-red-900/20'
                    : b.severity === 'Warning'
                      ? 'bg-amber-50 dark:bg-amber-900/20'
                      : 'bg-blue-50 dark:bg-blue-900/20'
                  return (
                    <div key={b.id} className={`flex items-start gap-2.5 px-3 py-2.5 mx-2 mb-1 rounded-lg ${bg}`}>
                      <span className="flex-shrink-0 mt-0.5">{icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-900 dark:text-white leading-tight">{b.subject}</p>
                        {b.message && (
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{b.message}</p>
                        )}
                        <p className="text-[10px] text-gray-400 mt-0.5">{b.sentBy}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          notificationsApi.dismissBroadcast(b.id)
                            .then(() => setBroadcasts(prev => prev.filter(x => x.id !== b.id)))
                            .catch(() => {})
                        }}
                        className="flex-shrink-0 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Dismiss"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Direct Messages — unread count shortcut */}
            {dmUnread > 0 && (
              <div className="border-b border-gray-100 dark:border-gray-700">
                <p className="px-4 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Direct Messages
                </p>
                <button
                  onClick={() => { setNotifOpen(false); navigate('/communications?tab=messages') }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 mx-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {dmUnread} unread message{dmUnread > 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Tap to open inbox →</p>
                  </div>
                  <span className="flex-shrink-0 min-w-[20px] h-5 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1.5">
                    {dmUnread > 9 ? '9+' : dmUnread}
                  </span>
                </button>
              </div>
            )}

            {/* System Notifications */}
            <div className="max-h-60 overflow-y-auto">
              {notifLoading ? (
                <div className="py-8 flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : notifs.length === 0 && broadcasts.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-400">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  All caught up!
                </div>
              ) : notifs.length === 0 ? null : (
                <>
                  {broadcasts.length > 0 && (
                    <p className="px-4 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      Alerts
                    </p>
                  )}
                  {notifs.map((n) => (
                    <div
                      key={n.id}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                      onClick={() => {
                        setNotifOpen(false)
                        if (n.type === 'ticket') navigate('/tickets')
                        else if (n.type === 'stock') navigate('/inventory')
                      }}
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mt-0.5">
                        {notifIcon(n.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{n.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.subtitle}</p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Footer */}
            {notifs.length > 0 && (
              <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-2.5">
                <button
                  onClick={() => { setNotifOpen(false); navigate('/tickets') }}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  View all tickets →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* User Menu — shows current logged-in user (owner or switched employee) */}
      <div className="relative">
        <button
          onClick={() => setUserMenuOpen((p) => !p)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors"
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--header-hover-bg)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <div className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold relative',
            ownerUser ? 'bg-indigo-600' : 'bg-blue-600'
          )}>
            {user?.name?.[0]?.toUpperCase() ?? 'U'}
            {/* Dot indicator when employee session is active */}
            {ownerUser && (
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-amber-400 border-2 border-white dark:border-gray-900 rounded-full" />
            )}
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-sm font-medium leading-tight" style={{ color: 'var(--header-text)' }}>{user?.name}</div>
            <div className="text-xs" style={{ color: 'var(--header-text)', opacity: 0.7 }}>
              {ownerUser ? (user?.jobTitle ?? 'Employee') : user?.email}
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>
        {userMenuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
            <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-modal border border-gray-100 dark:border-gray-700 z-20 py-1">
              <button
                onClick={() => { navigate('/settings'); setUserMenuOpen(false) }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <User className="w-4 h-4" /> Profile
              </button>
              <button
                onClick={() => { navigate('/settings'); setUserMenuOpen(false) }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Settings className="w-4 h-4" /> Settings
              </button>

              {/* Switch back to owner — only shown when an employee is active */}
              {ownerUser && (
                <>
                  <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
                  <button
                    onClick={() => {
                      dispatch(switchBackToOwner())
                      setUserMenuOpen(false)
                      toast.success(`Switched back to ${ownerUser.name}`)
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                    Back to {ownerUser.name}
                  </button>
                </>
              )}

              <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          </>
        )}
      </div>
    </header>

    {/* Switch User Modal */}
    {switchOpen && tenant?.id && (
      <SwitchUserModal
        companyId={tenant.id}
        employees={employeeList}
        onClose={() => setSwitchOpen(false)}
      />
    )}
  </>
  )
}
