import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Store as StoreIcon,
  Calendar,
  Clock,
  Package,
  ShoppingCart,
  CheckCircle2,
  CheckSquare,
  Square,
  X,
} from 'lucide-react'
import api from '@/lib/axios'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
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

// ── Toast ──────────────────────────────────────────────────────────────────────

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-lg max-w-xs">
      <span>{message}</span>
      <button onClick={onDismiss} className="text-white/60 hover:text-white">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function StoreDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  // which action the bottom bar is for: 'bought' | 'consumed'
  const [pendingAction, setPendingAction] = useState<'bought' | 'consumed' | null>(null)
  const [boughtDate, setBoughtDate] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  // ── Data ──

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

  const sorted = useMemo<EnrichedItem[]>(() => {
    const fMap = new Map(forecast?.items.map((f) => [f.itemId, f]) ?? [])
    const enriched = items.map((item) => ({ ...item, forecast: fMap.get(item.id) }))
    return enriched.sort((a, b) => {
      const da = a.forecast?.daysUntilDepletion ?? 9999
      const db = b.forecast?.daysUntilDepletion ?? 9999
      return da - db
    })
  }, [items, forecast])

  // ── Mutations ──

  const markBoughtMutation = useMutation({
    mutationFn: async ({ itemList, date }: { itemList: Item[]; date: string }) => {
      if (MOCK_AUTH) return itemList.map((item) => ({ ...item, lastBoughtDate: date } as Item))
      return Promise.all(
        itemList.map((item) =>
          api.post<Item>(`/items/${item.id}/mark-bought`, { boughtDate: date }).then((r) => r.data)
        )
      )
    },
    onSuccess: (updatedItems) => {
      queryClient.setQueryData<Item[]>(['items', { storeId: id }], (prev) =>
        prev?.map((i) => updatedItems.find((u) => u.id === i.id) ?? i) ?? []
      )
      queryClient.invalidateQueries({ queryKey: ['forecast'] })
      // update store's lastVisitDate
      queryClient.setQueryData<Store[]>(['stores'], (prev) =>
        prev?.map((s) =>
          s.id === id ? { ...s, lastVisitDate: boughtDate } : s
        ) ?? []
      )
      exitSelectMode()
      showToast(
        updatedItems.length === 1
          ? `${updatedItems[0].name} marked as bought`
          : `${updatedItems.length} items marked as bought`
      )
    },
  })

  const markConsumedMutation = useMutation({
    mutationFn: async (itemList: Item[]) => {
      if (MOCK_AUTH) return itemList.map((item) => ({ ...item, currentQuantity: 0 } as Item))
      return Promise.all(
        itemList.map((item) =>
          api
            .post<Item>(`/items/${item.id}/consumed`, {
              quantityConsumed: item.currentQuantity,
              depletedAt: boughtDate || new Date().toISOString().split('T')[0],
            })
            .then((r) => r.data)
        )
      )
    },
    onSuccess: (updatedItems) => {
      queryClient.setQueryData<Item[]>(['items', { storeId: id }], (prev) =>
        prev?.map((i) => updatedItems.find((u) => u.id === i.id) ?? i) ?? []
      )
      queryClient.invalidateQueries({ queryKey: ['forecast'] })
      exitSelectMode()
      showToast(
        updatedItems.length === 1
          ? `${updatedItems[0].name} marked as finished`
          : `${updatedItems.length} items marked as finished`
      )
    },
  })

  // ── Helpers ──

  function enterSelectMode(action: 'bought' | 'consumed') {
    setSelectMode(true)
    setPendingAction(action)
    setBoughtDate(new Date().toISOString().split('T')[0])
    // pre-select all items
    setSelectedIds(new Set(sorted.map((i) => i.id)))
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelectedIds(new Set())
    setPendingAction(null)
  }

  function toggleSelect(itemId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  function confirmAction() {
    const selected = items.filter((i) => selectedIds.has(i.id))
    if (!selected.length) return
    if (pendingAction === 'bought') {
      markBoughtMutation.mutate({ itemList: selected, date: boughtDate })
    } else if (pendingAction === 'consumed') {
      markConsumedMutation.mutate(selected)
    }
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const isPending = markBoughtMutation.isPending || markConsumedMutation.isPending
  const isLoading = storeLoading || itemsLoading

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-24">
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
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-100 shrink-0">
              <StoreIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900">{store.name}</h1>
              <div className="flex flex-wrap gap-3 mt-1">
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
                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Package className="w-3.5 h-3.5" />
                  {items.length} item{items.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          {!selectMode && items.length > 0 && (
            <div className="flex gap-2 mt-4">
              <Button
                size="sm"
                className="flex-1"
                onClick={() => enterSelectMode('bought')}
              >
                <ShoppingCart className="w-4 h-4 mr-1.5" />
                Record purchase
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 border-purple-200 text-purple-700 hover:bg-purple-50"
                onClick={() => enterSelectMode('consumed')}
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                Mark finished
              </Button>
            </div>
          )}
        </div>
      ) : (
        <p className="text-center text-gray-400 py-8">Store not found.</p>
      )}

      {/* Items section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Products
          </p>
          {selectMode && (
            <button
              onClick={() => {
                if (selectedIds.size === sorted.length && sorted.length > 0) {
                  setSelectedIds(new Set())
                } else {
                  setSelectedIds(new Set(sorted.map((i) => i.id)))
                }
              }}
              className="text-xs text-blue-600 font-medium hover:underline"
            >
              {selectedIds.size === sorted.length && sorted.length > 0 ? 'Deselect all' : 'Select all'}
            </button>
          )}
        </div>

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
              const isSelected = selectedIds.has(item.id)
              return (
                <li
                  key={item.id}
                  className={cn(
                    'flex items-center gap-3 bg-white border rounded-xl px-4 py-3 transition-shadow',
                    depletionBg(days),
                    selectMode ? 'cursor-pointer' : 'cursor-pointer hover:shadow-sm'
                  )}
                  onClick={() => selectMode ? toggleSelect(item.id) : navigate(`/products/${item.id}`)}
                >
                  {/* Checkbox in select mode */}
                  {selectMode && (
                    <span className="shrink-0 text-blue-600">
                      {isSelected
                        ? <CheckSquare className="w-5 h-5" />
                        : <Square className="w-5 h-5 text-gray-300" />}
                    </span>
                  )}

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

      {/* Bottom action bar (select mode) */}
      {selectMode && (
        <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 shadow-lg">
          {/* Date picker — for both bought and consumed */}
          <div className="flex items-center gap-3 px-4 pt-3 pb-1">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
              {pendingAction === 'bought' ? 'Purchase date:' : 'Finished on:'}
            </label>
            <input
              type="date"
              value={boughtDate}
              onChange={(e) => setBoughtDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className={`flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 ${
                pendingAction === 'consumed' ? 'focus:ring-purple-500' : 'focus:ring-blue-500'
              }`}
            />
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-sm text-gray-600 font-medium">
              {selectedIds.size === 0 ? 'No items selected' : `${selectedIds.size} selected`}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exitSelectMode}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={selectedIds.size === 0 || isPending || !boughtDate}
                className={cn(
                  pendingAction === 'consumed'
                    ? 'bg-purple-600 hover:bg-purple-700 text-white'
                    : ''
                )}
                onClick={confirmAction}
              >
                {isPending ? 'Saving…' : pendingAction === 'bought' ? (
                  <><ShoppingCart className="w-4 h-4 mr-1.5" />Confirm purchase</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4 mr-1.5" />Mark finished</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  )
}
