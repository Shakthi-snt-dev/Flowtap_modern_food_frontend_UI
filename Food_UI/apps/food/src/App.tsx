import React, { useEffect, useRef } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector, setUser, setTenant, setStores, setCurrentStore, setBootstrapped, applyAppearance, logout, clearTenant } from '@flowtap/store'
import { extractPermissions } from '@flowtap/shared'
import { ProtectedRoute, GuestRoute, OnboardingRoute, PageLoader } from '@flowtap/ui-core'
import { AppLayout } from '@flowtap/pages-core'
import { authApi, tenantApi, storeSettingsApi } from '@flowtap/api-core'
import { useSignalR } from '@flowtap/shared'
import { UtensilsCrossed, ClipboardList, BookOpen, AlertTriangle, ChefHat, Monitor } from 'lucide-react'

// Shared pages
const LoginPage            = React.lazy(() => import('@flowtap/pages-core').then((m) => ({ default: m.LoginPage })))
const SignupPage            = React.lazy(() => import('@flowtap/pages-core').then((m) => ({ default: m.SignupPage })))
const VerifyEmailPage       = React.lazy(() => import('@flowtap/pages-core').then((m) => ({ default: m.VerifyEmailPage })))
const ForgotPasswordPage    = React.lazy(() => import('@flowtap/pages-core').then((m) => ({ default: m.ForgotPasswordPage })))
const ResetPasswordPage     = React.lazy(() => import('@flowtap/pages-core').then((m) => ({ default: m.ResetPasswordPage })))
const OnboardingPage        = React.lazy(() => import('@flowtap/pages-core').then((m) => ({ default: m.FoodOnboardingPage })))
const DashboardPage         = React.lazy(() => import('@flowtap/pages-core').then((m) => ({ default: m.DashboardPage })))
const POSPage               = React.lazy(() => import('@flowtap/pages-core').then((m) => ({ default: m.POSPage })))
const ProductsPage          = React.lazy(() => import('@flowtap/pages-core').then((m) => ({ default: m.ProductsPage })))
const WarehousePage         = React.lazy(() => import('@flowtap/pages-core').then((m) => ({ default: m.WarehousePage })))
const StockPage             = React.lazy(() => import('@flowtap/pages-core').then((m) => ({ default: m.StockPage })))
const TransfersPage         = React.lazy(() => import('@flowtap/pages-core').then((m) => ({ default: m.TransfersPage })))
const WriteOffsPage         = React.lazy(() => import('@flowtap/pages-core').then((m) => ({ default: m.WriteOffsPage })))
const SerialsPage           = React.lazy(() => import('@flowtap/pages-core').then((m) => ({ default: m.SerialsPage })))
const ReorderPage           = React.lazy(() => import('@flowtap/pages-core').then((m) => ({ default: m.ReorderPage })))
const InventorySettingsPage = React.lazy(() => import('@flowtap/pages-core').then((m) => ({ default: m.InventorySettingsPage })))
const PurchasesPage         = React.lazy(() => import('@flowtap/pages-core').then((m) => ({ default: m.PurchasesPage })))
const SuppliersPage         = React.lazy(() => import('@flowtap/pages-core').then((m) => ({ default: m.SuppliersPage })))
const ClientsPage           = React.lazy(() => import('@flowtap/pages-core').then((m) => ({ default: m.ClientsPage })))
const EmployeesPage         = React.lazy(() => import('@flowtap/pages-core').then((m) => ({ default: m.EmployeesPage })))
const ReportsPage           = React.lazy(() => import('@flowtap/pages-core').then((m) => ({ default: m.ReportsPage })))
const SettingsPage          = React.lazy(() => import('@flowtap/pages-core').then((m) => ({ default: m.SettingsPage })))
const AuditLogsPage         = React.lazy(() => import('@flowtap/pages-core').then((m) => ({ default: m.AuditLogsPage })))
const SalesPage             = React.lazy(() => import('@flowtap/pages-core').then((m) => ({ default: m.SalesPage })))
const PaymentsHistoryPage   = React.lazy(() => import('@flowtap/pages-core').then((m) => ({ default: m.PaymentsHistoryPage })))
const IntegrationsPage      = React.lazy(() => import('@flowtap/pages-core').then((m) => ({ default: m.IntegrationsPage })))
const CommunicationsPage    = React.lazy(() => import('@flowtap/pages-core').then((m) => ({ default: m.CommunicationsPage })))
const MarketingPage         = React.lazy(() => import('@flowtap/pages-core').then((m) => ({ default: m.MarketingPage })))
const AdminOverviewPage     = React.lazy(() => import('@flowtap/pages-core').then((m) => ({ default: m.AdminOverviewPage })))
const StoreAdminPage        = React.lazy(() => import('@flowtap/pages-core').then((m) => ({ default: m.StoreAdminPage })))
const NotificationsPage     = React.lazy(() => import('@flowtap/pages-core').then((m) => ({ default: m.NotificationsPage })))
const SuperAdminPage        = React.lazy(() => import('@flowtap/pages-core').then((m) => ({ default: m.SuperAdminPage })))

