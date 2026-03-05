import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Trash2 } from 'lucide-react'
import api from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { mockItems, mockStores } from '@/lib/mockData'
import type { Item, UpdateItemRequest, ConsumerCategory, Store } from '@/types/api'

const MOCK_AUTH = import.meta.env.VITE_MOCK_AUTH === 'true'



const CONSUMER_CATEGORY_LABELS: Record<ConsumerCategory, string> = {
  ADULT: 'Adults',
  CHILD: 'Children',
  CAT: 'Cats',
  DOG: 'Dogs',
  PARROT: 'Parrots',
  SMALL_ANIMAL: 'Small Animals',
}

interface FormState {
  name: string
  currentQuantity: string
  unit: string
  lastBoughtDate: string
  storeId: string
  consumerCategory: ConsumerCategory | ''
  price: string
  daysToRestock: string
  autoCalc: boolean
  standardPurchaseQuantity: string
}

function itemToForm(item: Item): FormState {
  return {
    name: item.name,
    currentQuantity: String(item.currentQuantity),
    unit: item.unit,
    lastBoughtDate: item.lastBoughtDate ?? '',
    storeId: item.storeId ?? '',
    consumerCategory: item.consumerCategory ?? '',
    price: item.price != null ? String(item.price) : '',
    daysToRestock: item.daysToRestock != null ? String(Math.round(item.daysToRestock)) : '',
    autoCalc: item.autoCalc ?? true,
    standardPurchaseQuantity: item.standardPurchaseQuantity != null ? String(item.standardPurchaseQuantity) : '',
  }
}

