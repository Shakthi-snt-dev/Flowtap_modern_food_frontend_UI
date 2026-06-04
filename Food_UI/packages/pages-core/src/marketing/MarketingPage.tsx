import React, { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  Megaphone, Tag, Zap, Plus, Edit2, Trash2,
  ToggleLeft, ToggleRight, Percent, Calendar,
  RefreshCw, Play, Pause, Square,
} from 'lucide-react'
import { useAppSelector } from '@flowtap/store'
import { campaignsApi } from '@flowtap/api-core'
import { tenantApi } from '@flowtap/api-core'
import { Badge, Button, Spinner } from '@flowtap/ui-core'
import { cn } from '@flowtap/shared'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MarketingCampaign {
  id: string
  title: string
  message: string
  discountPercentage: number
  isActive: boolean
  targetLocationIds: string[]
  createdAt: string
}

interface Offer {
  id: string
  promoCode: string
  discountPercent: number
  minOrderValue: number
  usageLimit: number
  usageCount: number
  validFrom: string
  validTo: string
  isActive: boolean
}

interface DiscountCampaign {
  id: string
  name: string
  type: string
  discountValue: number
  discountType: string
  startDate: string
  endDate: string
  status: string
}

interface Store { id: string; name: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const CAMPAIGN_TYPE_COLORS: Record<string, string> = {
  Discount:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  Bundle:    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  FlashSale: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  BOGO:      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'default' | 'danger'> = {
  Active:    'success',
  Scheduled: 'warning',
  Paused:    'default',
  Ended:     'danger',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export const MarketingPage: React.FC<{ initialTab?: string }> = ({ initialTab }) => {
  const tenant = useAppSelector(s => s.tenant.tenant)
  const [tab, setTab] = useState<'campaigns' | 'offers' | 'discount'>(
    (initialTab as any) ?? 'campaigns'
  )

  // Campaigns state
  const [campaigns, setCampaigns]           = useState<MarketingCampaign[]>([])
  const [campaignsLoading, setCampaignsLoading] = useState(false)
  const [campaignModal, setCampaignModal]   = useState(false)
  const [editCampaign, setEditCampaign]     = useState<MarketingCampaign | null>(null)

  // Offers state
  const [offers, setOffers]                 = useState<Offer[]>([])
  const [offersLoading, setOffersLoading]   = useState(false)
  const [offerModal, setOfferModal]         = useState(false)
  const [editOffer, setEditOffer]           = useState<Offer | null>(null)

  // Discount campaigns state
  const [discounts, setDiscounts]           = useState<DiscountCampaign[]>([])
  const [discountsLoading, setDiscountsLoading] = useState(false)
  const [discountModal, setDiscountModal]   = useState(false)

  // Stores for targeting
  const [stores, setStores]                 = useState<Store[]>([])

  useEffect(() => {
    if (!tenant?.id) return
    tenantApi.getStores(tenant.id).then(res => {
      const raw = res.data?.data ?? []
      setStores(raw.map((s: any) => ({ id: String(s.id), name: String(s.title ?? s.name ?? '') })))
    }).catch(() => {})
  }, [tenant?.id])

  // ── Load functions ──────────────────────────────────────────────────────────

  const loadCampaigns = useCallback(async () => {
    if (!tenant?.id) return
    setCampaignsLoading(true)
    try {
      const res = await campaignsApi.getMarketingCampaigns({ companyId: tenant.id })
      const items = res.data?.data ?? []
      setCampaigns(items.map((c: any) => ({
        id:                  String(c.id),
        title:               String(c.title ?? ''),
        message:             String(c.message ?? ''),
        discountPercentage:  Number(c.discountPercentage ?? 0),
        isActive:            Boolean(c.isActive),
        targetLocationIds:   Array.isArray(c.targetLocationIds) ? c.targetLocationIds.map(String) : [],
        createdAt:           String(c.createdAt ?? ''),
      })))
    } catch { toast.error('Failed to load campaigns') }
    finally { setCampaignsLoading(false) }
  }, [tenant?.id])

  const loadOffers = useCallback(async () => {
    if (!tenant?.id) return
    setOffersLoading(true)
    try {
      const res = await campaignsApi.getOffers({ companyId: tenant.id })
      const items = res.data?.data ?? []
      setOffers(items.map((o: any) => ({
        id:              String(o.id),
        promoCode:       String(o.promoCode ?? ''),
        discountPercent: Number(o.discountPercent ?? 0),
        minOrderValue:   Number(o.minOrderValue ?? 0),
        usageLimit:      Number(o.usageLimit ?? 0),
        usageCount:      Number(o.usageCount ?? 0),
        validFrom:       String(o.validFrom ?? ''),
        validTo:         String(o.validTo ?? ''),
        isActive:        Boolean(o.isActive),
      })))
    } catch { toast.error('Failed to load promo codes') }
    finally { setOffersLoading(false) }
  }, [tenant?.id])

  const loadDiscounts = useCallback(async () => {
    if (!tenant?.id) return
    setDiscountsLoading(true)
    try {
      const res = await campaignsApi.getDiscountCampaigns({ companyId: tenant.id })
      const items = res.data?.data ?? []
      setDiscounts(items.map((c: any) => ({
        id:           String(c.id),
        name:         String(c.name ?? ''),
        type:         String(c.type ?? ''),
        discountValue: Number(c.discountValue ?? 0),
        discountType: String(c.discountType ?? 'Percent'),
        startDate:    String(c.startDate ?? ''),
        endDate:      String(c.endDate ?? ''),
        status:       String(c.status ?? ''),
      })))
    } catch { toast.error('Failed to load discount programs') }
    finally { setDiscountsLoading(false) }
  }, [tenant?.id])

  useEffect(() => {
    if (tab === 'campaigns') loadCampaigns()
    if (tab === 'offers')    loadOffers()
    if (tab === 'discount')  loadDiscounts()
  }, [tab, loadCampaigns, loadOffers, loadDiscounts])

  // ── Campaign actions ────────────────────────────────────────────────────────

  const handleDeleteCampaign = async (id: string) => {
    if (!confirm('Delete this campaign?')) return
    try {
      await campaignsApi.deleteMarketingCampaign(id)
      toast.success('Campaign deleted')
      loadCampaigns()
    } catch { toast.error('Failed to delete campaign') }
  }

  const handleToggleCampaign = async (c: MarketingCampaign) => {
    try {
      await campaignsApi.updateMarketingCampaign(c.id, { isActive: !c.isActive })
      toast.success(c.isActive ? 'Campaign paused' : 'Campaign activated')
      loadCampaigns()
    } catch { toast.error('Failed to update campaign') }
  }

  // ── Offer actions ───────────────────────────────────────────────────────────

  const handleDeleteOffer = async (id: string) => {
    if (!confirm('Delete this promo code?')) return
    try {
      await campaignsApi.deleteOffer(id)
      toast.success('Promo code deleted')
      loadOffers()
    } catch { toast.error('Failed to delete offer') }
  }

  const handleToggleOffer = async (o: Offer) => {
    try {
      await campaignsApi.updateOffer(o.id, { isActive: !o.isActive })
      toast.success(o.isActive ? 'Promo code deactivated' : 'Promo code activated')
      loadOffers()
    } catch { toast.error('Failed to update offer') }
  }

  // ── Discount campaign actions ───────────────────────────────────────────────

  const handleDiscountStatus = async (id: string, status: string) => {
    try {
      await campaignsApi.updateDiscountCampaign(id, { status })
      toast.success(`Campaign ${status.toLowerCase()}`)
      loadDiscounts()
    } catch { toast.error('Failed to update campaign') }
  }

  const handleDeleteDiscount = async (id: string) => {
    if (!confirm('Delete this discount program?')) return
    try {
      await campaignsApi.deleteDiscountCampaign(id)
      toast.success('Campaign deleted')
      loadDiscounts()
    } catch { toast.error('Failed to delete campaign') }
  }

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Marketing</h1>
        <p className="text-sm text-gray-500 mt-0.5">Campaigns, promo codes, and discount programs</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
        {([
          ['campaigns', 'Campaigns',        <Megaphone className="w-4 h-4" />],
          ['offers',    'Promo Codes',       <Tag       className="w-4 h-4" />],
          ['discount',  'Discount Programs', <Zap       className="w-4 h-4" />],
        ] as const).map(([id, label, icon]) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === id
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            )}>
            {icon}{label}
          </button>
        ))}
      </div>

