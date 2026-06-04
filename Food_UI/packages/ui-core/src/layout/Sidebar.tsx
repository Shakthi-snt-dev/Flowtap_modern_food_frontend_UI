import React, { useState, useEffect, useCallback } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@flowtap/shared'
import { useAppSelector } from '@flowtap/store'
import { usePermission } from '@flowtap/shared'
import {
  LayoutDashboard, LayoutGrid, ShoppingCart, Package, Warehouse, BarChart3,
  Ticket, ShoppingBag, Users, Settings, Store,
  Layers, ClipboardList, Wrench, ChevronDown, ChevronRight, UserCog,
  ShieldCheck, ArrowLeftRight, Trash2, Cpu, Bell, Smartphone,
  Receipt, Plug, CheckSquare, History, Megaphone, Tag, MessageSquare,
  ClipboardCheck, Kanban, BadgeCheck,
} from 'lucide-react'

export interface NavItem {
  label: string
  href?: string
  icon: React.ReactNode
  module?: string
  /** Checked against tenant.modules for ALL users (including admin). Item hidden when
   *  modules are set and this module is absent. Used to gate industry-specific features. */
  industryGated?: string
  adminOnly?: boolean
  employeeOnly?: boolean
  children?: NavItem[]
}

const CORE_NAV: NavItem[] = [
  { label: 'Dashboard',      href: '/',            icon: <LayoutDashboard className="w-5 h-5" /> },
  { label: 'Admin Overview', href: '/admin',        icon: <LayoutGrid className="w-5 h-5" />, module: 'Settings', adminOnly: true },
  { label: 'Store Overview', href: '/store-admin',  icon: <Store className="w-5 h-5" />, module: 'Settings' },
  { label: 'POS',            href: '/pos',          icon: <ShoppingCart className="w-5 h-5" />, module: 'POS' },
  {
    label: 'Sales', icon: <Receipt className="w-5 h-5" />, module: 'POS',
    children: [
      { label: 'Sales History',   href: '/sales',            icon: <Receipt className="w-4 h-4" /> },
      { label: 'Payment History', href: '/payments/history', icon: <History className="w-4 h-4" /> },
    ],
  },
  {
    label: 'Inventory', icon: <Package className="w-5 h-5" />, module: 'Inventory',
    children: [
      { label: 'Products',      href: '/products',             icon: <Layers            className="w-4 h-4" /> },
      { label: 'Warehouses',    href: '/warehouses',           icon: <Warehouse         className="w-4 h-4" /> },
      { label: 'Stock Levels',  href: '/inventory',            icon: <BarChart3         className="w-4 h-4" /> },
      { label: 'Transfers',     href: '/inventory/transfers',  icon: <ArrowLeftRight    className="w-4 h-4" /> },
      { label: 'Write-offs',    href: '/inventory/write-offs', icon: <Trash2            className="w-4 h-4" /> },
      { label: 'Serials',       href: '/inventory/serials',    icon: <Cpu               className="w-4 h-4" /> },
      { label: 'Reorder',       href: '/inventory/reorder',    icon: <Bell              className="w-4 h-4" /> },
      { label: 'Devices',       href: '/inventory/devices',    icon: <Smartphone        className="w-4 h-4" />, module: 'Devices', industryGated: 'Devices' },
    ],
  },
  {
    label: 'Service Tickets', icon: <Ticket className="w-5 h-5" />, module: 'ServiceTickets', industryGated: 'ServiceTickets',
    children: [
      { label: 'All Tickets', href: '/tickets',  icon: <ClipboardList className="w-4 h-4" /> },
      { label: 'Tasks',       href: '/tasks',    icon: <CheckSquare   className="w-4 h-4" /> },
      { label: 'Services',    href: '/services', icon: <Wrench        className="w-4 h-4" /> },
    ],
  },
  {
    label: 'Purchasing', icon: <ShoppingBag className="w-5 h-5" />, module: 'Purchasing',
    children: [
      { label: 'Purchase Orders', href: '/purchases',           icon: <ClipboardList className="w-4 h-4" /> },
      { label: 'Suppliers',       href: '/purchases/suppliers', icon: <Users         className="w-4 h-4" /> },
    ],
  },
  { label: 'Clients',       href: '/clients',        icon: <Users     className="w-5 h-5" />, module: 'Clients'   },
  { label: 'Employees',     href: '/employees',      icon: <UserCog   className="w-5 h-5" />, module: 'Employees' },
  { label: 'Reports',       href: '/reports',        icon: <BarChart3 className="w-5 h-5" />, module: 'Reports'   },
  { label: 'Check-in',     href: '/check-ins',      icon: <ClipboardCheck className="w-5 h-5" />, industryGated: 'ServiceTickets' },
  { label: 'Repair Board', href: '/repair-board',   icon: <Kanban         className="w-5 h-5" />, industryGated: 'ServiceTickets' },
  { label: 'Warranty',     href: '/warranty',       icon: <BadgeCheck     className="w-5 h-5" />, industryGated: 'ServiceTickets' },
  { label: 'Inbox',         href: '/communications', icon: <MessageSquare className="w-5 h-5" /> },
  { label: 'Notifications', href: '/notifications',  icon: <Bell className="w-5 h-5" /> },
  {
    label: 'Marketing', icon: <Megaphone className="w-5 h-5" />, module: 'Settings',
    children: [
      { label: 'Campaigns',   href: '/marketing',        icon: <Megaphone className="w-4 h-4" /> },
      { label: 'Promo Codes', href: '/marketing/offers', icon: <Tag       className="w-4 h-4" /> },
    ],
  },
  { label: 'Integrations', href: '/integrations', icon: <Plug       className="w-5 h-5" />, module: 'Settings' },
  { label: 'Audit Logs',   href: '/audit-logs',   icon: <ShieldCheck className="w-5 h-5" />, module: 'Settings' },
  { label: 'Settings',     href: '/settings',     icon: <Settings    className="w-5 h-5" />, module: 'Settings' },
]

