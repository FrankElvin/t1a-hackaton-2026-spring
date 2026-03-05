import { useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, ArrowUpDown, Trash2, ShoppingCart, X, ChevronDown, CheckSquare, Square, CheckCircle2 } from 'lucide-react'
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
  onMarkConsumed,
  onTap,
  selectMode = false,
  selected = false,
  onSelect,
}: {
  item: EnrichedItem
  storeName?: string
  onDelete: () => void
  onMarkBought: () => void
  onMarkConsumed: () => void
  onTap: () => void
  selectMode?: boolean
  selected?: boolean
  onSelect?: () => void
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
          {/* Checkbox in select mode */}
          {selectMode && (
            <button onClick={onSelect} className="shrink-0 text-blue-600">
              {selected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-gray-400" />}
            </button>
          )}

          {/* Main info — tappable */}
          <button className="flex-1 min-w-0 text-left" onClick={selectMode ? onSelect : onTap}>
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
          <div className={cn('items-center gap-1 shrink-0', selectMode ? 'hidden' : 'hidden sm:flex')}>
            <button
              onClick={onMarkBought}
              className="p-2 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
              title="Mark as bought"
            >
              <ShoppingCart className="w-4 h-4" />
            </button>
            <button
              onClick={onMarkConsumed}
              className="p-2 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
              title="Mark as finished"
            >
              <CheckCircle2 className="w-4 h-4" />
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
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [markBoughtItems, setMarkBoughtItems] = useState<Item[]>([])
  const [markBoughtDate, setMarkBoughtDate] = useState('')
  const [markConsumedItems, setMarkConsumedItems] = useState<Item[]>([])
  const [markConsumedDate, setMarkConsumedDate] = useState('')
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
    mutationFn: async ({ items, date }: { items: Item[]; date: string }) => {
      if (MOCK_AUTH) return items.map((item) => ({ ...item, lastBoughtDate: date } as Item))
      return Promise.all(
        items.map((item) =>
          api.post<Item>(`/items/${item.id}/mark-bought`, { boughtDate: date }).then((r) => r.data)
        )
      )
    },
    onSuccess: (updatedItems) => {
      queryClient.setQueryData<Item[]>(['items', categoryFilter], (prev) =>
        prev?.map((i) => updatedItems.find((u) => u.id === i.id) ?? i) ?? []
      )
      queryClient.invalidateQueries({ queryKey: ['forecast'] })
      setMarkBoughtItems([])
      setSelectedIds(new Set())
      setSelectMode(false)
      showToast(
        updatedItems.length === 1
          ? `${updatedItems[0].name} marked as bought`
          : `${updatedItems.length} items marked as bought`
      )
    },
  })

  function openMarkBought(items: Item[]) {
    setMarkBoughtDate(new Date().toISOString().split('T')[0])
    setMarkBoughtItems(items)
  }

  function confirmMarkBought() {
    if (!markBoughtItems.length || !markBoughtDate) return
    markBoughtMutation.mutate({ items: markBoughtItems, date: markBoughtDate })
  }

  const markConsumedMutation = useMutation({
    mutationFn: async ({ items, date }: { items: Item[]; date: string }) => {
      if (MOCK_AUTH) return items.map((item) => ({ ...item, currentQuantity: 0 } as Item))
      return Promise.all(
        items.map((item) =>
          api
            .post<Item>(`/items/${item.id}/consumed`, {
              quantityConsumed: item.currentQuantity,
              depletedAt: date,
            })
            .then((r) => r.data)
        )
      )
    },
    onSuccess: (updatedItems) => {
      queryClient.setQueryData<Item[]>(['items', categoryFilter], (prev) =>
        prev?.map((i) => updatedItems.find((u) => u.id === i.id) ?? i) ?? []
      )
      queryClient.invalidateQueries({ queryKey: ['forecast'] })
      setMarkConsumedItems([])
      setSelectedIds(new Set())
      setSelectMode(false)
      showToast(
        updatedItems.length === 1
          ? `${updatedItems[0].name} marked as finished`
          : `${updatedItems.length} items marked as finished`
      )
    },
  })

  function openMarkConsumed(items: Item[]) {
    setMarkConsumedDate(new Date().toISOString().split('T')[0])
    setMarkConsumedItems(items)
  }

  function confirmMarkConsumed() {
    if (!markConsumedItems.length || !markConsumedDate) return
    markConsumedMutation.mutate({ items: markConsumedItems, date: markConsumedDate })
  }

  function toggleSelectMode() {
    setSelectMode((v) => !v)
    setSelectedIds(new Set())
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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
        <button
          onClick={toggleSelectMode}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap shrink-0',
            selectMode
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
          )}
        >
          <CheckSquare className="w-4 h-4" />
          <span className="hidden sm:inline">{selectMode ? 'Cancel' : 'Select'}</span>
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
              onMarkBought={() => openMarkBought([item])}
              onMarkConsumed={() => openMarkConsumed([item])}
              selectMode={selectMode}
              selected={selectedIds.has(item.id)}
              onSelect={() => toggleSelect(item.id)}
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

      {/* Bulk select action bar */}
      {selectMode && (
        <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 z-30 flex items-center justify-between gap-3 bg-white border-t border-gray-200 px-4 py-3 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 font-medium">
              {selectedIds.size === 0 ? 'Select items' : `${selectedIds.size} selected`}
            </span>
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
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={toggleSelectMode}>Cancel</Button>
            <Button
              size="sm"
              variant="outline"
              disabled={selectedIds.size === 0}
              className="border-purple-200 text-purple-700 hover:bg-purple-50 disabled:opacity-40"
              onClick={() => {
                const selected = items.filter((i) => selectedIds.has(i.id))
                openMarkConsumed(selected)
              }}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Finished</span>
            </Button>
            <Button
              size="sm"
              disabled={selectedIds.size === 0}
              onClick={() => {
                const selected = items.filter((i) => selectedIds.has(i.id))
                openMarkBought(selected)
              }}
            >
              <ShoppingCart className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Mark as bought</span>
            </Button>
          </div>
        </div>
      )}

      {/* Mark as bought dialog */}
      {markBoughtItems.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMarkBoughtItems([])} />
          <div className="relative bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mb-4 mx-auto">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 text-center mb-1">Mark as bought</h2>
            <p className="text-sm text-gray-500 text-center mb-4">
              {markBoughtItems.length === 1
                ? <span className="font-medium text-gray-800">{markBoughtItems[0].name}</span>
                : <span className="font-medium text-gray-800">{markBoughtItems.length} products</span>
              }
            </p>
            <div className="space-y-1.5 mb-5">
              <label className="text-sm font-medium text-gray-700">Purchase date</label>
              <input
                type="date"
                value={markBoughtDate}
                onChange={(e) => setMarkBoughtDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setMarkBoughtItems([])}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                disabled={!markBoughtDate || markBoughtMutation.isPending}
                onClick={confirmMarkBought}
              >
                {markBoughtMutation.isPending ? 'Saving…' : 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Mark as consumed dialog */}
      {markConsumedItems.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMarkConsumedItems([])} />
          <div className="relative bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-purple-100 mb-4 mx-auto">
              <CheckCircle2 className="w-5 h-5 text-purple-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 text-center mb-1">Mark as finished?</h2>
            <p className="text-sm text-gray-500 text-center mb-4">
              {markConsumedItems.length === 1 ? (
                <><span className="font-medium text-gray-800">{markConsumedItems[0].name}</span> will be marked as fully consumed.</>
              ) : (
                <><span className="font-medium text-gray-800">{markConsumedItems.length} products</span> will be marked as fully consumed.</>
              )}
            </p>
            <div className="space-y-1.5 mb-5">
              <label className="text-sm font-medium text-gray-700">Finished on</label>
              <input
                type="date"
                value={markConsumedDate}
                onChange={(e) => setMarkConsumedDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setMarkConsumedItems([])}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                disabled={!markConsumedDate || markConsumedMutation.isPending}
                onClick={confirmMarkConsumed}
              >
                {markConsumedMutation.isPending ? 'Saving…' : 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  )
}
