import React, { useEffect, useState, useCallback } from 'react'
import {
  Plug, CheckCircle2, XCircle, ExternalLink, Settings2, Trash2,
  X, Eye, EyeOff, ChevronRight, Zap, Shield, RefreshCw,
} from 'lucide-react'
import { useAppSelector } from '@flowtap/store'
import { integrationsApi, IntegrationRecord, UpsertIntegrationData } from '@flowtap/api-core'
import toast from 'react-hot-toast'
import { cn } from '@flowtap/shared'

// ─── Integration catalogue (static metadata) ─────────────────────────────────

interface FieldDef {
  key: string
  label: string
  placeholder: string
  type?: 'text' | 'password' | 'url'
  hint?: string
}

interface IntegrationMeta {
  provider: string
  category: string
  displayName: string
  emoji: string
  tagline: string
  description: string
  docsUrl?: string
  fields: FieldDef[]
  webhookSupported?: boolean
  popular?: boolean
}

const CATALOGUE: IntegrationMeta[] = [
  // ── Payment Gateways ──────────────────────────────────────────────────────
  {
    provider: 'razorpay', category: 'Payment', displayName: 'Razorpay',
    emoji: '💳', tagline: 'Accept UPI, Cards & Wallets',
    description: 'Collect payments via UPI, Credit/Debit Cards, Net Banking and Wallets. Used by most Indian businesses.',
    docsUrl: 'https://razorpay.com/docs/',
    popular: true,
    fields: [
      { key: 'keyId',     label: 'Key ID',     placeholder: 'rzp_live_xxxxxxxxx', type: 'text' },
      { key: 'keySecret', label: 'Key Secret', placeholder: '••••••••••••••••',   type: 'password' },
    ],
    webhookSupported: true,
  },
  {
    provider: 'stripe', category: 'Payment', displayName: 'Stripe',
    emoji: '🔷', tagline: 'Global card payments',
    description: 'Accept credit/debit card payments globally. Best for US, UK, EU and international customers.',
    docsUrl: 'https://stripe.com/docs',
    popular: true,
    fields: [
      { key: 'publishableKey', label: 'Publishable Key', placeholder: 'pk_live_xxxxxxxxx', type: 'text' },
      { key: 'secretKey',      label: 'Secret Key',      placeholder: '••••••••••••••••',   type: 'password' },
    ],
    webhookSupported: true,
  },
  {
    provider: 'paypal', category: 'Payment', displayName: 'PayPal',
    emoji: '🅿️', tagline: 'Trusted global checkout',
    description: 'Accept PayPal balance, bank transfers and cards. Widely trusted by customers worldwide.',
    docsUrl: 'https://developer.paypal.com/',
    fields: [
      { key: 'clientId',     label: 'Client ID',     placeholder: 'AxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxB', type: 'text' },
      { key: 'clientSecret', label: 'Client Secret', placeholder: '••••••••••••••••', type: 'password' },
    ],
    webhookSupported: true,
  },
  {
    provider: 'paytm', category: 'Payment', displayName: 'Paytm',
    emoji: '📱', tagline: 'India\'s largest wallet',
    description: 'Accept payments via Paytm Wallet, UPI and Net Banking. Very popular in tier-2/3 Indian cities.',
    docsUrl: 'https://business.paytm.com/docs',
    fields: [
      { key: 'merchantId',  label: 'Merchant ID',  placeholder: 'Paytm merchant ID', type: 'text' },
      { key: 'merchantKey', label: 'Merchant Key', placeholder: '••••••••••••••••',   type: 'password' },
    ],
  },
  {
    provider: 'square', category: 'Payment', displayName: 'Square',
    emoji: '⬛', tagline: 'Point of sale & online',
    description: 'Hardware + software POS for card-present payments. Great for US retail stores.',
    docsUrl: 'https://developer.squareup.com/',
    fields: [
      { key: 'accessToken', label: 'Access Token', placeholder: 'sq0atp-xxxxxxxx', type: 'password' },
      { key: 'locationId',  label: 'Location ID',  placeholder: 'Square location ID', type: 'text' },
    ],
  },
  {
    provider: 'phonepe', category: 'Payment', displayName: 'PhonePe',
    emoji: '🟣', tagline: 'UPI & PhonePe payments',
    description: 'Collect payments via PhonePe app and UPI. Large user base in India.',
    fields: [
      { key: 'merchantId',  label: 'Merchant ID',  placeholder: 'PhonePe merchant ID', type: 'text' },
      { key: 'saltKey',     label: 'Salt Key',      placeholder: '••••••••••••••••',    type: 'password' },
      { key: 'saltIndex',   label: 'Salt Index',    placeholder: '1',                   type: 'text' },
    ],
  },

  // ── Accounting ────────────────────────────────────────────────────────────
  {
    provider: 'quickbooks', category: 'Accounting', displayName: 'QuickBooks',
    emoji: '📊', tagline: 'Sync sales to accounting',
    description: 'Automatically push sales, invoices and payment entries to QuickBooks Online. Eliminates manual bookkeeping.',
    docsUrl: 'https://developer.intuit.com/',
    popular: true,
    fields: [
      { key: 'clientId',     label: 'Client ID',     placeholder: 'QuickBooks client ID',     type: 'text' },
      { key: 'clientSecret', label: 'Client Secret', placeholder: '••••••••••••••••',          type: 'password' },
      { key: 'realmId',      label: 'Company (Realm) ID', placeholder: 'QuickBooks company ID', type: 'text' },
    ],
  },
  {
    provider: 'xero', category: 'Accounting', displayName: 'Xero',
    emoji: '🟦', tagline: 'Cloud accounting for SMBs',
    description: 'Sync invoices, payments and purchases to Xero. Popular in Australia, UK and NZ.',
    docsUrl: 'https://developer.xero.com/',
    fields: [
      { key: 'clientId',     label: 'Client ID',     placeholder: 'Xero app client ID', type: 'text' },
      { key: 'clientSecret', label: 'Client Secret', placeholder: '••••••••••••••••',   type: 'password' },
    ],
  },
  {
    provider: 'zohobooks', category: 'Accounting', displayName: 'Zoho Books',
    emoji: '📚', tagline: 'Smart accounting suite',
    description: 'Sync transactions to Zoho Books. Best choice for businesses already using Zoho CRM or Zoho suite.',
    docsUrl: 'https://www.zoho.com/books/api/v3/',
    fields: [
      { key: 'clientId',     label: 'Client ID',     placeholder: 'Zoho client ID',    type: 'text' },
      { key: 'clientSecret', label: 'Client Secret', placeholder: '••••••••••••••••',  type: 'password' },
      { key: 'orgId',        label: 'Organisation ID', placeholder: 'Zoho org ID',     type: 'text' },
    ],
  },
  {
    provider: 'tally', category: 'Accounting', displayName: 'Tally Prime',
    emoji: '🗃️', tagline: 'India\'s #1 accounting software',
    description: 'Export vouchers and ledger entries to Tally Prime via XML. Widely used by Indian businesses for GST compliance.',
    docsUrl: 'https://tallysolutions.com/',
    fields: [
      { key: 'serverUrl', label: 'Tally Server URL', placeholder: 'http://localhost:9000', type: 'url' },
      { key: 'company',   label: 'Company Name',     placeholder: 'As set in Tally',       type: 'text' },
    ],
  },

  // ── Communication ─────────────────────────────────────────────────────────
  {
    provider: 'twilio', category: 'Communication', displayName: 'Twilio SMS',
    emoji: '📞', tagline: 'SMS alerts & OTPs',
    description: 'Send SMS notifications for order confirmations, ticket updates and OTPs via Twilio.',
    docsUrl: 'https://www.twilio.com/docs',
    popular: true,
    fields: [
      { key: 'accountSid', label: 'Account SID', placeholder: 'ACxxxxxxxxxxxxxxxxxx', type: 'text' },
      { key: 'authToken',  label: 'Auth Token',  placeholder: '••••••••••••••••',     type: 'password' },
      { key: 'fromNumber', label: 'From Number', placeholder: '+1234567890',           type: 'text' },
    ],
  },
  {
    provider: 'whatsapp', category: 'Communication', displayName: 'WhatsApp Business',
    emoji: '💬', tagline: 'Send receipts & updates via WhatsApp',
    description: 'Send order receipts, repair status updates and appointment reminders to customers on WhatsApp.',
    docsUrl: 'https://developers.facebook.com/docs/whatsapp/',
    popular: true,
    fields: [
      { key: 'accessToken',    label: 'Access Token',     placeholder: 'Meta API access token', type: 'password' },
      { key: 'phoneNumberId',  label: 'Phone Number ID',  placeholder: 'WhatsApp phone number ID', type: 'text' },
      { key: 'businessId',     label: 'Business Account ID', placeholder: 'WABA ID', type: 'text' },
    ],
  },
  {
    provider: 'sendgrid', category: 'Communication', displayName: 'SendGrid Email',
    emoji: '✉️', tagline: 'Transactional & marketing emails',
    description: 'Send professional invoices, receipts and marketing emails via SendGrid\'s reliable email platform.',
    docsUrl: 'https://docs.sendgrid.com/',
    fields: [
      { key: 'apiKey',   label: 'API Key',   placeholder: 'SG.xxxxxxxxxx', type: 'password' },
      { key: 'fromEmail', label: 'From Email', placeholder: 'hello@yourbusiness.com', type: 'text' },
      { key: 'fromName',  label: 'From Name',  placeholder: 'Your Business Name', type: 'text' },
    ],
  },
  {
    provider: 'msg91', category: 'Communication', displayName: 'MSG91',
    emoji: '📬', tagline: 'India SMS & WhatsApp gateway',
    description: 'Send SMS and WhatsApp messages at India-competitive rates via MSG91.',
    docsUrl: 'https://docs.msg91.com/',
    fields: [
      { key: 'authKey',  label: 'Auth Key',  placeholder: 'MSG91 auth key', type: 'password' },
      { key: 'senderId', label: 'Sender ID', placeholder: 'FSTSMS',         type: 'text' },
    ],
  },

  // ── E-commerce ────────────────────────────────────────────────────────────
  {
    provider: 'shopify', category: 'Ecommerce', displayName: 'Shopify',
    emoji: '🛍️', tagline: 'Sync online store inventory',
    description: 'Sync product inventory, online orders and customers between Flowtap and your Shopify store.',
    docsUrl: 'https://shopify.dev/docs',
    popular: true,
    fields: [
      { key: 'shopDomain', label: 'Shop Domain',   placeholder: 'yourstore.myshopify.com', type: 'text' },
      { key: 'adminToken', label: 'Admin API Token', placeholder: 'shpat_xxxxxxxxxx', type: 'password' },
    ],
    webhookSupported: true,
  },
  {
    provider: 'woocommerce', category: 'Ecommerce', displayName: 'WooCommerce',
    emoji: '🛒', tagline: 'Sync WordPress shop',
    description: 'Connect your WooCommerce store to sync products, orders and inventory.',
    docsUrl: 'https://woocommerce.github.io/woocommerce-rest-api-docs/',
    fields: [
      { key: 'siteUrl',       label: 'Site URL',       placeholder: 'https://yourstore.com', type: 'url' },
      { key: 'consumerKey',   label: 'Consumer Key',   placeholder: 'ck_xxxxxxxxxx', type: 'text' },
      { key: 'consumerSecret', label: 'Consumer Secret', placeholder: 'cs_xxxxxxxxxx', type: 'password' },
    ],
    webhookSupported: true,
  },

  // ── Shipping ──────────────────────────────────────────────────────────────
  {
    provider: 'shiprocket', category: 'Shipping', displayName: 'Shiprocket',
    emoji: '🚀', tagline: 'India\'s #1 shipping aggregator',
    description: 'Book courier pickups, generate shipping labels and track deliveries via Shiprocket across 17,000+ pincodes.',
    docsUrl: 'https://apidocs.shiprocket.in/',
    popular: true,
    fields: [
      { key: 'email',    label: 'Email',    placeholder: 'Shiprocket account email', type: 'text' },
      { key: 'password', label: 'Password', placeholder: '••••••••', type: 'password' },
    ],
  },
  {
    provider: 'delhivery', category: 'Shipping', displayName: 'Delhivery',
    emoji: '📦', tagline: 'Express & surface shipping',
    description: 'Book shipments and track packages via Delhivery — one of India\'s largest logistics networks.',
    docsUrl: 'https://www.delhivery.com/docs/',
    fields: [
      { key: 'apiToken', label: 'API Token', placeholder: 'Delhivery API token', type: 'password' },
      { key: 'warehouseName', label: 'Pickup Warehouse Name', placeholder: 'Your warehouse name in Delhivery', type: 'text' },
    ],
  },
  {
    provider: 'fedex', category: 'Shipping', displayName: 'FedEx',
    emoji: '📫', tagline: 'Global express delivery',
    description: 'Generate FedEx shipping labels and track international shipments.',
    docsUrl: 'https://developer.fedex.com/',
    fields: [
      { key: 'apiKey',    label: 'API Key',    placeholder: 'FedEx API key',    type: 'text' },
      { key: 'secretKey', label: 'Secret Key', placeholder: '••••••••••••••••', type: 'password' },
      { key: 'accountNumber', label: 'Account Number', placeholder: 'FedEx account #', type: 'text' },
    ],
  },
]

