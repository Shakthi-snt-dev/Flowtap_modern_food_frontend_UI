import React, { useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import {
  // Shared UI
  Store, Check, ArrowRight, ArrowLeft,
  // Repair logo + type icons
  Wrench, Smartphone, Laptop, Car, Cpu, Watch, Gamepad2, Tv, Printer,
  // Food logo + type icons
  UtensilsCrossed, Wheat, Coffee, Sparkles, Truck,
  // Hotel logo + type icons
  Building2, Building, Home, Sun, Users,
  // Medical logo + type icons
  Stethoscope, Heart, Package, Smile, Eye, Activity,
  // Jewellery logo + type icons
  Gem, Star, Layers, ShoppingBag, Crown,
} from 'lucide-react'
import { tenantApi } from '@flowtap/api-core'
import { employeesApi } from '@flowtap/api-core'
import { taxApi } from '@flowtap/api-core'
import { authApi } from '@flowtap/api-core'
import { useAppDispatch } from '@flowtap/store'
import { setTenant, setStores, setCurrentStore } from '@flowtap/store'
import toast from 'react-hot-toast'

// ─── Industry config types ─────────────────────────────────────────────────────

interface BusinessTypeOption {
  id: string
  label: string
  description: string
  icon: React.ReactNode
}

interface IndustryConfig {
  industryId: number
  industryType: string
  logoIcon: React.ReactNode
  title: string
  subtitle: string
  shopNameLabel: string
  shopNamePlaceholder: string
  subdomainPlaceholder: string
  step1Title: string
  step1Description: string
  completionText: string
  completionSeedEmoji: string
  businessTypes: BusinessTypeOption[]
  multiSelect: boolean
}

// ─── Industry configs ──────────────────────────────────────────────────────────

const REPAIR_CONFIG: IndustryConfig = {
  industryId: 2,
  industryType: 'RepairShop',
  logoIcon: <Wrench className="w-6 h-6 text-white" />,
  title: 'Set up your repair shop',
  subtitle: 'Get started in under 2 minutes',
  shopNameLabel: 'Shop Name',
  shopNamePlaceholder: 'e.g. FixIt Mobile Repairs',
  subdomainPlaceholder: 'fixitmobile',
  step1Title: 'What do you repair?',
  step1Description: 'Select one or more device types — we\'ll pre-load the right brands, models and service categories for each.',
  completionText: 'Your repair shop workspace is ready.',
  completionSeedEmoji: '📱',
  multiSelect: true,
  businessTypes: [
    { id: 'mobile',      label: 'Mobile & Smartphones',   description: 'iPhone, Samsung, OnePlus, Xiaomi',              icon: <Smartphone className="w-6 h-6" /> },
    { id: 'laptop',      label: 'Laptop & Computers',     description: 'Laptops, desktops, MacBook, iMac',              icon: <Laptop     className="w-6 h-6" /> },
    { id: 'electronics', label: 'Electronics General',    description: 'TVs, speakers, appliances, mixed',              icon: <Cpu        className="w-6 h-6" /> },
    { id: 'automobile',  label: 'Car & Automobile',       description: 'Auto body, engine, electrical systems',         icon: <Car        className="w-6 h-6" /> },
    { id: 'smartwatch',  label: 'Smartwatch & Wearables', description: 'Apple Watch, Galaxy Watch, fitness bands',      icon: <Watch      className="w-6 h-6" /> },
    { id: 'gaming',      label: 'Console & Gaming',       description: 'PS4/5, Xbox, Nintendo Switch',                  icon: <Gamepad2   className="w-6 h-6" /> },
    { id: 'tv',          label: 'TV & Displays',          description: 'LED/OLED TVs, monitors, projectors',            icon: <Tv         className="w-6 h-6" /> },
    { id: 'printer',     label: 'Printers & Peripherals', description: 'Inkjet, laser, scanners, copiers',              icon: <Printer    className="w-6 h-6" /> },
  ],
}

const FOOD_CONFIG: IndustryConfig = {
  industryId: 5,
  industryType: 'Food',
  logoIcon: <UtensilsCrossed className="w-6 h-6 text-white" />,
  title: 'Set up your food business',
  subtitle: 'Get started in under 2 minutes',
  shopNameLabel: 'Business Name',
  shopNamePlaceholder: 'e.g. The Daily Grind Café',
  subdomainPlaceholder: 'dailygrind',
  step1Title: 'What kind of food business?',
  step1Description: 'Select your business type — we\'ll pre-load menu categories, recipe templates and kitchen workflows.',
  completionText: 'Your food business workspace is ready.',
  completionSeedEmoji: '🍽️',
  multiSelect: true,
  businessTypes: [
    { id: 'restaurant',   label: 'Restaurant',          description: 'Dine-in, takeaway, fine dining',             icon: <UtensilsCrossed className="w-6 h-6" /> },
    { id: 'bakery',       label: 'Bakery',              description: 'Breads, cakes, pastries, baked goods',       icon: <Wheat           className="w-6 h-6" /> },
    { id: 'cafe',         label: 'Café & Coffee Shop',  description: 'Coffee, beverages, light meals, seating',    icon: <Coffee          className="w-6 h-6" /> },
    { id: 'icecream',     label: 'Ice Cream Shop',      description: 'Scoops, cones, sundaes, desserts',           icon: <Sparkles        className="w-6 h-6" /> },
    { id: 'cloudkitchen', label: 'Cloud Kitchen',       description: 'Delivery-only, no dine-in, packaging focus', icon: <Truck           className="w-6 h-6" /> },
  ],
}

const HOTEL_CONFIG: IndustryConfig = {
  industryId: 3,
  industryType: 'Hotel',
  logoIcon: <Building2 className="w-6 h-6 text-white" />,
  title: 'Set up your hotel',
  subtitle: 'Get started in under 2 minutes',
  shopNameLabel: 'Property Name',
  shopNamePlaceholder: 'e.g. The Grand Palace Hotel',
  subdomainPlaceholder: 'grandpalace',
  step1Title: 'What type of accommodation?',
  step1Description: 'Select your property type — we\'ll set up the right room categories, amenities and booking workflows.',
  completionText: 'Your hotel workspace is ready.',
  completionSeedEmoji: '🏨',
  multiSelect: false,
  businessTypes: [
    { id: 'hotel',      label: 'Hotel',               description: 'City hotel, business hotel, full-service',    icon: <Building2 className="w-6 h-6" /> },
    { id: 'motel',      label: 'Motel / Inn',          description: 'Road-side motel, budget inn, roadhouse',      icon: <Building  className="w-6 h-6" /> },
    { id: 'guesthouse', label: 'Guesthouse / B&B',     description: 'Bed & breakfast, guesthouse, homestay',       icon: <Home      className="w-6 h-6" /> },
    { id: 'resort',     label: 'Resort & Spa',         description: 'Luxury resort, holiday resort, wellness spa', icon: <Sun       className="w-6 h-6" /> },
    { id: 'hostel',     label: 'Hostel / Dormitory',   description: 'Shared rooms, backpacker hostel, dorm',       icon: <Users     className="w-6 h-6" /> },
  ],
}

const MEDICAL_CONFIG: IndustryConfig = {
  industryId: 6,
  industryType: 'Medical',
  logoIcon: <Stethoscope className="w-6 h-6 text-white" />,
  title: 'Set up your clinic',
  subtitle: 'Get started in under 2 minutes',
  shopNameLabel: 'Clinic / Practice Name',
  shopNamePlaceholder: 'e.g. CityMed Clinic',
  subdomainPlaceholder: 'citymed',
  step1Title: 'What type of healthcare?',
  step1Description: 'Select your practice type — we\'ll pre-load relevant medicine categories, products and appointment workflows.',
  completionText: 'Your clinic workspace is ready.',
  completionSeedEmoji: '💊',
  multiSelect: false,
  businessTypes: [
    { id: 'clinic',    label: 'General Clinic',    description: 'GP, family clinic, multi-specialty',          icon: <Heart        className="w-6 h-6" /> },
    { id: 'pharmacy',  label: 'Pharmacy',          description: 'Retail pharmacy, dispensary, chemist',        icon: <Package      className="w-6 h-6" /> },
    { id: 'dental',    label: 'Dental Clinic',     description: 'Dentist, orthodontist, oral health',          icon: <Smile        className="w-6 h-6" /> },
    { id: 'optometry', label: 'Optometry',         description: 'Eye clinic, optometrist, vision care',        icon: <Eye          className="w-6 h-6" /> },
    { id: 'physio',    label: 'Physiotherapy',     description: 'Physio clinic, rehab, sports medicine',       icon: <Activity     className="w-6 h-6" /> },
  ],
}

const JEWELLERY_CONFIG: IndustryConfig = {
  industryId: 4,
  industryType: 'Jewelry',
  logoIcon: <Gem className="w-6 h-6 text-white" />,
  title: 'Set up your jewellery shop',
  subtitle: 'Get started in under 2 minutes',
  shopNameLabel: 'Shop Name',
  shopNamePlaceholder: 'e.g. Golden Crown Jewellers',
  subdomainPlaceholder: 'goldencrown',
  step1Title: 'What type of jewellery?',
  step1Description: 'Select your speciality — we\'ll pre-load the right metal categories, product types and pricing structure.',
  completionText: 'Your jewellery shop workspace is ready.',
  completionSeedEmoji: '💎',
  multiSelect: false,
  businessTypes: [
    { id: 'gold',     label: 'Gold & Silver',         description: '22K/24K gold, silver jewellery, coins',      icon: <Gem         className="w-6 h-6" /> },
    { id: 'diamond',  label: 'Diamond Jewellery',     description: 'Diamonds, solitaires, diamond-studded gold', icon: <Star        className="w-6 h-6" /> },
    { id: 'gemstone', label: 'Gemstones & Coloured',  description: 'Ruby, emerald, sapphire, semi-precious',      icon: <Layers      className="w-6 h-6" /> },
    { id: 'mixed',    label: 'Mixed / Multi-metal',   description: 'Gold, silver, platinum mixed collection',     icon: <ShoppingBag className="w-6 h-6" /> },
    { id: 'antique',  label: 'Antique & Kundan',      description: 'Antique jewellery, Kundan, Meenakari, Polki', icon: <Crown       className="w-6 h-6" /> },
  ],
}

// ─── Country → Tax config map ─────────────────────────────────────────────────

const STEPS = ['Company Setup', 'Business Type', 'Complete']

interface TaxPreset {
  systemType: string
  isInclusive: boolean
  slabs: { name: string; code: string; rate: number }[]
}

const COUNTRY_TAX: Record<string, TaxPreset> = {
  IN: {
    systemType: '1', isInclusive: false,
    slabs: [
      { name: 'GST 0%',  code: 'GST0',  rate: 0  },
      { name: 'GST 5%',  code: 'GST5',  rate: 5  },
      { name: 'GST 12%', code: 'GST12', rate: 12 },
      { name: 'GST 18%', code: 'GST18', rate: 18 },
      { name: 'GST 28%', code: 'GST28', rate: 28 },
    ],
  },
  AE: {
    systemType: '3', isInclusive: false,
    slabs: [
      { name: 'VAT Exempt', code: 'VAT0', rate: 0 },
      { name: 'VAT 5%',     code: 'VAT5', rate: 5 },
    ],
  },
  GB: {
    systemType: '2', isInclusive: true,
    slabs: [
      { name: 'VAT Exempt',   code: 'VAT0',  rate: 0  },
      { name: 'VAT Reduced',  code: 'VAT5',  rate: 5  },
      { name: 'VAT Standard', code: 'VAT20', rate: 20 },
    ],
  },
  US: {
    systemType: '4', isInclusive: false,
    slabs: [
      { name: 'Exempt',    code: 'EXEMPT', rate: 0 },
      { name: 'State Tax', code: 'STTAX',  rate: 8 },
    ],
  },
  AU: {
    systemType: '1', isInclusive: true,
    slabs: [
      { name: 'GST Exempt', code: 'EXEMPT', rate: 0  },
      { name: 'GST 10%',    code: 'GST10',  rate: 10 },
    ],
  },
  CA: {
    systemType: '1', isInclusive: false,
    slabs: [
      { name: 'GST 5%',  code: 'GST5',  rate: 5  },
      { name: 'HST 13%', code: 'HST13', rate: 13 },
      { name: 'HST 15%', code: 'HST15', rate: 15 },
    ],
  },
  PK: {
    systemType: '1', isInclusive: false,
    slabs: [
      { name: 'GST Exempt', code: 'GST0',  rate: 0  },
      { name: 'GST 17%',    code: 'GST17', rate: 17 },
    ],
  },
  NG: {
    systemType: '2', isInclusive: false,
    slabs: [
      { name: 'VAT Exempt', code: 'EXEMPT', rate: 0   },
      { name: 'VAT 7.5%',   code: 'VAT75',  rate: 7.5 },
    ],
  },
  SG: {
    systemType: '1', isInclusive: false,
    slabs: [
      { name: 'GST Exempt', code: 'EXEMPT', rate: 0 },
      { name: 'GST 9%',     code: 'GST9',   rate: 9 },
    ],
  },
}

const DEFAULT_TAX: TaxPreset = {
  systemType: '1', isInclusive: false,
  slabs: [
    { name: 'Exempt',   code: 'EXEMPT', rate: 0  },
    { name: 'Tax 10%',  code: 'TAX10',  rate: 10 },
  ],
}

// ─── Form types ────────────────────────────────────────────────────────────────

interface CompanyFormData {
  title: string
  phone: string
  email: string
  country: string
  currency: string
  subDomain: string
}

// ─── Base page component ───────────────────────────────────────────────────────

const OnboardingPageBase: React.FC<{ config: IndustryConfig }> = ({ config }) => {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()

  const [step, setStep] = useState(0)
  const [companyData, setCompanyData] = useState<CompanyFormData | null>(null)
  const [selectedBusinessTypes, setSelectedBusinessTypes] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [setupStatus, setSetupStatus] = useState('')

  const { register, handleSubmit, formState: { errors } } = useForm<CompanyFormData>()

  const handleCompanySubmit = (data: CompanyFormData) => {
    setCompanyData(data)
    setStep(1)
  }

  // ── Toggle a business type on/off ─────────────────────────────────────────────
  const toggleBusinessType = (type: string) => {
    if (loading) return
    if (config.multiSelect) {
      // Multi-select: toggle on/off
      setSelectedBusinessTypes(prev =>
        prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
      )
    } else {
      // Single-select: always set to exactly this one (can't deselect)
      setSelectedBusinessTypes([type])
    }
  }

  // ── Full workspace setup ──────────────────────────────────────────────────────
  const handleSetup = async () => {
    if (!companyData || selectedBusinessTypes.length === 0) return
    setLoading(true)

    try {
      // Step 1: Create tenant
      setSetupStatus('Creating your workspace…')
      const createRes = await tenantApi.create({
        title: companyData.title,
        phone: companyData.phone,
        email: companyData.email,
        country: companyData.country,
        currency: companyData.currency,
        subdomain: companyData.subDomain,
        industryType: String(config.industryId),
        businessType: selectedBusinessTypes.join(','),
      })
      const tenantId: string = createRes.data.data

      // Step 2: Seed data for each selected business type
      for (const bType of selectedBusinessTypes) {
        const label = config.businessTypes.find(b => b.id === bType)?.label ?? bType
        setSetupStatus(`Loading ${label} catalogue…`)
        await tenantApi.seedIndustry({ companyId: tenantId, industryType: config.industryType, businessType: bType })
      }

      // Step 3: Register signed-in user as Owner employee
      setSetupStatus('Registering your account as owner…')
      try {
        const userRes = await authApi.getCurrentUser()
        const user = userRes.data?.data ?? userRes.data
        if (user?.id || user?.name) {
          await employeesApi.createEmployee({
            companyId: tenantId,
            name: user.name ?? companyData.title,
            phone: user.phone ?? companyData.phone ?? undefined,
            email: user.email ?? companyData.email ?? undefined,
            role: 'Admin',
            jobTitle: 'Owner',
          })
        }
      } catch {
        // Non-critical — workspace still usable without employee record
      }

      // Step 4: Tax configuration
      setSetupStatus('Configuring tax settings…')
      const taxPreset = COUNTRY_TAX[companyData.country] ?? DEFAULT_TAX
      try {
        await taxApi.saveConfiguration({
          companyId: tenantId,
          systemType: taxPreset.systemType,
          isInclusive: taxPreset.isInclusive,
        })
        await Promise.allSettled(
          taxPreset.slabs.map((slab) =>
            taxApi.createSlab({
              companyId: tenantId,
              name: slab.name,
              code: slab.code,
              rate: slab.rate,
              isActive: true,
            })
          )
        )
      } catch {
        // Tax setup failure is non-critical
      }

      toast.success('Workspace ready!')
      setStep(2)
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.errors?.[0] ?? err.response?.data?.message ?? 'Setup failed.')
        : 'Setup failed.'
      toast.error(typeof msg === 'string' ? msg : 'Setup failed.')
      if (typeof msg === 'string' && msg.toLowerCase().includes('subdomain')) setStep(0)
    } finally {
      setLoading(false)
      setSetupStatus('')
    }
  }

  // ── Navigate to dashboard ─────────────────────────────────────────────────────
  const handleComplete = async () => {
    try {
      const tRes = await tenantApi.getTenant()
      const t = tRes.data.data
      if (t) {
        dispatch(setTenant({
          id: t.id,
          title: t.title,
          businessType: t.businessType ?? '',
          industryType: config.industryType,
          modules: t.activeModules ? t.activeModules.split(',').map((m: string) => m.trim()) : [],
          phone: t.phone ?? '',
          email: t.email ?? '',
          country: t.country ?? '',
          currency: t.currency ?? '',
          createdAt: t.createdAt ?? t.created_at ?? undefined,
          plan: 'free',
        }))
        const sRes = await tenantApi.getStores(t.id)
        const rawStores: Record<string, unknown>[] = sRes.data.data ?? []
        const stores = rawStores.map((s) => ({
          id: String(s.id ?? ''),
          name: String(s.title ?? s.name ?? ''),
          address: String(s.address ?? ''),
          phone: String(s.phone ?? ''),
          email: String(s.email ?? ''),
          countryCode: String(s.countryCode ?? s.country ?? ''),
          currencyCode: String(s.currencyCode ?? s.currency ?? ''),
          locationCode: String(s.locationCode ?? ''),
          type: Number(s.type ?? 1),
          isDefault: Boolean(s.isDefault),
          timeZoneId: s.timeZoneId ? String(s.timeZoneId) : undefined,
        }))
        if (stores.length > 0) {
          dispatch(setStores(stores))
          dispatch(setCurrentStore(stores[0].id))
        }
      }
    } catch { /* proceed anyway */ }
    navigate('/')
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 flex items-center justify-center p-6">
      <div className="w-full max-w-xl">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-4">
            <div className="w-11 h-11 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              {config.logoIcon}
            </div>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">Flowtap</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{config.title}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">{config.subtitle}</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-0 mb-8">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div className="flex flex-col items-center gap-1">
                <div className={[
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all',
                  i < step  ? 'bg-blue-600 border-blue-600 text-white'
                  : i === step ? 'border-blue-600 text-blue-600 bg-white dark:bg-gray-900'
                  : 'border-gray-300 text-gray-400 bg-white dark:bg-gray-900',
                ].join(' ')}>
                  {i < step ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-xs hidden sm:block ${i === step ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>{s}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 mb-4 ${i < step ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8">

          {/* ── Step 0: Company Setup ── */}
          {step === 0 && (
            <form onSubmit={handleSubmit(handleCompanySubmit)} className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Tell us about your business</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Basic details to set up your workspace</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {config.shopNameLabel} *
                  </label>
                  <input
                    {...register('title', { required: 'Required' })}
                    placeholder={config.shopNamePlaceholder}
                    className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                  />
                  {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone *</label>
                    <input {...register('phone', { required: 'Required' })} placeholder="+91 XXXXX XXXXX"
                      className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white" />
                    {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                    <input {...register('email')} type="email" placeholder="info@business.com"
                      className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Country *</label>
                    <select {...register('country', { required: 'Required' })}
                      className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white">
                      <option value="">Select country</option>
                      {[
                        ['IN', 'India'],
                        ['US', 'United States'],
                        ['GB', 'United Kingdom'],
                        ['AE', 'UAE'],
                        ['AU', 'Australia'],
                        ['CA', 'Canada'],
                        ['PK', 'Pakistan'],
                        ['NG', 'Nigeria'],
                        ['SG', 'Singapore'],
                      ].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    {errors.country && <p className="text-xs text-red-500 mt-1">{errors.country.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Currency *</label>
                    <select {...register('currency', { required: 'Required' })}
                      className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white">
                      <option value="">Select currency</option>
                      {[
                        ['INR', 'INR — Rupee'],
                        ['USD', 'USD — Dollar'],
                        ['GBP', 'GBP — Pound'],
                        ['EUR', 'EUR — Euro'],
                        ['AED', 'AED — Dirham'],
                        ['AUD', 'AUD — A$ Dollar'],
                        ['CAD', 'CAD — C$ Dollar'],
                        ['PKR', 'PKR — Rupee'],
                        ['NGN', 'NGN — Naira'],
                        ['SGD', 'SGD — S$ Dollar'],
                      ].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    {errors.currency && <p className="text-xs text-red-500 mt-1">{errors.currency.message}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subdomain *</label>
                  <div className="flex">
                    <input
                      {...register('subDomain', {
                        required: 'Required',
                        pattern: { value: /^[a-z0-9-]+$/, message: 'Lowercase letters, numbers, hyphens only' },
                      })}
                      placeholder={config.subdomainPlaceholder}
                      className="flex-1 px-3 py-2.5 border border-r-0 border-gray-300 dark:border-gray-600 rounded-l-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                    />
                    <span className="px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-lg text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      .flowtap.io
                    </span>
                  </div>
                  {errors.subDomain && <p className="text-xs text-red-500 mt-1">{errors.subDomain.message}</p>}
                </div>
              </div>

              <button type="submit"
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors mt-2 shadow-lg shadow-blue-500/20">
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* ── Step 1: Business Type ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{config.step1Title}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{config.step1Description}</p>
                {config.multiSelect && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">You can select multiple</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {config.businessTypes.map((bt) => {
                  const isSelected = selectedBusinessTypes.includes(bt.id)
                  return (
                    <button
                      key={bt.id}
                      onClick={() => toggleBusinessType(bt.id)}
                      disabled={loading}
                      className={[
                        'relative flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20',
                        'disabled:cursor-not-allowed disabled:opacity-60',
                        isSelected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800',
                      ].join(' ')}
                    >
                      {isSelected && (
                        <span className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </span>
                      )}
                      <div className={[
                        'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
                        isSelected
                          ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
                      ].join(' ')}>
                        {bt.icon}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-gray-900 dark:text-white">{bt.label}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{bt.description}</p>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Setup progress indicator */}
              {loading && setupStatus && (
                <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">{setupStatus}</p>
                </div>
              )}

              <button
                onClick={handleSetup}
                disabled={selectedBusinessTypes.length === 0 || loading}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors shadow-lg shadow-blue-500/20 disabled:shadow-none"
              >
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Setting up…</>
                  : <>Set up my workspace <ArrowRight className="w-4 h-4" /></>
                }
              </button>

              <button
                onClick={() => setStep(0)}
                disabled={loading}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            </div>
          )}

          {/* ── Step 2: Complete ── */}
          {step === 2 && (
            <div className="text-center py-4">
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">You're all set!</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-4">{config.completionText}</p>

              <div className="text-left bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 mb-6 space-y-2">
                {[
                  { icon: '🏪', text: 'Default store created' },
                  { icon: '📦', text: 'In-store warehouse configured' },
                  { icon: '👤', text: 'You are registered as Owner' },
                  { icon: '🧾', text: 'Tax configuration set for your country' },
                  {
                    icon: config.completionSeedEmoji,
                    text: `Seeded: ${selectedBusinessTypes.map(id => config.businessTypes.find(b => b.id === id)?.label ?? id).join(', ')}`,
                  },
                ].map(({ icon, text }) => (
                  <div key={text} className="flex items-center gap-2.5">
                    <span className="text-base">{icon}</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">{text}</span>
                    <Check className="w-3.5 h-3.5 text-green-500 ml-auto flex-shrink-0" />
                  </div>
                ))}
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-4 mb-6 text-left">
                <div className="flex items-start gap-3">
                  <Store className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-300">Free Trial — 30 Days</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      You can add up to <strong>2 stores</strong>. Adding a second store reduces the trial to 15 days.
                      Upgrade anytime for unlimited stores.
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleComplete}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-xl transition-colors shadow-lg shadow-blue-500/20"
              >
                Go to Dashboard <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Named industry exports ────────────────────────────────────────────────────

export const RepairOnboardingPage: React.FC    = () => <OnboardingPageBase config={REPAIR_CONFIG} />
export const FoodOnboardingPage: React.FC      = () => <OnboardingPageBase config={FOOD_CONFIG} />
export const HotelOnboardingPage: React.FC     = () => <OnboardingPageBase config={HOTEL_CONFIG} />
export const MedicalOnboardingPage: React.FC   = () => <OnboardingPageBase config={MEDICAL_CONFIG} />
export const JewelleryOnboardingPage: React.FC = () => <OnboardingPageBase config={JEWELLERY_CONFIG} />

// Backward compat alias (repair app keeps using OnboardingPage unchanged)
export const OnboardingPage = RepairOnboardingPage
