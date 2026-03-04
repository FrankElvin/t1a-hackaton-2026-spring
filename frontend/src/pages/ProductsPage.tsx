import { useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, ArrowUpDown, Trash2, ShoppingCart, X, ChevronDown } from 'lucide-react'
import api from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { mockItems, mockForecast, mockStores } from '@/lib/mockData'
import type { Item, ItemCategory, ItemForecast, ForecastResponse, Store } from '@/types/api'

const MOCK_AUTH = import.meta.env.VITE_MOCK_AUTH === 'true'
const PAGE_SIZE = 20

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

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as ItemCategory[]

function depletionColor(days?: number) {
  if (days === undefined) return 'text-gray-400'
  if (days <= 3) return 'text-red-600'
  if (days <= 7) return 'text-orange-500'
  return 'text-green-600'
}

function depletionBg(days?: number) {
  if (days === undefined) return ''
  if (days <= 3) return 'bg-red-50 border-red-200'
  if (days <= 7) return 'bg-orange-50 border-orange-200'
  return 'bg-white border-gray-200'
}

function formatDays(days?: number): string {
  if (days === undefined) return 'No forecast'
  if (days <= 0) return 'Depleted'
  if (days === 1) return '1 day left'
  return `${days}d left`
}

// ── Delete confirmation dialog ──────────────────────────────────────────────