// Food industry pages — all from @flowtap/pages-core (real API wired)
const FoodTablesPage       = React.lazy(() => import('@flowtap/pages-core').then((m) => ({ default: m.FoodTablesPage })))
const FoodKOTPage          = React.lazy(() => import('@flowtap/pages-core').then((m) => ({ default: m.FoodKOTPage })))
const FoodRecipePage       = React.lazy(() => import('@flowtap/pages-core').then((m) => ({ default: m.FoodRecipePage })))
const FoodMenuPage         = React.lazy(() => import('@flowtap/pages-core').then((m) => ({ default: m.FoodMenuPage })))
const FoodKDSPage          = React.lazy(() => import('@flowtap/pages-core').then((m) => ({ default: m.FoodKDSPage })))
const FoodStockAlertPage   = React.lazy(() => import('@flowtap/pages-core').then((m) => ({ default: m.FoodStockAlertPage })))

const foodNav = [
  { label: 'Menu',          href: '/food/menu',           icon: <ChefHat         className="w-5 h-5" /> },
  { label: 'Tables',        href: '/food/tables',         icon: <UtensilsCrossed className="w-5 h-5" /> },
  { label: 'KOT',           href: '/food/kot',            icon: <ClipboardList   className="w-5 h-5" /> },
  { label: 'KDS',           href: '/food/kds',            icon: <Monitor         className="w-5 h-5" /> },
  { label: 'Recipes',       href: '/food/recipes',        icon: <BookOpen        className="w-5 h-5" /> },
  { label: 'Stock Alerts',  href: '/food/stock-alerts',   icon: <AlertTriangle   className="w-5 h-5" /> },
]