interface SidebarProps {
  /** Industry-specific nav items inserted after Dashboard */
  extraNavItems?: NavItem[]
  /** Unread notification count — fetched by the parent AppLayout */
  notifUnreadCount?: number
  onNotifClick?: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({ extraNavItems = [], notifUnreadCount = 0, onNotifClick }) => {
  const { can } = usePermission()
  const sidebarOpen    = useAppSelector((s) => s.ui.sidebarOpen)
  const sidebarDensity = useAppSelector((s) => s.ui.sidebarDensity)
  const tenant = useAppSelector((s) => s.tenant.tenant)
  const location = useLocation()
  const [expanded, setExpanded] = useState<string[]>(['Inventory'])

  const py = sidebarDensity === 'compact' ? 'py-1.5' : 'py-2.5'
  const user = useAppSelector((s) => s.auth.user)
  const isAdminOrOwner = !user?.role || user.role === 'Owner' || user.role === 'Admin'

  const isVisible = useCallback((item: NavItem): boolean => {
    if (item.adminOnly && !isAdminOrOwner) return false
    if (item.employeeOnly && isAdminOrOwner) return false
    if (item.module && !can(item.module)) return false
    // Industry-gated: enforced for ALL users (including admin) once modules are loaded.
    // When tenant.modules is empty (before seeding), nothing is hidden.
    if (item.industryGated && tenant?.modules && tenant.modules.length > 0 && !tenant.modules.includes(item.industryGated)) return false
    return true
  }, [isAdminOrOwner, can, tenant?.modules])

  const toggleExpand = (label: string) =>
    setExpanded((prev) => prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label])

  // Merge core nav with industry-specific nav (extra items after Dashboard)
  const allNav: NavItem[] = extraNavItems.length > 0
    ? [CORE_NAV[0], ...extraNavItems, ...CORE_NAV.slice(1)]
    : CORE_NAV

  const navItems = allNav.filter(isVisible)

  const activeClass   = 'text-[var(--sidebar-active-text)] bg-[var(--sidebar-active-bg)]'
  const inactiveClass = 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover-bg)]'
  const childActiveClass   = `${activeClass} font-medium`
  const childInactiveClass = 'text-[var(--sidebar-text-muted)] hover:bg-[var(--sidebar-hover-bg)]'

  return (
    <>
      {sidebarOpen && <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" />}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full z-30 flex flex-col',
          'border-r transition-all duration-300 ease-in-out',
          sidebarOpen ? 'w-64' : 'w-0 lg:w-16 overflow-hidden',
        )}
        style={{ background: 'var(--sidebar-bg)', borderColor: 'var(--sidebar-border)' }}
      >
        <div className="flex items-center gap-3 px-4 h-16 flex-shrink-0 border-b" style={{ borderColor: 'var(--sidebar-border)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--sidebar-logo-bg)' }}>
            <Store className="w-5 h-5 text-white" />
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden">
              <div className="font-bold text-sm leading-tight truncate" style={{ color: 'var(--sidebar-title)' }}>
                {tenant?.title ?? 'Flowtap'}
              </div>
              <div className="text-xs truncate" style={{ color: 'var(--sidebar-subtitle)' }}>
                {tenant?.businessType}
              </div>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20">
          {navItems.map((item) => {
            if (item.children) {
              const isExp    = expanded.includes(item.label)
              const isActive = item.children.some((c) => c.href && location.pathname === c.href)
              return (
                <div key={item.label}>
                  <button
                    onClick={() => toggleExpand(item.label)}
                    className={cn(`w-full flex items-center gap-3 px-3 ${py} rounded-lg text-sm font-medium transition-colors`, isActive ? activeClass : inactiveClass)}
                  >
                    {item.icon}
                    {sidebarOpen && (
                      <>
                        <span className="flex-1 text-left">{item.label}</span>
                        {isExp ? <ChevronDown className="w-4 h-4 opacity-60" /> : <ChevronRight className="w-4 h-4 opacity-60" />}
                      </>
                    )}
                  </button>
                  {sidebarOpen && isExp && (
                    <div className="ml-4 mt-1 space-y-0.5 border-l-2 pl-3" style={{ borderColor: 'var(--sidebar-border)' }}>
                      {item.children.filter(isVisible).map((child) => (
                        <NavLink
                          key={child.href}
                          to={child.href!}
                          className={({ isActive }) => cn('flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors', isActive ? childActiveClass : childInactiveClass)}
                        >
                          {child.icon}
                          {child.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              )
            }

            const isNotif = item.href === '/notifications'
            return (
              <NavLink
                key={item.href}
                to={item.href!}
                end={item.href === '/'}
                className={({ isActive }) => cn(`flex items-center gap-3 px-3 ${py} rounded-lg text-sm font-medium transition-colors`, isActive ? activeClass : inactiveClass)}
                onClick={isNotif && onNotifClick ? onNotifClick : undefined}
              >
                <span className="relative">
                  {item.icon}
                  {isNotif && notifUnreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center leading-none">
                      {notifUnreadCount > 9 ? '9' : notifUnreadCount}
                    </span>
                  )}
                </span>
                {sidebarOpen && <span className="flex-1">{item.label}</span>}
                {sidebarOpen && isNotif && notifUnreadCount > 0 && (
                  <span className="ml-auto text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5 leading-none">
                    {notifUnreadCount > 99 ? '99+' : notifUnreadCount}
                  </span>
                )}
              </NavLink>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
