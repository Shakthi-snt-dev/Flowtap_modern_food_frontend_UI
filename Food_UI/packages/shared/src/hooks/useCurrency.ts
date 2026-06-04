import { useAppSelector } from '@flowtap/store'

const COUNTRY_LOCALE: Record<string, string> = {
  US: 'en-US', CA: 'en-CA', GB: 'en-GB', IN: 'en-IN',
  AE: 'ar-AE', AU: 'en-AU', PK: 'ur-PK', NG: 'en-NG', SG: 'en-SG',
}

export function useCurrency() {
  const stores = useAppSelector((s) => s.tenant.stores)
  const currentStoreId = useAppSelector((s) => s.tenant.currentStoreId)
  const tenant = useAppSelector((s) => s.tenant.tenant)
  const store = stores.find((s) => s.id === currentStoreId) ?? stores[0]
  const currency = store?.currencyCode || tenant?.currency || 'USD'
  const locale = COUNTRY_LOCALE[store?.countryCode || tenant?.country || ''] ?? 'en-US'
  const format = (amount: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)
  return { format, currency, locale }
}
