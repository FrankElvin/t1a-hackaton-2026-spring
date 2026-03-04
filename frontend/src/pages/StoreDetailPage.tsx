import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Store as StoreIcon, Calendar, Clock, Package } from 'lucide-react'
import api from '@/lib/axios'
import { cn } from '@/lib/utils'
import { mockStores, mockItems, mockForecast } from '@/lib/mockData'
import type { Store, Item, ForecastResponse, ItemForecast, ItemCategory } from '@/types/api'

const MOCK_AUTH = import.meta.env.VITE_MOCK_AUTH === 'true'

type EnrichedItem = Item & { forecast?: ItemForecast }

const CATEGORY_LABELS: Record<ItemCategory, string> = {
  FOOD: 'Food',
  BEVERAGES: 'Beverages',
  CLEANING: 'Cleaning',
  PERSONAL_CARE: 'Personal Care',
  PET_FOOD: 'Pet Food',
  MEDICINE: 'Medicine',
  OTHER: 'Other',
}

function depletionColor(days?: number) {
  if (days === undefined) return 'text-gray-400'
  if (days <= 3) return 'text-red-600'
  if (days <= 7) return 'text-orange-500'
  return 'text-green-600'
}

function depletionBg(days?: number) {
  if (days === undefined) return 'border-gray-200'
  if (days <= 3) return 'bg-red-50 border-red-200'
  if (days <= 7) return 'bg-orange-50 border-orange-200'
  return 'border-gray-200'
}

function formatDays(days?: number): string {
  if (days === undefined) return 'No forecast'
  if (days <= 0) return 'Depleted'
  if (days === 1) return '1 day left'
  return `${days}d left`
}

export default function StoreDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: store, isLoading: storeLoading } = useQuery<Store>({
    queryKey: ['stores', id],
    queryFn: MOCK_AUTH
      ? () => {
          const found = mockStores.find((s) => s.id === id)
          if (!found) throw new Error('Not found')
          return Promise.resolve(found)
        }
      : () => api.get<Store>(`/stores/${id}`).then((r) => r.data),
    enabled: !!id,
  })

  const { data: items = [], isLoading: itemsLoading } = useQuery<Item[]>({
    queryKey: ['items', { storeId: id }],
    queryFn: MOCK_AUTH
      ? () => Promise.resolve(mockItems.filter((i) => i.storeId === id))
      : () => api.get<Item[]>('/items', { params: { storeId: id } }).then((r) => r.data),
    enabled: !!id,
  })

  const { data: forecast } = useQuery<ForecastResponse>({
    queryKey: ['forecast'],
    queryFn: MOCK_AUTH
      ? () => Promise.resolve(mockForecast)
      : () => api.get<ForecastResponse>('/forecast').then((r) => r.data),
  })

  const enriched: EnrichedItem[] = (() => {
    const fMap = new Map(forecast?.items.map((f) => [f.itemId, f]) ?? [])
    return items.map((item) => ({ ...item, forecast: fMap.get(item.id) }))
  })()

  const sorted = [...enriched].sort((a, b) => {
    const da = a.forecast?.daysUntilDepletion ?? 9999
    const db = b.forecast?.daysUntilDepletion ?? 9999
    return da - db
  })

  const isLoading = storeLoading || itemsLoading

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Back button */}
      <button
        onClick={() => navigate('/stores')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors -ml-1"
      >
        <ArrowLeft className="w-4 h-4" />
        All stores
      </button>

      {/* Store header */}
      {storeLoading ? (
        <div className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
      ) : store ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 flex items-start gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-100 shrink-0">
            <StoreIcon className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900">{store.name}</h1>
            <div className="flex flex-wrap gap-3 mt-2">
              {store.visitIntervalDays && (
                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Clock className="w-3.5 h-3.5" />
                  Every {store.visitIntervalDays} day{store.visitIntervalDays !== 1 ? 's' : ''}
                </span>
              )}
              {store.lastVisitDate && (
                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Calendar className="w-3.5 h-3.5" />
                  Last visit {store.lastVisitDate}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-sm font-medium text-gray-600 shrink-0">
            <Package className="w-4 h-4 text-gray-400" />
            {items.length} item{items.length !== 1 ? 's' : ''}
          </div>
        </div>
      ) : (
        <p className="text-center text-gray-400 py-8">Store not found.</p>
      )}

      {/* Items section */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Products
        </p>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-sm">No products assigned to this store.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {sorted.map((item) => {
              const days = item.forecast?.daysUntilDepletion
              return (
                <li
                  key={item.id}
                  onClick={() => navigate(`/products/${item.id}`)}
                  className={cn(
                    'flex items-center gap-3 bg-white border rounded-xl px-4 py-3 cursor-pointer hover:shadow-sm transition-shadow',
                    depletionBg(days)
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{item.name}</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {item.currentQuantity} {item.unit}
                      {item.category && (
                        <span className="ml-2 text-xs text-gray-400">
                          · {CATEGORY_LABELS[item.category]}
                        </span>
                      )}
                    </p>
                    {item.forecast?.percentRemaining !== undefined && (
                      <div className="mt-1.5 h-1 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            days !== undefined && days <= 3
                              ? 'bg-red-500'
                              : days !== undefined && days <= 7
                                ? 'bg-orange-400'
                                : 'bg-green-500'
                          )}
                          style={{ width: `${Math.min(100, item.forecast.percentRemaining)}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div className={cn('text-sm font-medium shrink-0', depletionColor(days))}>
                    {formatDays(days)}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