      {/* ── Marketing Campaigns Tab ─────────────────────────────────────────── */}
      {tab === 'campaigns' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}</p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" icon={<RefreshCw className="w-4 h-4" />} onClick={loadCampaigns} />
              <Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => { setEditCampaign(null); setCampaignModal(true) }}>
                New Campaign
              </Button>
            </div>
          </div>

          {campaignsLoading ? (
            <div className="flex justify-center py-20"><Spinner size="lg" /></div>
          ) : campaigns.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-gray-400 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
              <Megaphone className="w-12 h-12 opacity-30" />
              <p className="font-medium">No campaigns yet</p>
              <Button size="sm" onClick={() => { setEditCampaign(null); setCampaignModal(true) }}>Create your first campaign</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {campaigns.map(c => (
                <div key={c.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate">{c.title}</h3>
                      {c.discountPercentage > 0 && (
                        <div className="flex items-center gap-1 mt-0.5 text-blue-600 dark:text-blue-400 text-sm font-bold">
                          <Percent className="w-3.5 h-3.5" />{c.discountPercentage}% discount
                        </div>
                      )}
                    </div>
                    <Badge variant={c.isActive ? 'success' : 'default'} size="sm">
                      {c.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>

                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{c.message}</p>

                  {c.targetLocationIds.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {c.targetLocationIds.map(lid => {
                        const store = stores.find(s => s.id === lid)
                        return store ? (
                          <span key={lid} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs rounded-md">
                            {store.name}
                          </span>
                        ) : null
                      })}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
                    <button
                      onClick={() => handleToggleCampaign(c)}
                      className={cn(
                        'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors',
                        c.isActive
                          ? 'text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20'
                          : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                      )}
                    >
                      {c.isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      {c.isActive ? 'Pause' : 'Activate'}
                    </button>
                    <button
                      onClick={() => { setEditCampaign(c); setCampaignModal(true) }}
                      className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />Edit
                    </button>
                    <button
                      onClick={() => handleDeleteCampaign(c.id)}
                      className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors ml-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Promo Codes Tab ─────────────────────────────────────────────────── */}
      {tab === 'offers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{offers.length} promo code{offers.length !== 1 ? 's' : ''}</p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" icon={<RefreshCw className="w-4 h-4" />} onClick={loadOffers} />
              <Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => { setEditOffer(null); setOfferModal(true) }}>
                New Promo Code
              </Button>
            </div>
          </div>

          {offersLoading ? (
            <div className="flex justify-center py-20"><Spinner size="lg" /></div>
          ) : offers.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-gray-400 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
              <Tag className="w-12 h-12 opacity-30" />
              <p className="font-medium">No promo codes yet</p>
              <Button size="sm" onClick={() => { setEditOffer(null); setOfferModal(true) }}>Create your first promo code</Button>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                      <th className="px-4 py-3 text-left font-medium">Code</th>
                      <th className="px-4 py-3 text-left font-medium">Discount</th>
                      <th className="px-4 py-3 text-left font-medium">Min Order</th>
                      <th className="px-4 py-3 text-left font-medium">Usage</th>
                      <th className="px-4 py-3 text-left font-medium">Valid Until</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {offers.map(o => (
                      <tr key={o.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-md text-xs">
                            {o.promoCode}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">{o.discountPercent}%</td>
                        <td className="px-4 py-3 text-gray-500">{o.minOrderValue > 0 ? `Min ${o.minOrderValue}` : '—'}</td>
                        <td className="px-4 py-3 text-gray-500">
                          {o.usageLimit > 0 ? `${o.usageCount} / ${o.usageLimit}` : `${o.usageCount} / ∞`}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(o.validTo)}</td>
                        <td className="px-4 py-3">
                          <Badge variant={o.isActive ? 'success' : 'default'} size="sm">
                            {o.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => handleToggleOffer(o)}
                              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
                              title={o.isActive ? 'Deactivate' : 'Activate'}>
                              {o.isActive ? <ToggleRight className="w-4 h-4 text-green-500" /> : <ToggleLeft className="w-4 h-4" />}
                            </button>
                            <button onClick={() => { setEditOffer(o); setOfferModal(true) }}
                              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDeleteOffer(o.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Discount Programs Tab ───────────────────────────────────────────── */}
      {tab === 'discount' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{discounts.length} program{discounts.length !== 1 ? 's' : ''}</p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" icon={<RefreshCw className="w-4 h-4" />} onClick={loadDiscounts} />
              <Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setDiscountModal(true)}>
                New Program
              </Button>
            </div>
          </div>

          {discountsLoading ? (
            <div className="flex justify-center py-20"><Spinner size="lg" /></div>
          ) : discounts.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-gray-400 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
              <Zap className="w-12 h-12 opacity-30" />
              <p className="font-medium">No discount programs yet</p>
              <Button size="sm" onClick={() => setDiscountModal(true)}>Create your first program</Button>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                      <th className="px-4 py-3 text-left font-medium">Name</th>
                      <th className="px-4 py-3 text-left font-medium">Type</th>
                      <th className="px-4 py-3 text-left font-medium">Discount</th>
                      <th className="px-4 py-3 text-left font-medium">Period</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {discounts.map(d => (
                      <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{d.name}</td>
                        <td className="px-4 py-3">
                          <span className={cn('px-2 py-1 text-xs font-semibold rounded-md', CAMPAIGN_TYPE_COLORS[d.type] ?? 'bg-gray-100 text-gray-700')}>
                            {d.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">
                          {d.discountValue > 0 ? `${d.discountValue}${d.discountType === 'Percent' ? '%' : ' off'}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {fmtDate(d.startDate)} → {fmtDate(d.endDate)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={STATUS_VARIANT[d.status] ?? 'default'} size="sm">{d.status}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            {d.status !== 'Active' && d.status !== 'Ended' && (
                              <button onClick={() => handleDiscountStatus(d.id, 'Active')}
                                className="p-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 transition-colors" title="Activate">
                                <Play className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {d.status === 'Active' && (
                              <button onClick={() => handleDiscountStatus(d.id, 'Paused')}
                                className="p-1.5 rounded-lg hover:bg-yellow-50 dark:hover:bg-yellow-900/20 text-yellow-600 transition-colors" title="Pause">
                                <Pause className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {d.status !== 'Ended' && (
                              <button onClick={() => handleDiscountStatus(d.id, 'Ended')}
                                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors" title="End">
                                <Square className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button onClick={() => handleDeleteDiscount(d.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {campaignModal && (
        <CampaignModal
          campaign={editCampaign}
          stores={stores}
          tenantId={tenant?.id ?? ''}
          onClose={() => setCampaignModal(false)}
          onSaved={() => { setCampaignModal(false); loadCampaigns() }}
        />
      )}

      {offerModal && (
        <OfferModal
          offer={editOffer}
          tenantId={tenant?.id ?? ''}
          onClose={() => setOfferModal(false)}
          onSaved={() => { setOfferModal(false); loadOffers() }}
        />
      )}

      {discountModal && (
        <DiscountCampaignModal
          tenantId={tenant?.id ?? ''}
          onClose={() => setDiscountModal(false)}
          onSaved={() => { setDiscountModal(false); loadDiscounts() }}
        />
      )}
    </div>
  )
}

// ─── Campaign Modal ────────────────────────────────────────────────────────────

interface CampaignModalProps {
  campaign: MarketingCampaign | null
  stores: Store[]
  tenantId: string
  onClose: () => void
  onSaved: () => void
}

const CampaignModal: React.FC<CampaignModalProps> = ({ campaign, stores, tenantId, onClose, onSaved }) => {
  const [title, setTitle]         = useState(campaign?.title ?? '')
  const [message, setMessage]     = useState(campaign?.message ?? '')
  const [discount, setDiscount]   = useState(String(campaign?.discountPercentage ?? ''))
  const [targets, setTargets]     = useState<string[]>(campaign?.targetLocationIds ?? [])
  const [saving, setSaving]       = useState(false)

  const toggleStore = (id: string) =>
    setTargets(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Title is required'); return }
    if (!message.trim()) { toast.error('Message is required'); return }
    setSaving(true)
    try {
      const payload = {
        title,
        message,
        discountPercentage: discount ? Number(discount) : undefined,
        targetLocationIds: targets.length > 0 ? targets : undefined,
      }
      if (campaign) {
        await campaignsApi.updateMarketingCampaign(campaign.id, payload)
        toast.success('Campaign updated')
      } else {
        await campaignsApi.createMarketingCampaign({ companyId: tenantId, ...payload })
        toast.success('Campaign created')
      }
      onSaved()
    } catch { toast.error('Failed to save campaign') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-lg space-y-5 p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          {campaign ? 'Edit Campaign' : 'New Campaign'}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Title *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Summer Sale 2025" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Message *</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Describe the campaign to your customers..." />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Discount % (optional)</label>
            <input type="number" min="0" max="100" value={discount} onChange={e => setDiscount(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0" />
          </div>

          {stores.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Target Stores (blank = all)</label>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {stores.map(s => (
                  <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={targets.includes(s.id)} onChange={() => toggleStore(s.id)}
                      className="rounded text-blue-600" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{s.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : campaign ? 'Update' : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Offer Modal ───────────────────────────────────────────────────────────────

interface OfferModalProps {
  offer: Offer | null
  tenantId: string
  onClose: () => void
  onSaved: () => void
}

const OfferModal: React.FC<OfferModalProps> = ({ offer, tenantId, onClose, onSaved }) => {
  const [code, setCode]           = useState(offer?.promoCode ?? '')
  const [discount, setDiscount]   = useState(String(offer?.discountPercent ?? ''))
  const [minOrder, setMinOrder]   = useState(String(offer?.minOrderValue ?? ''))
  const [limit, setLimit]         = useState(String(offer?.usageLimit ?? ''))
  const [validFrom, setValidFrom] = useState(offer?.validFrom ? offer.validFrom.slice(0, 10) : '')
  const [validTo, setValidTo]     = useState(offer?.validTo ? offer.validTo.slice(0, 10) : '')
  const [saving, setSaving]       = useState(false)

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    setCode(Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''))
  }

  const handleSave = async () => {
    if (!code.trim()) { toast.error('Promo code is required'); return }
    if (!discount) { toast.error('Discount % is required'); return }
    if (!validFrom || !validTo) { toast.error('Valid from/to dates are required'); return }

    setSaving(true)
    try {
      const payload = {
        promoCode: code.toUpperCase(),
        discountPercent: Number(discount),
        minOrderValue: minOrder ? Number(minOrder) : undefined,
        usageLimit: limit ? Number(limit) : undefined,
        validFrom: new Date(validFrom).toISOString(),
        validTo: new Date(validTo).toISOString(),
      }
      if (offer) {
        await campaignsApi.updateOffer(offer.id, payload)
        toast.success('Promo code updated')
      } else {
        await campaignsApi.createOffer({ companyId: tenantId, ...payload })
        toast.success('Promo code created')
      }
      onSaved()
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to save promo code')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md space-y-5 p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          {offer ? 'Edit Promo Code' : 'New Promo Code'}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Promo Code *</label>
            <div className="flex gap-2">
              <input type="text" value={code} onChange={e => setCode(e.target.value.toUpperCase())}
                className="flex-1 px-3 py-2.5 text-sm font-mono uppercase border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="SAVE20" />
              <Button variant="ghost" size="sm" onClick={generateCode}>Generate</Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Discount % *</label>
              <input type="number" min="0" max="100" value={discount} onChange={e => setDiscount(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="20" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Min Order</label>
              <input type="number" min="0" value={minOrder} onChange={e => setMinOrder(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0 (no min)" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Usage Limit (blank = unlimited)</label>
            <input type="number" min="0" value={limit} onChange={e => setLimit(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Unlimited" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Valid From *</label>
              <input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Valid To *</label>
              <input type="date" value={validTo} onChange={e => setValidTo(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : offer ? 'Update' : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Discount Campaign Modal ───────────────────────────────────────────────────

interface DiscountCampaignModalProps {
  tenantId: string
  onClose: () => void
  onSaved: () => void
}

const DiscountCampaignModal: React.FC<DiscountCampaignModalProps> = ({ tenantId, onClose, onSaved }) => {
  const [name, setName]           = useState('')
  const [type, setType]           = useState('Discount')
  const [discountVal, setDiscountVal] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate]     = useState('')
  const [saving, setSaving]       = useState(false)

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Name is required'); return }
    if (!startDate || !endDate) { toast.error('Start and end dates are required'); return }
    setSaving(true)
    try {
      await campaignsApi.createDiscountCampaign({
        companyId: tenantId,
        name,
        type,
        discountType: 'Percent',
        discountValue: discountVal ? Number(discountVal) : 0,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
      })
      toast.success('Discount program created')
      onSaved()
    } catch { toast.error('Failed to create program') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md space-y-5 p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">New Discount Program</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Name *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Flash Sale Weekend" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {['Discount', 'Bundle', 'FlashSale', 'BOGO'].map(t => (
                <button key={t} onClick={() => setType(t)}
                  className={cn(
                    'px-3 py-2 rounded-lg text-sm font-medium border transition-all',
                    type === t
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                  )}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {(type === 'Discount' || type === 'FlashSale') && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Discount %</label>
              <input type="number" min="0" max="100" value={discountVal} onChange={e => setDiscountVal(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="30" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Start Date *</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">End Date *</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Create Program'}
          </Button>
        </div>
      </div>
    </div>
  )
}
