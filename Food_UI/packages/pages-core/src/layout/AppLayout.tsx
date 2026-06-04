import React, { useCallback, useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar, type NavItem } from '@flowtap/ui-core'
import { useAppDispatch, useAppSelector, setOffline } from '@flowtap/store'
import { cn } from '@flowtap/shared'
import { notificationsApi, userNotificationsApi } from '@flowtap/api-core'
import { TopNav } from './TopNav'
import { OfflineBanner, BroadcastBanner, AnnouncementBanner, AnnouncementPopup } from '@flowtap/ui-core'

interface AppLayoutProps {
  extraNavItems?: NavItem[]
}

export const AppLayout: React.FC<AppLayoutProps> = ({ extraNavItems = [] }) => {
  const dispatch       = useAppDispatch()
  const sidebarOpen    = useAppSelector((s) => s.ui.sidebarOpen)
  const tenant         = useAppSelector((s) => s.tenant.tenant)
  const currentStoreId = useAppSelector((s) => s.tenant.currentStoreId)

  const [bannerCount, setBannerCount] = useState(0)
  const [notifUnreadCount, setNotifUnreadCount] = useState(0)

  useEffect(() => {
    if (!tenant?.id) return
    notificationsApi
      .getBroadcasts({ companyId: tenant.id, locationId: currentStoreId ?? undefined, limit: 5 })
      .then((res) => setBannerCount((res.data?.data ?? []).length))
      .catch(() => {})
  }, [tenant?.id, currentStoreId])

  const loadNotifCount = useCallback(async () => {
    if (!tenant?.id) return
    try {
      const res = await userNotificationsApi.getUnreadCount()
      setNotifUnreadCount(Number(res.data?.data ?? res.data ?? 0))
    } catch { /* non-fatal */ }
  }, [tenant?.id])

  useEffect(() => {
    loadNotifCount()
    const interval = setInterval(loadNotifCount, 60_000)
    return () => clearInterval(interval)
  }, [loadNotifCount])

  useEffect(() => {
    const handler = () => loadNotifCount()
    window.addEventListener('signalr:new-user-notification', handler)
    return () => window.removeEventListener('signalr:new-user-notification', handler)
  }, [loadNotifCount])

  useEffect(() => {
    const onOnline  = () => dispatch(setOffline(false))
    const onOffline = () => dispatch(setOffline(true))
    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [dispatch])

  const bannerOffset = bannerCount > 0 ? bannerCount * 40 : 0

  return (
    <div className="min-h-screen bg-[var(--page-bg)]">
      <OfflineBanner />
      <TopNav />
      <BroadcastBanner />
      <AnnouncementBanner />
      <AnnouncementPopup />
      <Sidebar
        extraNavItems={extraNavItems}
        notifUnreadCount={notifUnreadCount}
        onNotifClick={() => setNotifUnreadCount(0)}
      />
      <main
        className={cn('pt-16 transition-all duration-300', sidebarOpen ? 'lg:pl-64' : 'lg:pl-16')}
        style={bannerOffset > 0 ? { paddingTop: `${64 + bannerOffset}px` } : undefined}
      >
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
