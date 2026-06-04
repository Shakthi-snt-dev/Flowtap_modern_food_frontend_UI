import React from 'react'
import { WifiOff } from 'lucide-react'
import { useAppSelector } from '@flowtap/store'

export const OfflineBanner: React.FC = () => {
  const isOffline = useAppSelector((s) => s.ui.isOffline)

  if (!isOffline) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-orange-500 text-white px-4 py-2 text-sm flex items-center justify-center gap-2">
      <WifiOff className="w-4 h-4" />
      You are offline. Changes will sync when reconnected.
    </div>
  )
}