const CATEGORIES = [
  { key: 'All',           label: 'All Integrations', emoji: '🔌' },
  { key: 'Payment',       label: 'Payment Gateways', emoji: '💳' },
  { key: 'Accounting',    label: 'Accounting',        emoji: '📊' },
  { key: 'Communication', label: 'Communication',     emoji: '💬' },
  { key: 'Ecommerce',     label: 'E-commerce',        emoji: '🛍️' },
  { key: 'Shipping',      label: 'Shipping',          emoji: '📦' },
]

// ─── Connect Modal ─────────────────────────────────────────────────────────────

const ConnectModal: React.FC<{
  meta: IntegrationMeta
  existing?: IntegrationRecord
  onClose: () => void
  onSave: (data: UpsertIntegrationData) => Promise<void>
}> = ({ meta, existing, onClose, onSave }) => {
  const initialConfig = existing?.configJson ? JSON.parse(existing.configJson) : {}
  const [fields, setFields] = useState<Record<string, string>>(
    meta.fields.reduce((acc, f) => ({ ...acc, [f.key]: initialConfig[f.key] ?? '' }), {})
  )
  const [webhook, setWebhook] = useState(existing?.webhookUrl ?? '')
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)

  const toggleShow = (key: string) =>
    setShowSecrets((p) => ({ ...p, [key]: !p[key] }))

  const handleSave = async () => {
    const missing = meta.fields.filter((f) => !fields[f.key]?.trim())
    if (missing.length > 0) {
      toast.error(`Please fill in: ${missing.map((f) => f.label).join(', ')}`)
      return
    }
    setLoading(true)
    try {
      await onSave({
        companyId: '', // filled by caller
        category: meta.category,
        provider: meta.provider,
        displayName: meta.displayName,
        configJson: JSON.stringify(fields),
        isEnabled: true,
        webhookUrl: webhook || null,
      })
      onClose()
    } catch {
      toast.error('Failed to save integration')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-100 dark:border-gray-700 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 flex items-center gap-3 p-5 border-b border-gray-100 dark:border-gray-700 rounded-t-2xl z-10">
          <span className="text-3xl">{meta.emoji}</span>
          <div className="flex-1">
            <h3 className="font-bold text-gray-900 dark:text-white">{meta.displayName}</h3>
            <p className="text-xs text-gray-500">{meta.tagline}</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Description */}
          <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-xl">
            {meta.description}
          </p>

          {/* Docs link */}
          {meta.docsUrl && (
            <a href={meta.docsUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline">
              <ExternalLink className="w-3.5 h-3.5" /> View documentation
            </a>
          )}

          {/* Credential fields */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">API Credentials</p>
            {meta.fields.map((field) => (
              <div key={field.key}>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  {field.label}
                </label>
                <div className="relative">
                  <input
                    type={field.type === 'password' && !showSecrets[field.key] ? 'password' : 'text'}
                    value={fields[field.key] ?? ''}
                    onChange={(e) => setFields((p) => ({ ...p, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2 pr-9 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {field.type === 'password' && (
                    <button
                      type="button"
                      onClick={() => toggleShow(field.key)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showSecrets[field.key]
                        ? <EyeOff className="w-4 h-4" />
                        : <Eye className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Webhook */}
          {meta.webhookSupported && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Webhook URL <span className="text-gray-400 font-normal">(optional — auto-generated)</span>
              </label>
              <input
                value={webhook}
                onChange={(e) => setWebhook(e.target.value)}
                placeholder="https://yourapi.com/webhooks/..."
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">
                Paste this URL in your {meta.displayName} dashboard to receive real-time events.
              </p>
            </div>
          )}

          {/* Security notice */}
          <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl p-3">
            <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Credentials are stored securely and encrypted at rest. Never share your API keys with anyone.
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-60"
          >
            {loading ? 'Connecting…' : existing ? 'Update Connection' : `Connect ${meta.displayName}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Integration Card ─────────────────────────────────────────────────────────

const IntegrationCard: React.FC<{
  meta: IntegrationMeta
  record?: IntegrationRecord
  onConnect: () => void
  onDisconnect: () => void
}> = ({ meta, record, onConnect, onDisconnect }) => {
  const connected = record?.isEnabled ?? false
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)

  return (
    <div className={cn(
      'bg-white dark:bg-gray-900 border rounded-2xl p-5 flex flex-col gap-4 transition-all',
      connected
        ? 'border-green-200 dark:border-green-800 shadow-sm shadow-green-50 dark:shadow-none'
        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
    )}>
      {/* Top row */}
      <div className="flex items-start gap-3">
        <div className="text-3xl leading-none">{meta.emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 dark:text-white text-sm">{meta.displayName}</span>
            {meta.popular && (
              <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full font-medium">
                Popular
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{meta.tagline}</p>
        </div>

        {/* Status badge */}
        {connected ? (
          <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full flex-shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" /> Connected
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-gray-400 font-medium bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded-full flex-shrink-0">
            <XCircle className="w-3.5 h-3.5" /> Not connected
          </span>
        )}
      </div>

      {/* Description */}
      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">
        {meta.description}
      </p>

      {/* Connected at info */}
      {connected && record?.connectedAt && (
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Connected {new Date(record.connectedAt).toLocaleDateString()}</span>
          {record.lastStatusMessage && (
            <span className="text-gray-300">· {record.lastStatusMessage}</span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-auto">
        {connected ? (
          <>
            <button
              onClick={onConnect}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
            >
              <Settings2 className="w-4 h-4" /> Configure
            </button>
            {confirmDisconnect ? (
              <div className="flex gap-1">
                <button
                  onClick={() => { onDisconnect(); setConfirmDisconnect(false) }}
                  className="px-3 py-2 text-xs bg-red-600 text-white rounded-xl hover:bg-red-700 font-medium transition-colors"
                >Disconnect</button>
                <button
                  onClick={() => setConfirmDisconnect(false)}
                  className="px-3 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >Cancel</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDisconnect(true)}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl border border-gray-200 dark:border-gray-700 transition-colors"
                title="Disconnect"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </>
        ) : (
          <button
            onClick={onConnect}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors font-semibold"
          >
            <Plug className="w-4 h-4" /> Connect <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export const IntegrationsPage: React.FC = () => {
  const tenant = useAppSelector((s) => s.tenant.tenant)
  const [records, setRecords] = useState<IntegrationRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [activeCategory, setActiveCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<IntegrationMeta | null>(null)

  const load = useCallback(async () => {
    if (!tenant?.id) return
    setLoading(true)
    try {
      const res = await integrationsApi.getIntegrations(tenant.id)
      const data: IntegrationRecord[] = res.data?.data ?? []
      setRecords(data)
    } catch {
      // Not fatal — records just stays empty; all cards show "Not connected"
    } finally {
      setLoading(false)
    }
  }, [tenant?.id])

  useEffect(() => { load() }, [load])

  const getRecord = (provider: string) =>
    records.find((r) => r.provider === provider && r.isEnabled)

  const handleSave = async (data: UpsertIntegrationData) => {
    if (!tenant?.id) return
    await integrationsApi.upsertIntegration({ ...data, companyId: tenant.id })
    toast.success(`${data.displayName} connected successfully`)
    load()
  }

  const handleDisconnect = async (record: IntegrationRecord) => {
    try {
      await integrationsApi.disconnect(record.id, tenant!.id)
      toast.success('Integration disconnected')
      load()
    } catch {
      toast.error('Failed to disconnect')
    }
  }

  // Filter catalogue
  const filtered = CATALOGUE.filter((m) => {
    const matchCat = activeCategory === 'All' || m.category === activeCategory
    const matchSearch = !search || m.displayName.toLowerCase().includes(search.toLowerCase()) || m.tagline.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  // Summary counts
  const connectedCount = records.filter((r) => r.isEnabled).length
  const totalCount = CATALOGUE.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
            <Plug className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Integrations</h1>
            <p className="text-sm text-gray-500">
              Connect Flowtap with your favourite tools — {connectedCount} of {totalCount} connected
            </p>
          </div>
        </div>
        {connectedCount > 0 && (
          <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-full font-medium">
            <Zap className="w-4 h-4" />
            {connectedCount} active {connectedCount === 1 ? 'integration' : 'integrations'}
          </div>
        )}
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search integrations…"
        className="w-full max-w-sm px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
      />

      {/* Category tabs */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map((cat) => {
          const count = cat.key === 'All'
            ? CATALOGUE.length
            : CATALOGUE.filter((m) => m.category === cat.key).length
          const connectedInCat = cat.key === 'All'
            ? connectedCount
            : records.filter((r) => r.isEnabled && CATALOGUE.find((m) => m.provider === r.provider)?.category === cat.key).length

          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors border',
                activeCategory === cat.key
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              )}
            >
              <span>{cat.emoji}</span>
              <span>{cat.label}</span>
              <span className={cn(
                'text-xs px-1.5 py-0.5 rounded-full font-semibold',
                activeCategory === cat.key
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
              )}>
                {connectedInCat > 0 ? `${connectedInCat}/${count}` : count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Plug className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No integrations found</p>
          <p className="text-sm">Try a different search or category</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((meta) => {
            const record = getRecord(meta.provider)
            return (
              <IntegrationCard
                key={meta.provider}
                meta={meta}
                record={record}
                onConnect={() => setModal(meta)}
                onDisconnect={() => record && handleDisconnect(record)}
              />
            )
          })}
        </div>
      )}

      {/* Connect Modal */}
      {modal && (
        <ConnectModal
          meta={modal}
          existing={records.find((r) => r.provider === modal.provider)}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
