import React, { useState, useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import {
  Send, MessageSquare, Inbox, PenSquare, Trash2, AlertCircle,
  MessageCircle, ChevronLeft, User, Eye,
} from 'lucide-react'
import { useAppSelector } from '@flowtap/store'
import { messagesApi, DirectMessage } from '@flowtap/api-core'
import { employeesApi } from '@flowtap/api-core'
import { chatApi } from '@flowtap/api-core'
import { Button, Spinner } from '@flowtap/ui-core'
import { cn } from '@flowtap/shared'
import { getConnection } from '@flowtap/shared'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Employee { id: string; name: string; userAccountId: string }

interface Conversation {
  id: string
  title: string | null
  isGroup: boolean
  lastMessage: string
  lastSenderName: string
  lastMessageAt: string
  unreadCount: number
  lastSeenAt: string | null
  participants: { userId: string; name: string }[]
}

interface ChatMessage {
  id: string
  senderId: string
  senderName: string
  body: string
  isDeleted: boolean
  createdAt: string
  isOwn: boolean
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export const CommunicationsPage: React.FC = () => {
  const tenant         = useAppSelector(s => s.tenant.tenant)
  const user           = useAppSelector(s => s.auth.user)
  const currentStoreId = useAppSelector(s => s.tenant.currentStoreId)

  const userRole = user?.role || (user as any)?.accountType || ''
  const isAdmin  = userRole === 'Owner' || userRole === 'Admin' || userRole === 'Manager'

  // ── Main tab ───────────────────────────────────────────────────────────────
  const [mainTab, setMainTab] = useState<'messages' | 'chat'>('messages')

  // ── Messages (DM) state ───────────────────────────────────────────────────
  const [msgSubTab,      setMsgSubTab]      = useState<'inbox' | 'sent' | 'compose'>('inbox')
  const [inbox,          setInbox]          = useState<DirectMessage[]>([])
  const [sent,           setSent]           = useState<DirectMessage[]>([])
  const [msgLoading,     setMsgLoading]     = useState(false)
  const [expandedId,     setExpandedId]     = useState<string | null>(null)
  const [complaintOnly,  setComplaintOnly]  = useState(false)
  const [employees,      setEmployees]      = useState<Employee[]>([])
  const [recipient,      setRecipient]      = useState('')
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody,    setComposeBody]    = useState('')
  const [isComplaint,    setIsComplaint]    = useState(false)
  const [composeSending, setComposeSending] = useState(false)

  // ── Chat state ─────────────────────────────────────────────────────────────
  const [conversations,      setConversations]      = useState<Conversation[]>([])
  const [chatMessages,       setChatMessages]        = useState<ChatMessage[]>([])
  const [activeConvId,       setActiveConvId]        = useState<string | null>(null)
  const [chatLoading,        setChatLoading]         = useState(false)
  const [msgLoading2,        setMsgLoading2]         = useState(false)
  const [chatInput,          setChatInput]           = useState('')
  const [chatSending,        setChatSending]         = useState(false)
  const [showNewChat,        setShowNewChat]         = useState(false)
  const [newChatUserId,      setNewChatUserId]       = useState('')
  const [startingConv,       setStartingConv]        = useState(false)
  // Sub-tab inside chat: "mine" = conversations I participate in, "others" = all other employee chats (admin only)
  const [chatSubTab,         setChatSubTab]          = useState<'mine' | 'others'>('mine')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const prevConvIdRef  = useRef<string | null>(null)

  // ── Load employees for compose + new chat (scoped to current store) ────────
  const loadEmployees = useCallback(async () => {
    if (!tenant?.id) return
    try {
      const res = await employeesApi.getEmployees({
        companyId: tenant.id,
        locationId: currentStoreId || undefined,
        isActive: true,
        pageSize: 200,
      })
      const raw = res.data?.data?.items ?? res.data?.data ?? []
      setEmployees((Array.isArray(raw) ? raw : []).map((e: any) => ({
        id: String(e.id),
        name: String(e.name ?? ''),
        userAccountId: String(e.userAccountId ?? e.id),
      })))
    } catch { /* non-fatal */ }
  }, [tenant?.id, currentStoreId])

  // ── Load inbox / sent ──────────────────────────────────────────────────────
  const loadInbox = useCallback(async () => {
    if (!tenant?.id) return
    setMsgLoading(true)
    try {
      const res = await messagesApi.getInbox({
        isComplaint: complaintOnly ? true : undefined,
      })
      const items: any[] = res.data?.data ?? []
      setInbox(items.map((m: any) => ({
        id:            String(m.id),
        subject:       String(m.subject ?? ''),
        body:          String(m.body ?? ''),
        senderId:      String(m.senderId ?? ''),
        senderName:    String(m.senderName ?? 'Unknown'),
        recipientId:   String(m.recipientId ?? ''),
        recipientName: String(m.recipientName ?? 'Unknown'),
        isRead:        Boolean(m.isRead),
        isComplaint:   Boolean(m.isComplaint),
        createdAt:     String(m.createdAt ?? ''),
        readAt:        m.readAt ?? undefined,
      })))
    } catch { toast.error('Failed to load inbox') }
    finally { setMsgLoading(false) }
  }, [tenant?.id, complaintOnly])

  const loadSent = useCallback(async () => {
    if (!tenant?.id) return
    setMsgLoading(true)
    try {
      const res = await messagesApi.getSent()
      const items: any[] = res.data?.data ?? []
      setSent(items.map((m: any) => ({
        id:            String(m.id),
        subject:       String(m.subject ?? ''),
        body:          String(m.body ?? ''),
        senderId:      String(m.senderId ?? ''),
        senderName:    String(m.senderName ?? 'Unknown'),
        recipientId:   String(m.recipientId ?? ''),
        recipientName: String(m.recipientName ?? 'Unknown'),
        isRead:        Boolean(m.isRead),
        isComplaint:   Boolean(m.isComplaint),
        createdAt:     String(m.createdAt ?? ''),
        readAt:        m.readAt ?? undefined,
      })))
    } catch { toast.error('Failed to load sent messages') }
    finally { setMsgLoading(false) }
  }, [tenant?.id])

  useEffect(() => {
    if (mainTab !== 'messages') return
    if (msgSubTab === 'inbox') loadInbox()
    else if (msgSubTab === 'sent') loadSent()
    else if (msgSubTab === 'compose') loadEmployees()
  }, [mainTab, msgSubTab, loadInbox, loadSent, loadEmployees])

  useEffect(() => {
    if (msgSubTab === 'inbox') loadInbox()
  }, [complaintOnly]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Chat: load conversations scoped to current store ──────────────────────
  const loadConversations = useCallback(async () => {
    if (!tenant?.id) return
    setChatLoading(true)
    try {
      const res = await chatApi.getConversations(currentStoreId ?? undefined)
      const raw: any[] = res.data?.data ?? res.data?.data?.items ?? []
      setConversations(raw.map((c: any) => ({
        id:            String(c.id),
        title:         c.title ?? null,
        isGroup:       Boolean(c.isGroup),
        lastMessage:   String(c.lastMessage ?? ''),
        lastSenderName: String(c.lastSenderName ?? ''),
        lastMessageAt: String(c.lastMessageAt ?? c.createdAt ?? ''),
        unreadCount:   Number(c.unreadCount ?? 0),
        lastSeenAt:    c.lastSeenAt ?? null,
        participants:  (c.participants ?? []).map((p: any) => ({
          userId: String(p.userId),
          name: String(p.name ?? 'Unknown'),
        })),
      })))
    } catch { /* non-fatal */ }
    finally { setChatLoading(false) }
  }, [tenant?.id, currentStoreId])

  // ── Chat: load messages for active conversation ────────────────────────────
  const loadMessages = useCallback(async (convId: string) => {
    setMsgLoading2(true)
    try {
      const res = await chatApi.getMessages(convId)
      const raw: any[] = res.data?.data?.items ?? res.data?.data ?? []
      setChatMessages(raw.map((m: any) => ({
        id:         String(m.id),
        senderId:   String(m.senderId ?? ''),
        senderName: String(m.senderName ?? 'Unknown'),
        body:       String(m.body ?? ''),
        isDeleted:  Boolean(m.isDeleted),
        createdAt:  String(m.createdAt ?? ''),
        isOwn:      Boolean(m.isOwn),
      })))
    } catch { /* non-fatal */ }
    finally { setMsgLoading2(false) }
  }, [])

  // ── Chat: SignalR join/leave conversation ──────────────────────────────────
  useEffect(() => {
    if (mainTab !== 'chat') return

    const conn = getConnection()
    if (!conn) return

    // Leave previous conversation
    if (prevConvIdRef.current) {
      conn.invoke('LeaveConversation', prevConvIdRef.current).catch(() => {})
      conn.off('NewChatMessage')
      conn.off('MessageSeen')
    }

    if (!activeConvId) {
      prevConvIdRef.current = null
      return
    }

    prevConvIdRef.current = activeConvId

    // Join new conversation group
    conn.invoke('JoinConversation', activeConvId).catch(() => {})

    // Mark as seen
    chatApi.markSeen(activeConvId).catch(() => {})

    // Listen for new messages
    conn.on('NewChatMessage', (msg: any) => {
      setChatMessages(prev => {
        const exists = prev.find(m => m.id === String(msg.id))
        if (exists) return prev
        return [...prev, {
          id:         String(msg.id),
          senderId:   String(msg.senderId ?? ''),
          senderName: String(msg.senderName ?? ''),
          body:       String(msg.body ?? ''),
          isDeleted:  Boolean(msg.isDeleted),
          createdAt:  String(msg.createdAt ?? new Date().toISOString()),
          isOwn:      String(msg.senderId) === String(user?.id ?? ''),
        }]
      })
      // Update conversation list preview
      setConversations(prev => prev.map(c =>
        c.id === String(msg.conversationId ?? activeConvId)
          ? { ...c, lastMessage: String(msg.body ?? ''), lastMessageAt: new Date().toISOString(), unreadCount: 0 }
          : c
      ))
    })

    conn.on('MessageSeen', (data: any) => {
      console.log('[SignalR] MessageSeen', data)
    })

    return () => {
      if (conn) {
        conn.invoke('LeaveConversation', activeConvId).catch(() => {})
        conn.off('NewChatMessage')
        conn.off('MessageSeen')
      }
    }
  }, [activeConvId, mainTab, user?.id])

  // ── Chat: init load ────────────────────────────────────────────────────────
  useEffect(() => {
    if (mainTab === 'chat') {
      loadConversations()
      loadEmployees()
    }
  }, [mainTab, loadConversations, loadEmployees])

  // ── Reset chat when store switches — show only this store's conversations ──
  useEffect(() => {
    setConversations([])
    setChatMessages([])
    setActiveConvId(null)
    setEmployees([])
    if (mainTab === 'chat') {
      loadConversations()
      loadEmployees()
    }
  }, [currentStoreId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeConvId) loadMessages(activeConvId)
  }, [activeConvId, loadMessages])

  // ── Scroll to bottom on new messages ──────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // ── Message actions ────────────────────────────────────────────────────────
  const handleExpand = async (msg: DirectMessage) => {
    if (expandedId === msg.id) { setExpandedId(null); return }
    setExpandedId(msg.id)
    if (!msg.isRead && msgSubTab === 'inbox') {
      try {
        await messagesApi.markRead(msg.id)
        setInbox(prev => prev.map(m => m.id === msg.id ? { ...m, isRead: true } : m))
      } catch { /* non-fatal */ }
    }
  }

  const handleDelete = async (id: string, fromInbox: boolean) => {
    try {
      await messagesApi.delete(id)
      if (fromInbox) setInbox(prev => prev.filter(m => m.id !== id))
      else setSent(prev => prev.filter(m => m.id !== id))
      if (expandedId === id) setExpandedId(null)
      toast.success('Message deleted')
    } catch { toast.error('Failed to delete') }
  }

  const handleReply = (msg: DirectMessage) => {
    setRecipient(msg.senderId)
    setComposeSubject(`Re: ${msg.subject}`)
    setComposeBody('')
    setIsComplaint(false)
    setMsgSubTab('compose')
    loadEmployees()
  }

  const handleSend = async () => {
    if (!recipient) { toast.error('Select a recipient'); return }
    if (!composeSubject.trim()) { toast.error('Subject is required'); return }
    if (!composeBody.trim()) { toast.error('Message body is required'); return }
    setComposeSending(true)
    try {
      await messagesApi.send({ recipientId: recipient, subject: composeSubject, body: composeBody, isComplaint })
      toast.success('Message sent!')
      setComposeSubject(''); setComposeBody(''); setIsComplaint(false); setRecipient('')
      setMsgSubTab('sent')
      loadSent()
    } catch { toast.error('Failed to send message') }
    finally { setComposeSending(false) }
  }

  // ── Chat actions ───────────────────────────────────────────────────────────
  const handleStartConversation = async () => {
    if (!newChatUserId) { toast.error('Select a user to chat with'); return }
    const emp = employees.find(e => e.userAccountId === newChatUserId)
    if (!emp) return
    setStartingConv(true)
    try {
      const res = await chatApi.startConversation({ otherUserId: emp.userAccountId, otherUserName: emp.name, locationId: currentStoreId ?? undefined })
      const convId = String(res.data?.data ?? res.data)
      await loadConversations()
      setActiveConvId(convId)
      setShowNewChat(false)
      setNewChatUserId('')
    } catch { toast.error('Failed to start conversation') }
    finally { setStartingConv(false) }
  }

  const handleSendChatMessage = async () => {
    if (!activeConvId || !chatInput.trim()) return
    setChatSending(true)
    const body = chatInput.trim()
    setChatInput('')
    try {
      await chatApi.sendMessage(activeConvId, body)
      // Message will arrive via SignalR — no need to reload
    } catch {
      setChatInput(body)
      toast.error('Failed to send message')
    }
    finally { setChatSending(false) }
  }

  const handleDeleteChatMessage = async (msgId: string) => {
    if (!activeConvId) return
    try {
      await chatApi.deleteMessage(activeConvId, msgId)
      setChatMessages(prev => prev.map(m => m.id === msgId ? { ...m, isDeleted: true, body: 'Message deleted' } : m))
    } catch { toast.error('Failed to delete message') }
  }

  const formatDate = (s: string) => {
    try { return new Date(s).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }
    catch { return s }
  }

  const timeAgo = (s: string) => {
    try {
      const diff = (Date.now() - new Date(s).getTime()) / 1000
      if (diff < 60) return 'now'
      if (diff < 3600) return `${Math.floor(diff / 60)}m`
      if (diff < 86400) return `${Math.floor(diff / 3600)}h`
      return `${Math.floor(diff / 86400)}d`
    } catch { return '' }
  }

  // ── Get conversation display name ──────────────────────────────────────────
  const getConvName = (conv: Conversation) => {
    if (conv.title) return conv.title
    const others = conv.participants.filter(p => p.userId !== user?.id)
    return others.map(p => p.name).join(', ') || 'Conversation'
  }

  // ─── Message row ────────────────────────────────────────────────────────────
  const MessageRow = ({ msg, fromInbox }: { msg: DirectMessage; fromInbox: boolean }) => {
    const isExpanded = expandedId === msg.id
    return (
      <div className={cn(
        'border-b border-gray-50 dark:border-gray-800 last:border-0',
        msg.isComplaint && fromInbox ? 'bg-amber-50/40 dark:bg-amber-900/10' : ''
      )}>
        <button
          className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
          onClick={() => handleExpand(msg)}
        >
          <div className="flex-shrink-0 mt-1.5">
            {fromInbox && !msg.isRead
              ? <span className="w-2 h-2 rounded-full bg-blue-500 block" />
              : <span className="w-2 h-2 rounded-full bg-transparent block" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn(
                'text-sm truncate',
                fromInbox && !msg.isRead ? 'font-semibold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-300'
              )}>
                {fromInbox ? msg.senderName : `To: ${msg.recipientName}`}
              </span>
              {msg.isComplaint && (
                <span className="flex-shrink-0 flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 rounded-full px-2 py-0.5">
                  <AlertCircle className="w-3 h-3" />Complaint
                </span>
              )}
              {fromInbox && msg.isRead && (
                <span className="flex-shrink-0 text-[10px] text-green-500">✓ Read</span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{msg.subject}</p>
          </div>
          <span className="text-[11px] text-gray-400 flex-shrink-0 mt-0.5">{formatDate(msg.createdAt)}</span>
        </button>

        {isExpanded && (
          <div className="px-4 pb-4 pt-0 pl-9">
            <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{msg.subject}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap leading-relaxed">{msg.body}</p>
              <div className="flex items-center gap-3 pt-1">
                {fromInbox && (
                  <button
                    onClick={() => handleReply(msg)}
                    className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1"
                  >
                    <Send className="w-3 h-3" /> Reply
                  </button>
                )}
                <button
                  onClick={() => handleDelete(msg.id, fromInbox)}
                  className="text-xs font-medium text-red-500 hover:text-red-600 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
                <span className="ml-auto text-[11px] text-gray-400">
                  {fromInbox ? `From: ${msg.senderName}` : `To: ${msg.recipientName}`}
                  {msg.readAt && ` · Read ${formatDate(msg.readAt)}`}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  const activeConv = activeConvId ? conversations.find(c => c.id === activeConvId) : null

  // Split conversations into "mine" vs "others" (others = admin-only monitoring)
  const myConversations    = conversations.filter(c => c.participants.some(p => p.userId === user?.id))
  const otherConversations = conversations.filter(c => !c.participants.some(p => p.userId === user?.id))

  // The list shown in the left panel depends on the active sub-tab
  const visibleConversations = isAdmin && chatSubTab === 'others' ? otherConversations : myConversations

  // Admin is "observing" when they open a conversation they are not a participant in
  const isObserver = isAdmin && activeConv != null
    && !activeConv.participants.some(p => p.userId === user?.id)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Communications</h1>
        <p className="text-sm text-gray-500 mt-0.5">Private messages and live chat</p>
      </div>

      {/* Main tab switcher */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
        {([
          { id: 'messages', label: 'Messages', icon: <Inbox className="w-4 h-4" /> },
          { id: 'chat',     label: 'Live Chat', icon: <MessageCircle className="w-4 h-4" /> },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setMainTab(t.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              mainTab === t.id
                ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── Messages tab ─────────────────────────────────────────────────────── */}
      {mainTab === 'messages' && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          {/* Sub-tab bar */}
          <div className="flex items-center justify-between px-4 border-b border-gray-100 dark:border-gray-700">
            <div className="flex gap-0">
              {([
                ['inbox', 'Inbox', <Inbox className="w-4 h-4" />],
                ['sent',  'Sent',  <Send  className="w-4 h-4" />],
              ] as const).map(([id, label, icon]) => (
                <button
                  key={id}
                  onClick={() => setMsgSubTab(id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                    msgSubTab === id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                  )}
                >
                  {icon}{label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {msgSubTab === 'inbox' && isAdmin && (
                <button
                  onClick={() => setComplaintOnly(!complaintOnly)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    complaintOnly
                      ? 'bg-amber-100 border-amber-300 text-amber-700 dark:bg-amber-900/30 dark:border-amber-600 dark:text-amber-400'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-amber-300'
                  )}
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  Complaints only
                </button>
              )}
              <button
                onClick={() => { setMsgSubTab('compose'); loadEmployees() }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                <PenSquare className="w-3.5 h-3.5" />
                Compose
              </button>
            </div>
          </div>

          {/* Compose form */}
          {msgSubTab === 'compose' && (
            <div className="p-6 space-y-4 max-w-2xl">
              <h3 className="text-base font-semibold text-gray-800 dark:text-white">New Message</h3>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">To</label>
                <select
                  value={recipient}
                  onChange={e => setRecipient(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select recipient…</option>
                  {employees.map(e => (
                    <option key={e.userAccountId} value={e.userAccountId}>{e.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Subject</label>
                <input
                  type="text"
                  value={composeSubject}
                  onChange={e => setComposeSubject(e.target.value)}
                  placeholder="e.g. Cash drawer discrepancy on shift handover"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Message</label>
                <textarea
                  value={composeBody}
                  onChange={e => setComposeBody(e.target.value)}
                  rows={6}
                  placeholder="Write your message here…"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isComplaint}
                  onChange={e => setIsComplaint(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Flag as complaint</span>
                  <p className="text-xs text-gray-400">Marks your message as a formal complaint — managers can filter by this</p>
                </div>
              </label>
              <div className="flex gap-3">
                <Button
                  onClick={handleSend}
                  disabled={composeSending || !recipient || !composeSubject.trim() || !composeBody.trim()}
                  icon={composeSending
                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Send className="w-4 h-4" />}
                >
                  {composeSending ? 'Sending…' : 'Send Message'}
                </Button>
                <Button variant="ghost" onClick={() => setMsgSubTab('inbox')}>Cancel</Button>
              </div>
            </div>
          )}

          {/* Inbox / Sent list */}
          {msgSubTab !== 'compose' && (
            msgLoading ? (
              <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
            ) : (msgSubTab === 'inbox' ? inbox : sent).length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-20 text-gray-400">
                {msgSubTab === 'inbox'
                  ? <Inbox className="w-12 h-12 opacity-30" />
                  : <MessageSquare className="w-12 h-12 opacity-30" />
                }
                <p className="font-medium">{msgSubTab === 'inbox' ? 'Your inbox is empty' : 'No sent messages'}</p>
                <button
                  onClick={() => { setMsgSubTab('compose'); loadEmployees() }}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  Compose a message →
                </button>
              </div>
            ) : (
              <div>
                {(msgSubTab === 'inbox' ? inbox : sent).map(msg => (
                  <MessageRow key={msg.id} msg={msg} fromInbox={msgSubTab === 'inbox'} />
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* ── Chat tab ─────────────────────────────────────────────────────────── */}
      {mainTab === 'chat' && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden"
             style={{ height: 'calc(100vh - 280px)', minHeight: 500 }}>
          <div className="flex h-full">

            {/* Left panel: conversation list */}
            <div className={cn(
              'flex flex-col border-r border-gray-100 dark:border-gray-800 transition-all',
              activeConvId ? 'hidden lg:flex lg:w-72 xl:w-80 flex-shrink-0' : 'flex w-full lg:w-72 xl:w-80 flex-shrink-0'
            )}>
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Conversations</h3>
                {chatSubTab === 'mine' && (
                  <button
                    onClick={() => { setShowNewChat(true); loadEmployees() }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  >
                    <PenSquare className="w-3.5 h-3.5" /> New Chat
                  </button>
                )}
              </div>

              {/* Sub-tab switcher — admin only */}
              {isAdmin && (
                <div className="flex border-b border-gray-100 dark:border-gray-800">
                  <button
                    onClick={() => { setChatSubTab('mine'); setActiveConvId(null) }}
                    className={cn(
                      'flex-1 py-2 text-xs font-medium transition-colors',
                      chatSubTab === 'mine'
                        ? 'text-blue-600 border-b-2 border-blue-500 bg-blue-50/50 dark:bg-blue-900/10'
                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    )}
                  >
                    My Conversations
                    {myConversations.filter(c => c.unreadCount > 0).length > 0 && (
                      <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-500 text-white text-[9px] font-bold">
                        {myConversations.filter(c => c.unreadCount > 0).length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => { setChatSubTab('others'); setActiveConvId(null) }}
                    className={cn(
                      'flex-1 py-2 text-xs font-medium transition-colors',
                      chatSubTab === 'others'
                        ? 'text-purple-600 border-b-2 border-purple-500 bg-purple-50/50 dark:bg-purple-900/10'
                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    )}
                  >
                    Other Conversations
                    {otherConversations.length > 0 && (
                      <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[9px] font-bold">
                        {otherConversations.length}
                      </span>
                    )}
                  </button>
                </div>
              )}

              {/* New chat form */}
              {showNewChat && (
                <div className="p-3 border-b border-gray-100 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">Start new chat</p>
                  <select
                    value={newChatUserId}
                    onChange={e => setNewChatUserId(e.target.value)}
                    className="w-full px-2.5 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                  >
                    <option value="">Select a person…</option>
                    {employees.filter(e => e.userAccountId !== user?.id).map(e => (
                      <option key={e.userAccountId} value={e.userAccountId}>{e.name}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={handleStartConversation}
                      disabled={startingConv || !newChatUserId}
                      className="flex-1 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {startingConv ? 'Starting…' : 'Start Chat'}
                    </button>
                    <button
                      onClick={() => { setShowNewChat(false); setNewChatUserId('') }}
                      className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* List */}
              {chatLoading ? (
                <div className="flex items-center justify-center flex-1"><Spinner /></div>
              ) : visibleConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 gap-3 text-gray-400 px-4">
                  <MessageCircle className="w-10 h-10 opacity-30" />
                  <p className="text-sm font-medium text-center">
                    {chatSubTab === 'others' ? 'No employee conversations yet' : 'No conversations yet'}
                  </p>
                  {chatSubTab === 'mine' && (
                    <button
                      onClick={() => { setShowNewChat(true); loadEmployees() }}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Start a chat →
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-y-auto flex-1">
                  {visibleConversations.map(conv => {
                    const isActive = conv.id === activeConvId
                    const name = getConvName(conv)
                    return (
                      <button
                        key={conv.id}
                        onClick={() => setActiveConvId(conv.id)}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-b border-gray-50 dark:border-gray-800/50 last:border-0',
                          isActive
                            ? chatSubTab === 'others'
                              ? 'bg-purple-50 dark:bg-purple-900/20 border-l-2 border-l-purple-500'
                              : 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-l-blue-500'
                            : ''
                        )}
                      >
                        <div className={cn(
                          'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0',
                          chatSubTab === 'others'
                            ? 'bg-gradient-to-br from-purple-400 to-pink-500'
                            : 'bg-gradient-to-br from-blue-400 to-purple-500'
                        )}>
                          <User className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-800 dark:text-white truncate">{name}</span>
                            <span className="text-[10px] text-gray-400 flex-shrink-0 ml-1">{timeAgo(conv.lastMessageAt)}</span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                            {conv.lastSenderName && `${conv.lastSenderName}: `}{conv.lastMessage || 'No messages yet'}
                          </p>
                        </div>
                        {conv.unreadCount > 0 && (
                          <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                            {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Right panel: message thread */}
            {activeConvId ? (
              <div className="flex flex-col flex-1 min-w-0">
                {/* Thread header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                  <button
                    onClick={() => setActiveConvId(null)}
                    className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                    <User className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">
                      {activeConv ? getConvName(activeConv) : '…'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {activeConv?.participants.length ?? 0} participant{(activeConv?.participants.length ?? 0) !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {msgLoading2 ? (
                    <div className="flex items-center justify-center h-full"><Spinner /></div>
                  ) : chatMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
                      <MessageCircle className="w-10 h-10 opacity-30" />
                      <p className="text-sm">No messages yet. Say hello!</p>
                    </div>
                  ) : (
                    chatMessages.map(msg => (
                      <div
                        key={msg.id}
                        className={cn('flex', msg.isOwn ? 'justify-end' : 'justify-start')}
                      >
                        {!msg.isOwn && (
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                            <User className="w-3 h-3 text-white" />
                          </div>
                        )}
                        <div className={cn('group max-w-[70%]')}>
                          {!msg.isOwn && (
                            <p className="text-[10px] text-gray-400 mb-1 ml-1">{msg.senderName}</p>
                          )}
                          <div className={cn(
                            'px-3 py-2 rounded-2xl text-sm',
                            msg.isOwn
                              ? 'bg-blue-600 text-white rounded-br-sm'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-sm',
                            msg.isDeleted ? 'opacity-50 italic' : ''
                          )}>
                            {msg.body}
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-[10px] text-gray-400">{formatDate(msg.createdAt)}</span>
                            {msg.isOwn && !msg.isDeleted && (
                              <button
                                onClick={() => handleDeleteChatMessage(msg.id)}
                                className="hidden group-hover:block text-[10px] text-red-400 hover:text-red-600 ml-1"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input — observer mode when admin is watching an employee conversation */}
                {isObserver ? (
                  <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1.5">
                      <Eye className="w-3.5 h-3.5" />
                      Monitoring — you are not a participant in this conversation
                    </p>
                  </div>
                ) : (
                  <div className="p-3 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChatMessage() } }}
                        placeholder="Type a message…"
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={handleSendChatMessage}
                        disabled={chatSending || !chatInput.trim()}
                        className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors flex-shrink-0"
                      >
                        {chatSending
                          ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          : <Send className="w-4 h-4" />
                        }
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden lg:flex flex-col items-center justify-center flex-1 gap-3 text-gray-400">
                <MessageCircle className="w-12 h-12 opacity-20" />
                <p className="text-sm font-medium">Select a conversation to start chatting</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
