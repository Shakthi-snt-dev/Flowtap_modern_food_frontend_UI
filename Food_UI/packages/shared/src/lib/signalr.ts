import * as signalR from '@microsoft/signalr'

let connection: signalR.HubConnection | null = null

const HUB_URL = import.meta.env.VITE_SIGNALR_URL ?? 'http://localhost:5172/hubs/communications'

export function getSignalRConnection(token: string): signalR.HubConnection {
  if (connection && connection.state !== signalR.HubConnectionState.Disconnected) {
    return connection
  }
  connection = new signalR.HubConnectionBuilder()
    .withUrl(HUB_URL, { accessTokenFactory: () => token })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .configureLogging(signalR.LogLevel.Warning)
    .build()
  return connection
}

export async function startSignalR(token: string): Promise<signalR.HubConnection> {
  const conn = getSignalRConnection(token)
  if (conn.state === signalR.HubConnectionState.Disconnected) {
    await conn.start()
  }
  return conn
}

export function stopSignalR(): void {
  if (connection) {
    connection.stop()
    connection = null
  }
}

export function getConnection(): signalR.HubConnection | null {
  return connection
}