function DeleteDialog({
  itemName,
  onConfirm,
  onCancel,
}: {
  itemName: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4 mx-auto">
          <Trash2 className="w-5 h-5 text-red-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 text-center mb-1">Delete product?</h2>
        <p className="text-sm text-gray-500 text-center mb-6">
          <span className="font-medium text-gray-800">{itemName}</span> will be removed from your
          tracker.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            onClick={onConfirm}
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Toast ────────────────────────────────────────────────────────────────────

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

// ── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({
  item,
  storeName,
  onDelete,
  onMarkBought,
  onTap,
}: {
  item: EnrichedItem
  storeName?: string
  onDelete: () => void
  onMarkBought: () => void
  onTap: () => void
}) {
  const [swipeX, setSwipeX] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const touchStartX = useRef(0)
  const THRESHOLD = 80

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    setIsSwiping(true)
  }

  function handleTouchMove(e: React.TouchEvent) {
    const delta = e.touches[0].clientX - touchStartX.current
    // limit range so indicators don't over-extend
    setSwipeX(Math.max(-140, Math.min(140, delta)))
  }

  function handleTouchEnd() {
    setIsSwiping(false)
    if (swipeX < -THRESHOLD) {
      onDelete()
    } else if (swipeX > THRESHOLD) {
      onMarkBought()
    }
    setSwipeX(0)
  }

  const days = item.forecast?.daysUntilDepletion

  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-200 select-none">
      {/* Left action background (swipe right → bought) */}
      <div
        className={cn(
          'absolute inset-y-0 left-0 flex items-center gap-2 px-5 text-white font-medium text-sm',
          swipeX > 0 ? 'bg-green-500' : 'bg-transparent'
        )}
        style={{ width: `${Math.max(0, swipeX)}px`, minWidth: 0, overflow: 'hidden' }}
      >
        <ShoppingCart className="w-5 h-5 shrink-0" />
        <span className="whitespace-nowrap">Bought</span>
      </div>

      {/* Right action background (swipe left → delete) */}
      <div
        className={cn(
          'absolute inset-y-0 right-0 flex items-center justify-end gap-2 px-5 text-white font-medium text-sm',
          swipeX < 0 ? 'bg-red-500' : 'bg-transparent'
        )}
        style={{ width: `${Math.max(0, -swipeX)}px`, minWidth: 0, overflow: 'hidden' }}
      >
        <span className="whitespace-nowrap">Delete</span>
        <Trash2 className="w-5 h-5 shrink-0" />
      </div>

      {/* Card content */}
      <div
        className={cn('relative bg-white px-4 py-3', depletionBg(days))}
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.2s ease',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex items-center gap-3">
          {/* Main info — tappable */}
          <button className="flex-1 min-w-0 text-left" onClick={onTap}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 truncate">{item.name}</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {item.currentQuantity} {item.unit}
                  {item.category && (
                    <span className="ml-2 text-xs text-gray-400">
                      · {CATEGORY_LABELS[item.category]}
                    </span>
                  )}
                  {storeName && (
                    <span className="ml-2 text-xs text-blue-500">· {storeName}</span>
                  )}
                </p>
              </div>
              <div className={cn('text-sm font-medium shrink-0', depletionColor(days))}>
                {formatDays(days)}
              </div>
            </div>

            {/* Progress bar */}
            {item.forecast?.percentRemaining !== undefined && (
              <div className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
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
          </button>

          {/* Desktop action buttons */}
          <div className="hidden sm:flex items-center gap-1 shrink-0">
            <button
              onClick={onMarkBought}
              className="p-2 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
              title="Mark as bought"
            >
              <ShoppingCart className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<ItemCategory | null>(null)
  const [sortAsc, setSortAsc] = useState(true)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // ── Data fetching ──

  const { data: stores = [] } = useQuery<Store[]>({
    queryKey: ['stores'],
    queryFn: MOCK_AUTH
      ? () => Promise.resolve(mockStores)
      : () => api.get<Store[]>('/stores').then((r) => r.data),
  })

  const storeMap = useMemo(
    () => new Map(stores.map((s) => [s.id, s.name])),
    [stores]
  )

  const { data: items = [], isLoading: itemsLoading } = useQuery<Item[]>({
    queryKey: ['items', categoryFilter],
    queryFn: MOCK_AUTH
      ? () => Promise.resolve(mockItems.filter((i) => !categoryFilter || i.category === categoryFilter))
      : () =>
          api
            .get<Item[]>('/items', { params: categoryFilter ? { category: categoryFilter } : {} })
            .then((r) => r.data),
  })

  const { data: forecast } = useQuery<ForecastResponse>({
    queryKey: ['forecast'],
    queryFn: MOCK_AUTH
      ? () => Promise.resolve(mockForecast)
      : () => api.get<ForecastResponse>('/forecast').then((r) => r.data),
  })

  // ── Merged + filtered + sorted list ──

  const enriched = useMemo<EnrichedItem[]>(() => {
    const fMap = new Map(forecast?.items.map((f) => [f.itemId, f]) ?? [])
    return items.map((item) => ({ ...item, forecast: fMap.get(item.id) }))
  }, [items, forecast])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return enriched.filter((item) => !q || item.name.toLowerCase().includes(q))
  }, [enriched, search])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const da = a.forecast?.daysUntilDepletion ?? 9999
      const db = b.forecast?.daysUntilDepletion ?? 9999
      return sortAsc ? da - db : db - da
    })
  }, [filtered, sortAsc])

  const visible = sorted.slice(0, visibleCount)
  const hasMore = visibleCount < sorted.length

  // ── Mutations ──

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (MOCK_AUTH) return Promise.resolve()
      return api.delete(`/items/${id}`).then(() => {})
    },
    onSuccess: (_, id) => {
      queryClient.setQueryData<Item[]>(['items', categoryFilter], (prev) =>
        prev?.filter((i) => i.id !== id) ?? []
      )
      queryClient.setQueryData<ForecastResponse>(['forecast'], (prev) =>
        prev ? { ...prev, items: prev.items.filter((f) => f.itemId !== id) } : prev
      )
      showToast('Product deleted')
    },
  })

  const markBoughtMutation = useMutation({
    mutationFn: (item: Item) => {
      const today = new Date().toISOString().split('T')[0]
      if (MOCK_AUTH) return Promise.resolve({ ...item, lastBoughtDate: today })
      return api
        .put<Item>(`/items/${item.id}`, { ...item, lastBoughtDate: today })
        .then((r) => r.data)
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<Item[]>(['items', categoryFilter], (prev) =>
        prev?.map((i) => (i.id === updated.id ? updated : i)) ?? []
      )
      showToast(`${updated.name} marked as bought`)
    },
  })

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  function handleDelete(id: string) {
    setDeleteTargetId(null)
    deleteMutation.mutate(id)
  }

  const deleteTarget = deleteTargetId ? items.find((i) => i.id === deleteTargetId) : null

  // ── Render ──

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Search + sort row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setVisibleCount(PAGE_SIZE)
            }}
            placeholder="Search products…"
            className="pl-9"
          />
        </div>
        <button
          onClick={() => setSortAsc((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors whitespace-nowrap"
          title={sortAsc ? 'Soonest first' : 'Latest first'}
        >
          <ArrowUpDown className="w-4 h-4" />
          <span className="hidden sm:inline">{sortAsc ? 'Soonest' : 'Latest'}</span>
        </button>
        <Button onClick={() => navigate('/add-product')} size="sm" className="shrink-0">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline ml-1">Add</span>
        </Button>
      </div>

      {/* Category filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => {
            setCategoryFilter(null)
            setVisibleCount(PAGE_SIZE)
          }}
          className={cn(
            'px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap transition-colors',
            categoryFilter === null
              ? 'bg-blue-500 text-white border-blue-500'
              : 'border-gray-200 text-gray-600 hover:border-gray-300'
          )}
        >
          All
        </button>
        {ALL_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => {
              setCategoryFilter(cat === categoryFilter ? null : cat)
              setVisibleCount(PAGE_SIZE)
            }}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap transition-colors',
              categoryFilter === cat
                ? 'bg-blue-500 text-white border-blue-500'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            )}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Mobile swipe hint */}
      <p className="text-xs text-gray-400 text-center sm:hidden">
        Swipe right to mark as bought · Swipe left to delete
      </p>

      {/* List */}
      {itemsLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <p className="text-gray-400 text-sm">
            {search || categoryFilter ? 'No products match your filters.' : 'No products yet.'}
          </p>
          {!search && !categoryFilter && (
            <Button onClick={() => navigate('/add-product')}>
              <Plus className="w-4 h-4" />
              Add your first product
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((item) => (
            <ProductCard
              key={item.id}
              item={item}
              storeName={item.storeId ? storeMap.get(item.storeId) : undefined}
              onTap={() => navigate(`/products/${item.id}`)}
              onDelete={() => setDeleteTargetId(item.id)}
              onMarkBought={() => markBoughtMutation.mutate(item)}
            />
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <button
          onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ChevronDown className="w-4 h-4" />
          Show more ({sorted.length - visibleCount} remaining)
        </button>
      )}

      {/* Result count */}
      {!itemsLoading && visible.length > 0 && (
        <p className="text-xs text-gray-400 text-center pb-2">
          {sorted.length} product{sorted.length !== 1 ? 's' : ''}
          {search || categoryFilter ? ' matching filters' : ' total'}
        </p>
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <DeleteDialog
          itemName={deleteTarget.name}
          onConfirm={() => handleDelete(deleteTarget.id)}
          onCancel={() => setDeleteTargetId(null)}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  )
}