const App: React.FC = () => {
  const dispatch = useAppDispatch()
  const token    = useAppSelector((s) => s.auth.token)
  const ownerUser = useAppSelector((s) => s.auth.ownerUser)
  const connection = useSignalR()
  const signalRBound = useRef(false)

  // Always apply Food Orange — this is the dedicated Food industry app
  useEffect(() => {
    const NON_FOOD = ['blue', 'purple', 'green', 'orange', 'rose', 'teal', 'amber', 'slate']
    const savedAccent = localStorage.getItem('accentColor')
    const accent = (!savedAccent || NON_FOOD.includes(savedAccent)) ? 'food-orange' : savedAccent
    const savedTheme = localStorage.getItem('colorTheme')
    const theme = (!savedTheme || savedTheme === 'default') ? 'food-light' : savedTheme
    localStorage.setItem('accentColor', accent)
    localStorage.setItem('colorTheme', theme)
    dispatch(applyAppearance({ accentColor: accent, colorTheme: theme, themeMode: 'light', borderRadius: 'normal', fontFamily: 'inter' }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Global 401 handler — soft logout without hard page reload
  useEffect(() => {
    const handle401 = () => { dispatch(logout()); dispatch(clearTenant()) }
    window.addEventListener('auth:unauthorized', handle401)
    return () => window.removeEventListener('auth:unauthorized', handle401)
  }, [dispatch])

  useEffect(() => {
    if (!connection || signalRBound.current) return
    signalRBound.current = true
    connection.on('NewBroadcast', () => window.dispatchEvent(new CustomEvent('signalr:new-broadcast')))
    connection.on('NewDirectMessage', () => window.dispatchEvent(new CustomEvent('signalr:new-dm')))
    connection.on('NewUserNotification', () => window.dispatchEvent(new CustomEvent('signalr:new-user-notification')))
    return () => {
      connection.off('NewBroadcast')
      connection.off('NewDirectMessage')
      connection.off('NewUserNotification')
      signalRBound.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection])

  useEffect(() => {
    if (!token || ownerUser) return

    authApi.getCurrentUser().then((res) => {
      const u = res.data.data
      if (!u) return
      const role = String(u.accountType ?? u.role ?? '')
      const storedToken = localStorage.getItem('token') ?? ''
      const permissions = extractPermissions(storedToken)
      dispatch(setUser({ id: String(u.id ?? ''), email: String(u.email ?? ''), name: String(u.name ?? ''), role, defaultLocationId: u.defaultLocationId ? String(u.defaultLocationId) : undefined, permissions: permissions ?? undefined }))
      if (u.defaultLocationId && !localStorage.getItem('currentStoreId')) {
        localStorage.setItem('currentStoreId', u.defaultLocationId)
        dispatch(setCurrentStore(u.defaultLocationId))
      }
      if (role === 'SuperAdmin' && !window.location.pathname.startsWith('/superadmin')) {
        window.location.replace('/superadmin')
      }
    }).catch(() => {})

    tenantApi.getTenant().then((res) => {
      const t = res.data.data
      if (t) {
        dispatch(setTenant({ id: t.id, title: t.title, businessType: t.businessType ?? '', industryType: String(t.industryType ?? ''), modules: t.activeModules ? t.activeModules.split(',').map((m: string) => m.trim()) : [], phone: t.phone ?? '', email: t.email ?? '', country: t.country ?? '', currency: t.currency ?? '', createdAt: t.createdAt ?? t.created_at ?? undefined, plan: t.plan ?? t.subscriptionPlan ?? 'free', maxLocations: t.maxLocations ?? 1, maxEmployees: t.maxEmployees ?? 5, timeZoneId: t.timeZoneId ?? undefined, logoUrl: t.logoUrl ?? undefined, isOnboardingComplete: t.isOnboardingComplete ?? false }))
        tenantApi.getStores(t.id).then((storesRes) => {
          const raw: Record<string, unknown>[] = storesRes.data.data ?? []
          const stores = raw.map((s) => ({ id: String(s.id ?? ''), name: String(s.title ?? s.name ?? ''), address: String(s.address ?? ''), phone: String(s.phone ?? ''), email: String(s.email ?? ''), city: String(s.city ?? ''), state: String(s.state ?? ''), countryCode: String(s.countryCode ?? s.country ?? ''), currencyCode: String(s.currencyCode ?? s.currency ?? ''), postalCode: String(s.postalCode ?? ''), locationCode: String(s.locationCode ?? ''), type: Number(s.type ?? 1), isDefault: Boolean(s.isDefault), timeZoneId: s.timeZoneId ? String(s.timeZoneId) : undefined }))
          if (stores.length > 0) {
            dispatch(setStores(stores))
            const savedStoreId = localStorage.getItem('currentStoreId')
            const targetStoreId = savedStoreId || stores[0].id
            const finalStoreId = stores.some((s) => s.id === targetStoreId) ? targetStoreId : stores[0].id
            dispatch(setCurrentStore(finalStoreId))
            storeSettingsApi.get(finalStoreId).then((appRes) => {
              const d = appRes.data?.data
              if (d) dispatch(applyAppearance({ themeMode: d.themeMode, colorTheme: d.colorTheme, accentColor: d.accentColor, fontFamily: d.fontFamily, borderRadius: d.borderRadius, sidebarDensity: d.sidebarDensity }))
            }).catch(() => {})
          }
        }).catch(() => {})
      } else {
        dispatch(setBootstrapped())
      }
    }).catch(() => { dispatch(setBootstrapped()) })
  }, [token, ownerUser])

  return (
    <React.Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<GuestRoute />}>
          <Route path="/login"            element={<LoginPage />} />
          <Route path="/signup"           element={<SignupPage />} />
          <Route path="/verify-email"     element={<VerifyEmailPage />} />
          <Route path="/forgot-password"  element={<ForgotPasswordPage />} />
          <Route path="/reset-password"   element={<ResetPasswordPage />} />
        </Route>

        <Route element={<OnboardingRoute />}>
          <Route path="/onboarding" element={<OnboardingPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="/superadmin" element={<SuperAdminPage />} />
        </Route>

        <Route element={<ProtectedRoute requireTenant />}>
          <Route element={<AppLayout extraNavItems={foodNav} />}>
            <Route index element={<DashboardPage />} />
            <Route path="pos"                      element={<POSPage />} />
            <Route path="products"                 element={<ProductsPage />} />
            <Route path="warehouses"               element={<WarehousePage />} />
            <Route path="inventory"                element={<StockPage />} />
            <Route path="inventory/transfers"      element={<TransfersPage />} />
            <Route path="inventory/write-offs"     element={<WriteOffsPage />} />
            <Route path="inventory/serials"        element={<SerialsPage />} />
            <Route path="inventory/reorder"        element={<ReorderPage />} />
            <Route path="inventory/settings"       element={<InventorySettingsPage />} />
            <Route path="purchases"                element={<PurchasesPage />} />
            <Route path="purchases/suppliers"      element={<SuppliersPage />} />
            <Route path="clients"                  element={<ClientsPage />} />
            <Route path="employees"                element={<EmployeesPage />} />
            <Route path="sales"                    element={<SalesPage />} />
            <Route path="payments"                 element={<Navigate to="/payments/history" replace />} />
            <Route path="payments/history"         element={<PaymentsHistoryPage />} />
            <Route path="integrations"             element={<IntegrationsPage />} />
            <Route path="reports"                  element={<ReportsPage />} />
            <Route path="settings"                 element={<SettingsPage />} />
            <Route path="audit-logs"               element={<AuditLogsPage />} />
            <Route path="communications"           element={<CommunicationsPage />} />
            <Route path="marketing"                element={<MarketingPage />} />
            <Route path="marketing/offers"         element={<MarketingPage initialTab="offers" />} />
            <Route path="admin"                    element={<AdminOverviewPage />} />
            <Route path="store-admin"              element={<StoreAdminPage />} />
            <Route path="notifications"            element={<NotificationsPage />} />
            {/* Food-specific — all wired to real backend APIs */}
            <Route path="food/menu"           element={<FoodMenuPage />} />
            <Route path="food/tables"         element={<FoodTablesPage />} />
            <Route path="food/kot"            element={<FoodKOTPage />} />
            <Route path="food/kds"            element={<FoodKDSPage />} />
            <Route path="food/recipes"        element={<FoodRecipePage />} />
            <Route path="food/stock-alerts"   element={<FoodStockAlertPage />} />
            {/* Legacy redirects for old routes */}
            <Route path="tables"              element={<Navigate to="/food/tables" replace />} />
            <Route path="kot"                 element={<Navigate to="/food/kot" replace />} />
            <Route path="recipes"             element={<Navigate to="/food/recipes" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
    </React.Suspense>
  )
}

export default App
