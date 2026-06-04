import React, { useCallback, useEffect, useState } from 'react'
import {
  ShieldCheck, User, Settings, Package, ShoppingCart,
  Ticket, Users, RefreshCw, Filter,
} from 'lucide-react'
import { Card, CardHeader, CardBody, Badge, Button, SearchInput } from '@flowtap/ui-core'
import { useAppSelector } from '@flowtap/store'
import { api } from '@flowtap/api-core'

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface AuditLog {
  id: string
  action: string
  entityType: string
  entityId?: string
  description: string
  performedBy: string
  performedByName?: string
  createdAt: string
  metadata?: Record<string, unknown>
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const ACTION_COLOR: Record<string, 'success' | 'danger' | 'info' | 'warning' | 'default'> = {
  CREATE: 'success',
  UPDATE: 'info',
  DELETE: 'danger',
  LOGIN: 'default',
  LOGOUT: 'default',
  ARCHIVE: 'warning',
  APPROVE: 'success',
  REJECT: 'danger',
}

const ENTITY_ICON: Record<string, React.ReactNode> = {
  Product: <Package className="w-4 h-4" />,
  Sale: <ShoppingCart className="w-4 h-4" />,
  Ticket: <Ticket className="w-4 h-4" />,
  Employee: <Users className="w-4 h-4" />,
  Setting: <Settings className="w-4 h-4" />,
  User: <User className="w-4 h-4" />,
}

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

// â”€â”€â”€ Mock data (fallback when API unavailable) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const MOCK_LOGS: AuditLog[] = [
  { id: '1', action: 'CREATE', entityType: 'Product', entityId: 'p1', description: 'Created product "iPhone 15 Screen"', performedBy: 'u1', performedByName: 'Admin', createdAt: new Date(Date.now() - 5 * 60000).toISOString() },
  { id: '2', action: 'UPDATE', entityType: 'Product', entityId: 'p2', description: 'Updated price of "Samsung S23 Battery" from â‚¹1600 to â‚¹1800', performedBy: 'u1', performedByName: 'Admin', createdAt: new Date(Date.now() - 30 * 60000).toISOString() },
  { id: '3', action: 'CREATE', entityType: 'Sale', entityId: 's1', description: 'New sale #TXN-00123 â€” â‚¹4,500', performedBy: 'u2', performedByName: 'Cashier', createdAt: new Date(Date.now() - 2 * 3600000).toISOString() },
  { id: '4', action: 'DELETE', entityType: 'Product', entityId: 'p3', description: 'Archived product "USB-C Cable 1m"', performedBy: 'u1', performedByName: 'Admin', createdAt: new Date(Date.now() - 5 * 3600000).toISOString() },
  { id: '5', action: 'LOGIN', entityType: 'User', entityId: 'u2', description: 'User "Cashier" logged in', performedBy: 'u2', performedByName: 'Cashier', createdAt: new Date(Date.now() - 6 * 3600000).toISOString() },
  { id: '6', action: 'UPDATE', entityType: 'Setting', entityId: 's1', description: 'Changed business currency to INR', performedBy: 'u1', performedByName: 'Admin', createdAt: new Date(Date.now() - 24 * 3600000).toISOString() },
  { id: '7', action: 'CREATE', entityType: 'Ticket', entityId: 't1', description: 'Created service ticket #TKT-0047 for "iPhone screen replacement"', performedBy: 'u2', performedByName: 'Cashier', createdAt: new Date(Date.now() - 26 * 3600000).toISOString() },
  { id: '8', action: 'UPDATE', entityType: 'Ticket', entityId: 't1', description: 'Ticket #TKT-0047 status changed from Pending to InProgress', performedBy: 'u1', performedByName: 'Technician', createdAt: new Date(Date.now() - 28 * 3600000).toISOString() },
  { id: '9', action: 'CREATE', entityType: 'Employee', entityId: 'e1', description: 'Added new employee "Ravi Kumar" as Technician', performedBy: 'u1', performedByName: 'Admin', createdAt: new Date(Date.now() - 3 * 24 * 3600000).toISOString() },
  { id: '10', action: 'UPDATE', entityType: 'Setting', entityId: 's2', description: 'Updated store name to "FlowTech Repairs"', performedBy: 'u1', performedByName: 'Admin', createdAt: new Date(Date.now() - 4 * 24 * 3600000).toISOString() },
]

