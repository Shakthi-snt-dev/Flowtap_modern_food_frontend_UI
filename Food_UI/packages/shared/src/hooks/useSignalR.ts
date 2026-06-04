import { useEffect, useState } from 'react'
import type { HubConnection } from '@microsoft/signalr'
import { startSignalR, stopSignalR } from '../lib/signalr'
import { useAppSelector } from '@flowtap/store'
import type { RootState } from '@flowtap/store'

export function useSignalR() {
  const token = useAppSelector((s: RootState) => s.auth.token)
  const [connection, setConnection] = useState<HubConnection | null>(null)

  useEffect(() => {
    if (!token) return
    let mounted = true
    startSignalR(token)
      .then((conn) => { if (mounted) setConnection(conn) })
      .catch((err) => { console.warn('[SignalR] Failed to connect:', err) })
    return () => {
      mounted = false
      stopSignalR()
      setConnection(null)
    }
  }, [token])

  return connection
}