function DeleteDialog({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4 mx-auto">
          <Trash2 className="w-5 h-5 text-red-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 text-center mb-1">Delete product?</h2>
        <p className="text-sm text-gray-500 text-center mb-6">
          <span className="font-medium text-gray-800">{name}</span> will be removed permanently.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={onConfirm}>Delete</Button>
        </div>
      </div>
    </div>
  )
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormState | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const { data: item, isLoading } = useQuery<Item>({
    queryKey: ['items', id],
    queryFn: MOCK_AUTH
      ? () => {
          const found = mockItems.find((i) => i.id === id)
          if (!found) throw new Error('Not found')
          return Promise.resolve(found)
        }
      : () => api.get<Item>(`/items/${id}`).then((r) => r.data),
    enabled: !!id,
  })

  const { data: stores = [] } = useQuery<Store[]>({
    queryKey: ['stores'],
    queryFn: MOCK_AUTH
      ? () => Promise.resolve(mockStores)
      : () => api.get<Store[]>('/stores').then((r) => r.data),
  })

  useEffect(() => {
    if (item && !form) setForm(itemToForm(item))
  }, [item, form])

  const saveMutation = useMutation({
    mutationFn: (req: UpdateItemRequest) => {
      if (MOCK_AUTH) return Promise.resolve({ ...item!, ...req } as Item)
      return api.put<Item>(`/items/${id}`, req).then((r) => r.data)
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<Item>(['items', id], updated)
      queryClient.invalidateQueries({ queryKey: ['items'] })
      queryClient.invalidateQueries({ queryKey: ['forecast'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      navigate('/products')
    },
    onError: () => setSaveError('Failed to save. Please try again.'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (MOCK_AUTH) return Promise.resolve()
      return api.delete(`/items/${id}`).then(() => {})
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
      queryClient.invalidateQueries({ queryKey: ['forecast'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      navigate('/products')
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    setSaveError(null)
    const req: UpdateItemRequest = {
      name: form.name.trim(),
      currentQuantity: parseFloat(form.currentQuantity) || 0,
      unit: form.unit.trim(),
      ...(form.lastBoughtDate ? { lastBoughtDate: form.lastBoughtDate } : {}),
      ...(form.storeId ? { storeId: form.storeId } : {}),
      ...(form.consumerCategory ? { consumerCategory: form.consumerCategory as ConsumerCategory } : {}),
      ...(form.price ? { price: parseFloat(form.price) } : {}),
      ...(form.daysToRestock ? { daysToRestock: parseInt(form.daysToRestock, 10) } : {}),
      autoCalc: form.autoCalc,
      ...(form.standardPurchaseQuantity
        ? { standardPurchaseQuantity: parseFloat(form.standardPurchaseQuantity) }
        : {}),
    }
    saveMutation.mutate(req)
  }

  if (isLoading || !form) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <div className="h-8 w-32 bg-gray-100 rounded animate-pulse" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (!item) {
    return <p className="text-center text-gray-400 py-16">Product not found.</p>
  }

  return (
    <div className="max-w-lg mx-auto pb-8">
      {/* Back */}
      <button
        onClick={() => navigate('/products')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-6 -ml-1"
      >
        <ArrowLeft className="w-4 h-4" />
        Products
      </button>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div className="space-y-1.5">
          <Label htmlFor="name">Name <span className="text-red-500">*</span></Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => setForm((p) => p && ({ ...p, name: e.target.value }))}
            placeholder="e.g. Oat Milk"
            required
          />
        </div>

        {/* Quantity + Unit */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="qty">Quantity <span className="text-red-500">*</span></Label>
            <Input
              id="qty"
              type="number"
              min="0"
              step="any"
              value={form.currentQuantity}
              onChange={(e) => setForm((p) => p && ({ ...p, currentQuantity: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="unit">Unit</Label>
            <div
              id="unit"
              className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-700"
            >
              <span className="flex-1">{form.unit}</span>
              <span className="text-xs text-gray-400">locked</span>
            </div>
          </div>
        </div>

        {/* Last bought */}
        <div className="space-y-1.5">
          <Label htmlFor="lastBoughtDate">Last bought</Label>
          <Input
            id="lastBoughtDate"
            type="date"
            value={form.lastBoughtDate}
            onChange={(e) => setForm((p) => p && ({ ...p, lastBoughtDate: e.target.value }))}
            max={new Date().toISOString().split('T')[0]}
          />
        </div>

        {/* Store */}
        <div className="space-y-1.5">
          <Label htmlFor="store">Store</Label>
          <select
            id="store"
            value={form.storeId}
            onChange={(e) => setForm((p) => p && ({ ...p, storeId: e.target.value }))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— Not specified —</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="border-t border-gray-100" />

        {/* Consumed by */}
        <div className="space-y-1.5">
          <Label htmlFor="consumer">Consumed by</Label>
          <select
            id="consumer"
            value={form.consumerCategory}
            onChange={(e) => setForm((p) => p && ({ ...p, consumerCategory: e.target.value as ConsumerCategory | '' }))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— Not specified —</option>
            {(Object.entries(CONSUMER_CATEGORY_LABELS) as [ConsumerCategory, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        {/* Price */}
        <div className="space-y-1.5">
          <Label htmlFor="price">Price</Label>
          <Input
            id="price"
            type="number"
            min="0"
            step="any"
            value={form.price}
            onChange={(e) => setForm((p) => p && ({ ...p, price: e.target.value }))}
            placeholder="0.00"
          />
        </div>

        {/* Standard purchase quantity */}
        <div className="space-y-1.5">
          <Label htmlFor="stdQty">Standard purchase quantity</Label>
          <div className="flex items-center gap-2">
            <Input
              id="stdQty"
              type="number"
              min="0"
              step="any"
              value={form.standardPurchaseQuantity}
              onChange={(e) => setForm((p) => p && ({ ...p, standardPurchaseQuantity: e.target.value }))}
              placeholder={form.currentQuantity || '1'}
              className="flex-1"
            />
            <span className="text-sm text-gray-500 shrink-0">{form.unit}</span>
          </div>
          <p className="text-xs text-gray-400">How much you typically buy in one trip</p>
        </div>

        {/* Days to restock */}
        <div className="space-y-1.5">
          <Label htmlFor="daysToRestock">Days to restock</Label>
          <Input
            id="daysToRestock"
            type="number"
            min="0"
            step="1"
            value={form.daysToRestock}
            onChange={(e) => setForm((p) => p && ({ ...p, daysToRestock: e.target.value }))}
            placeholder="e.g. 7"
          />
          <p className="text-xs text-gray-400">How many days until you need to buy this again</p>
        </div>

        {form.daysToRestock && (
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-medium text-gray-700">Adapt to real usage</p>
              <p className="text-xs text-gray-400">
                {form.autoCalc
                  ? 'Recalculates rate from actual buy/deplete events'
                  : 'Always uses this fixed estimate'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setForm((p) => p && ({ ...p, autoCalc: !p.autoCalc }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                form.autoCalc ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  form.autoCalc ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        )}

        {saveError && <p className="text-sm text-red-500">{saveError}</p>}

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button type="submit" className="flex-1" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </form>

      {showDeleteDialog && (
        <DeleteDialog
          name={item.name}
          onConfirm={() => deleteMutation.mutate()}
          onCancel={() => setShowDeleteDialog(false)}
        />
      )}
    </div>
  )
}
