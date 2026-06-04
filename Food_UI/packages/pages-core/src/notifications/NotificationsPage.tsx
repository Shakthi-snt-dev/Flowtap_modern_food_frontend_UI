import React, { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  Bell, AlertTriangle, XCircle, Clock, CheckCircle2,
  ClipboardList, ArrowRightCircle, Trash2, CheckCheck, X,
  Megaphone, Info, Tag, ShoppingCart, Package,
  ChevronRight, ExternalLink, Calendar, Eye, EyeOff,
} from 'lucide-react'
import { useAppSelector } from '@flowtap/store'
import { userNotificationsApi } from '@flowtap/api-core'
import { Spinner } from '@flowtap/ui-core'
import { cn } from '@flowtap/shared'
import { useNavigate } from 'react-router-dom'

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserNotification {
  id: string
  type: string
  title: string
  message: string
  referenceId: string | null
  referenceType: string | null
  isRead: boolean
  readAt: string | null
  createdAt: string
}

// ─── Icon / colour map ────────────────────────────────────────────────────────

const NOTIF_META: Record<string, { icon: React.ReactNode; color: string; bg: string; badge: string }> = {
  LowStock:          { icon: <AlertTriangle className="w-5 h-5" />,    color: 'text-amber-600',  bg: 'bg-amber-100 dark:bg-amber-900/30',    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  PaymentFailed:     { icon: <XCircle className="w-5 h-5" />,          color: 'text-red-500',    bg: 'bg-red-100 dark:bg-red-900/30',        badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  OrderPending:      { icon: <ShoppingCart className="w-5 h-5" />,     color: 'text-blue-500',   bg: 'bg-blue-100 dark:bg-blue-900/30',      badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  TicketUpdated:     { icon: <ArrowRightCircle className="w-5 h-5" />, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30',  badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  WriteOffPending:   { icon: <ClipboardList className="w-5 h-5" />,    color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30',  badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
  TransferCompleted: { icon: <CheckCircle2 className="w-5 h-5" />,     color: 'text-green-500',  bg: 'bg-green-100 dark:bg-green-900/30',    badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  Broadcast:         { icon: <Megaphone className="w-5 h-5" />,        color: 'text-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-900/30',  badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' },
  Announcement:      { icon: <Info className="w-5 h-5" />,             color: 'text-cyan-500',   bg: 'bg-cyan-100 dark:bg-cyan-900/30',      badge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300' },
  Promo:             { icon: <Tag className="w-5 h-5" />,              color: 'text-pink-500',   bg: 'bg-pink-100 dark:bg-pink-900/30',      badge: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300' },
  Inventory:         { icon: <Package className="w-5 h-5" />,          color: 'text-teal-500',   bg: 'bg-teal-100 dark:bg-teal-900/30',      badge: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300' },
  Custom:            { icon: <Bell className="w-5 h-5" />,             color: 'text-gray-500',   bg: 'bg-gray-100 dark:bg-gray-800',         badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
}

const TYPE_ROUTE: Record<string, string> = {
  LowStock:          '/inventory/reorder',
  PaymentFailed:     '/payments/history',
  OrderPending:      '/sales',
  TicketUpdated:     '/tickets',
  WriteOffPending:   '/inventory/write-offs',
  TransferCompleted: '/inventory/transfers',
}

const getMeta = (type: string) => NOTIF_META[type] ?? NOTIF_META.Custom

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatRelative = (s: string) => {
  try {
    const diff = (Date.now() - new Date(s).getTime()) / 1000
    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`
    return new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return s }
}

const formatFull = (s: string) => {
  try {
    return new Date(s).toLocaleString(undefined, {
      weekday: 'short', year: 'numeric', month: 'short',
      day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch { return s }
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

interface DetailPanelProps {
  notif: UserNotification | null
  onClose: () => void
  onMarkRead: (id: string) => void
  onDelete: (id: string) => void
  onNavigate: (notif: UserNotification) => void
  deletingId: string | null
}

const DetailPanel: React.FC<DetailPanelProps> = ({ notif, onClose, onMarkRead, onDelete, onNavigate, deletingId }) => {
  const isOpen = Boolean(notif)

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}
      <div
        className={cn(
          'fixed top-0 right-0 h-full z-50 flex flex-col',
          'bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700',
          'shadow-2xl transition-all duration-300 ease-in-out',
          isOpen ? 'w-full sm:w-[420px] translate-x-0' : 'w-[420px] translate-x-full',
        )}
      >
        {notif ? (() => {
          const meta = getMeta(notif.type)
          const route = notif.referenceId && notif.referenceType === 'Ticket'
            ? `/tickets/${notif.referenceId}`
            : TYPE_ROUTE[notif.type]

          return (
            <>
              {/* Panel header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className={cn('w-8 h-8 rounded-full flex items-center justify-center', meta.bg)}>
                    <span className={meta.color}>{React.cloneElement(meta.icon as React.ReactElement, { className: 'w-4 h-4' })}</span>
                  </div>
                  <span className="font-semibold text-gray-800 dark:text-gray-100 text-sm">Notification Detail</span>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  aria-label="Close panel"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Panel body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Type badge + status */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide', meta.badge)}>
                    {notif.type}
                  </span>
                  {notif.isRead ? (
                    <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                      <Eye className="w-3.5 h-3.5" /> Read
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">
                      <EyeOff className="w-3.5 h-3.5" /> Unread
                    </span>
                  )}
                </div>

                {/* Title */}
                <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-snug">
                  {notif.title}
                </h2>

                {/* Full message */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {notif.message}
                  </p>
                </div>

                {/* Meta info grid */}
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/60">
                    <Calendar className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">Received</p>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{formatFull(notif.createdAt)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatRelative(notif.createdAt)}</p>
                    </div>
                  </div>

                  {notif.isRead && notif.readAt && (
                    <div className="flex items-start gap-3 p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/60">
                      <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">Read at</p>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{formatFull(notif.readAt)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{formatRelative(notif.readAt)}</p>
                      </div>
                    </div>
                  )}

                  {notif.referenceId && (
                    <div className="flex items-start gap-3 p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/60">
                      <Tag className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">Reference</p>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                          {notif.referenceType} #{notif.referenceId}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Panel footer */}
              <div className="flex-shrink-0 px-5 py-4 border-t border-gray-100 dark:border-gray-800 space-y-2">
                {route && (
                  <button
                    onClick={() => onNavigate(notif)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View {notif.referenceType ?? notif.type}
                  </button>
                )}
                <div className="flex gap-2">
                  {!notif.isRead && (
                    <button
                      onClick={() => { onMarkRead(notif.id); onClose() }}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Mark Read
                    </button>
                  )}
                  <button
                    onClick={() => { onDelete(notif.id); onClose() }}
                    disabled={deletingId === notif.id}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                  >
                    {deletingId === notif.id
                      ? <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                      : <Trash2 className="w-4 h-4" />
                    }
                    Delete
                  </button>
                </div>
              </div>
            </>
          )
        })() : null}
      </div>
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export const NotificationsPage: React.FC = () => {
  const tenant   = useAppSelector(s => s.tenant.tenant)
  const navigate = useNavigate()

  const [notifications, setNotifications] = useState<UserNotification[]>([])
  const [loading,        setLoading]        = useState(false)
  const [filter,         setFilter]         = useState<'all' | 'unread' | 'read'>('all')
  const [markingAll,     setMarkingAll]      = useState(false)
  const [deletingId,     setDeletingId]      = useState<string | null>(null)
  const [unreadCount,    setUnreadCount]     = useState(0)
  const [selected,       setSelected]        = useState<UserNotification | null>(null)

  const load = useCallback(async () => {
    if (!tenant?.id) return
    setLoading(true)
    try {
      const isRead = filter === 'all' ? undefined : filter === 'read'
      const res = await userNotificationsApi.getAll({ isRead, pageSize: 50 })
      const raw: any[] = res.data?.data?.items ?? res.data?.data ?? []
      setNotifications(raw.map((n: any) => ({
        id:            String(n.id),
        type:          String(n.type ?? 'Custom'),
        title:         String(n.title ?? ''),
        message:       String(n.message ?? ''),
        referenceId:   n.referenceId ?? null,
        referenceType: n.referenceType ?? null,
        isRead:        Boolean(n.isRead),
        readAt:        n.readAt ?? null,
        createdAt:     String(n.createdAt ?? ''),
      })))
    } catch { toast.error('Failed to load notifications') }
    finally { setLoading(false) }
  }, [tenant?.id, filter])

  const loadCount = useCallback(async () => {
    if (!tenant?.id) return
    try {
      const res = await userNotificationsApi.getUnreadCount()
      setUnreadCount(Number(res.data?.data ?? res.data ?? 0))
    } catch { /* non-fatal */ }
  }, [tenant?.id])

  useEffect(() => { load(); loadCount() }, [load, loadCount])

  useEffect(() => {
    const handler = () => { load(); loadCount() }
    window.addEventListener('signalr:new-user-notification', handler)
    return () => window.removeEventListener('signalr:new-user-notification', handler)
  }, [load, loadCount])

  const handleMarkRead = async (id: string) => {
    try {
      await userNotificationsApi.markRead(id)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
      setSelected(prev => prev?.id === id ? { ...prev, isRead: true, readAt: new Date().toISOString() } : prev)
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch { /* non-fatal */ }
  }

  const handleMarkAllRead = async () => {
    setMarkingAll(true)
    try {
      await userNotificationsApi.markAllRead()
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() })))
      setUnreadCount(0)
      toast.success('All notifications marked as read')
    } catch { toast.error('Failed to mark all as read') }
    finally { setMarkingAll(false) }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await userNotificationsApi.delete(id)
      setNotifications(prev => prev.filter(n => n.id !== id))
      const wasUnread = notifications.find(n => n.id === id && !n.isRead)
      if (wasUnread) setUnreadCount(prev => Math.max(0, prev - 1))
      if (selected?.id === id) setSelected(null)
    } catch { toast.error('Failed to delete notification') }
    finally { setDeletingId(null) }
  }

  const handleNavigate = async (notif: UserNotification) => {
    if (!notif.isRead) await handleMarkRead(notif.id)
    const route = notif.referenceId && notif.referenceType === 'Ticket'
      ? `/tickets/${notif.referenceId}`
      : TYPE_ROUTE[notif.type]
    if (route) navigate(route)
  }

  const handleCardClick = async (notif: UserNotification) => {
    setSelected(notif)
    if (!notif.isRead) await handleMarkRead(notif.id)
  }

  const displayed = notifications

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            Notification Center
            {unreadCount > 0 && (
              <span className="text-sm font-semibold bg-red-500 text-white rounded-full px-2 py-0.5">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">System alerts and operational notifications</p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {markingAll
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <CheckCheck className="w-4 h-4" />
            }
            Mark All Read
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
        {([
          { id: 'all',    label: 'All' },
          { id: 'unread', label: `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
          { id: 'read',   label: 'Read' },
        ] as const).map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              filter === f.id
                ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Notification list */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-gray-400">
            <Bell className="w-12 h-12 opacity-30" />
            <p className="font-medium">
              {filter === 'unread' ? 'No unread notifications' : filter === 'read' ? 'No read notifications' : 'No notifications yet'}
            </p>
          </div>
        ) : (
          <div>
            {displayed.map((notif) => {
              const meta = getMeta(notif.type)
              const isSelected = selected?.id === notif.id
              return (
                <div
                  key={notif.id}
                  id={`notif-${notif.id}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && handleCardClick(notif)}
                  className={cn(
                    'group relative flex items-start gap-4 px-5 py-4 border-b border-gray-50 dark:border-gray-800 last:border-0 transition-all cursor-pointer select-none',
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-inset ring-blue-200 dark:ring-blue-700'
                      : !notif.isRead
                        ? 'bg-blue-50/40 dark:bg-blue-900/10 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/50',
                    !notif.isRead && 'border-l-4 border-l-blue-500',
                  )}
                  onClick={() => handleCardClick(notif)}
                >
                  {/* Icon */}
                  <div className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5', meta.bg)}>
                    <span className={meta.color}>{meta.icon}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide', meta.badge)}>
                        {notif.type}
                      </span>
                      {!notif.isRead && (
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 rounded uppercase tracking-wide">
                          New
                        </span>
                      )}
                      <span className="ml-auto text-[11px] text-gray-400 flex-shrink-0">{formatRelative(notif.createdAt)}</span>
                    </div>

                    <p className={cn(
                      'text-sm leading-snug',
                      !notif.isRead ? 'font-semibold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-300',
                    )}>
                      {notif.title}
                    </p>

                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">
                      {notif.message}
                    </p>

                    {notif.referenceId && (
                      <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-medium text-gray-500 bg-gray-100 dark:bg-gray-800 rounded px-1.5 py-0.5">
                        <Tag className="w-2.5 h-2.5" />
                        {notif.referenceType} #{notif.referenceId}
                      </span>
                    )}
                  </div>

                  {/* Right side */}
                  <div className="flex flex-col items-center gap-1.5 flex-shrink-0 self-center">
                    <ChevronRight className={cn(
                      'w-4 h-4 transition-transform',
                      isSelected ? 'text-blue-500 translate-x-0.5' : 'text-gray-300 dark:text-gray-600',
                    )} />
                    <button
                      id={`delete-notif-${notif.id}`}
                      onClick={(e) => { e.stopPropagation(); handleDelete(notif.id) }}
                      disabled={deletingId === notif.id}
                      className="p-1 rounded-lg text-gray-300 dark:text-gray-600 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete notification"
                    >
                      {deletingId === notif.id
                        ? <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />
                      }
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Detail slide-over panel */}
      <DetailPanel
        notif={selected}
        onClose={() => setSelected(null)}
        onMarkRead={handleMarkRead}
        onDelete={handleDelete}
        onNavigate={handleNavigate}
        deletingId={deletingId}
      />
    </div>
  )
}