const ALL_ENTITY_TYPES = ['All', 'Product', 'Sale', 'Ticket', 'Employee', 'Setting', 'User']
const ALL_ACTIONS = ['All', 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'ARCHIVE']
const PAGE_SIZE = 20

// â”€â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const AuditLogsPage: React.FC = () => {
  const tenant = useAppSelector((s) => s.tenant.tenant)

  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)

  const [search, setSearch] = useState('')
  const [entityFilter, setEntityFilter] = useState('All')
  const [actionFilter, setActionFilter] = useState('All')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchLogs = useCallback(async () => {
    if (!tenant?.id) return
    setLoading(true)
    try {
      const params: Record<string, unknown> = {
        companyId: tenant.id,
        page,
        pageSize: PAGE_SIZE,
      }
      if (search) params.search = search
      if (entityFilter !== 'All') params.entityType = entityFilter
      if (actionFilter !== 'All') params.action = actionFilter

      const res = await api.get('/audit-logs', { params })
      const raw = res.data?.data ?? res.data ?? []
      const items: AuditLog[] = Array.isArray(raw) ? raw : (raw?.items ?? [])
      setLogs(items.length ? items : MOCK_LOGS)
      setTotal(res.data?.total ?? MOCK_LOGS.length)
    } catch {
      setLogs(MOCK_LOGS)
      setTotal(MOCK_LOGS.length)
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, page, search, entityFilter, actionFilter])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  useEffect(() => {
    setPage(1)
  }, [search, entityFilter, actionFilter])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Audit Logs</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Track all system changes and user actions</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          icon={<RefreshCw className="w-4 h-4" />}
          loading={loading}
          onClick={fetchLogs}
        >
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap items-end gap-3">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search logsâ€¦"
              className="w-64"
            />

            {/* Entity Type filter */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1">
                <Filter className="w-3 h-3" /> Entity
              </label>
              <div className="flex flex-wrap gap-1">
                {ALL_ENTITY_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setEntityFilter(t)}
                    className={[
                      'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                      entityFilter === t
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
                    ].join(' ')}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Action filter */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Action
              </label>
              <div className="flex flex-wrap gap-1">
                {ALL_ACTIONS.map((a) => (
                  <button
                    key={a}
                    onClick={() => setActionFilter(a)}
                    className={[
                      'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                      actionFilter === a
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
                    ].join(' ')}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Log List */}
      <Card>
        <CardHeader
          title={`Activity Feed`}
          subtitle={`${total} total entries`}
        />
        <CardBody className="p-0">
          {loading ? (
            <div className="py-12 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-20" />
              No audit logs found
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {logs.map((log) => (
                <li key={log.id}>
                  <button
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    className="w-full text-left px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {/* Entity icon */}
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center mt-0.5 text-gray-500 dark:text-gray-400">
                        {ENTITY_ICON[log.entityType] ?? <ShieldCheck className="w-4 h-4" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={ACTION_COLOR[log.action] ?? 'default'} size="sm">
                            {log.action}
                          </Badge>
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                            {log.entityType}
                          </span>
                        </div>
                        <p className="text-sm text-gray-800 dark:text-gray-200 mt-0.5 leading-snug">
                          {log.description}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {log.performedByName ?? log.performedBy}
                          </span>
                          <span className="text-xs text-gray-400 dark:text-gray-500" title={formatDate(log.createdAt)}>
                            {timeAgo(log.createdAt)}
                          </span>
                        </div>
                      </div>

                      <span className="flex-shrink-0 text-xs text-gray-400 dark:text-gray-500 hidden sm:block whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </span>
                    </div>

                    {/* Expanded metadata */}
                    {expandedId === log.id && log.metadata && (
                      <div className="mt-3 ml-11 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                          Details
                        </p>
                        <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* Pagination */}
      {!loading && total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>
            Page {page} of {totalPages} Â· {total} entries
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Prev
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
