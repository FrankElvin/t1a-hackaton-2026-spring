import { useState, useRef, useCallback, useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'
import keycloak from '@/lib/keycloak'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { mockStores, mockItems } from '@/lib/mockData'
import type {
  ItemCategory,
  ConsumerCategory,
  Item,
  CreateItemRequest,
  ImportBatchResponse,
  ParsedProductDto,
  MatchSuggestion,
  Store,
} from '@/types/api'

const MOCK_AUTH = import.meta.env.VITE_MOCK_AUTH === 'true'

type Method = 'manual' | 'receipt' | 'email' | 'barcode'

interface FormState {
  name: string
  currentQuantity: string
  unit: string
  lastBoughtDate: string
  storeId: string
  category: ItemCategory | ''
  consumerCategory: ConsumerCategory | ''
  price: string
  monthlyConsumptionRate: string
  autoCalc: boolean
  forecasting: boolean
}

const EMPTY_FORM: FormState = {
  name: '',
  currentQuantity: '1',
  unit: 'pcs',
  lastBoughtDate: new Date().toISOString().split('T')[0],
  storeId: '',
  category: '',
  consumerCategory: '',
  price: '',
  monthlyConsumptionRate: '',
  autoCalc: false,
  forecasting: false,
}

const UNIT_PRESETS = ['pcs', 'kg', 'g', 'L', 'ml', 'pack', 'box', 'bottle', 'bag', 'roll']

const ITEM_CATEGORY_LABELS: Record<ItemCategory, string> = {
  FOOD: 'Food',
  BEVERAGES: 'Beverages',
  CLEANING: 'Cleaning',
  PERSONAL_CARE: 'Personal Care',
  PET_FOOD: 'Pet Food',
  MEDICINE: 'Medicine',
  OTHER: 'Other',
}

const CONSUMER_CATEGORY_LABELS: Record<ConsumerCategory, string> = {
  ADULT: 'Adults',
  CHILD: 'Children',
  CAT: 'Cats',
  DOG: 'Dogs',
  PARROT: 'Parrots',
  SMALL_ANIMAL: 'Small Animals',
}

// BarcodeDetector is not yet in TypeScript's DOM lib
declare class BarcodeDetector {
  constructor(options?: { formats: string[] })
  detect(image: ImageBitmapSource): Promise<Array<{ rawValue: string; format: string }>>
  static getSupportedFormats(): Promise<string[]>
}

interface LogEntry {
  time: string
  text: string
  type: 'info' | 'success' | 'error'
}

interface BarcodeProductPreview {
  name: string
  brand: string
  imageUrl: string | null
  barcode: string
  quantity: string
  unit: string
}

const SELECT_CLASS =
  'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

interface ProductFormFieldsProps {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  stores: Store[]
  showAdditional: boolean
  setShowAdditional: React.Dispatch<React.SetStateAction<boolean>>
  idPrefix?: string
  excludeFields?: ('name' | 'qty' | 'unit' | 'lastBoughtDate' | 'store' | 'additional')[]
}

function ProductFormFields({
  form,
  setForm,
  stores,
  showAdditional,
  setShowAdditional,
  idPrefix = '',
  excludeFields = [],
}: ProductFormFieldsProps) {
  const id = (name: string) => (idPrefix ? `${idPrefix}-${name}` : name)
  return (
    <>
      {!excludeFields.includes('name') && (
      <div className="space-y-1.5">
        <Label htmlFor={id('name')}>Name <span className="text-red-500">*</span></Label>
        <Input
          id={id('name')}
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          placeholder="e.g. Oat Milk"
          required
        />
      </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={id('qty')}>Quantity <span className="text-red-500">*</span></Label>
          <Input
            id={id('qty')}
            type="number"
            min="0"
            step="any"
            value={form.currentQuantity}
            onChange={(e) => setForm((p) => ({ ...p, currentQuantity: e.target.value }))}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id('unit')}>Unit <span className="text-red-500">*</span></Label>
          <Input
            id={id('unit')}
            value={form.unit}
            onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
            placeholder="pcs, kg, L…"
            required
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {UNIT_PRESETS.map((u) => (
          <button
            key={u}
            type="button"
            onClick={() => setForm((p) => ({ ...p, unit: u }))}
            className={`px-2.5 py-0.5 rounded-full text-xs border transition-colors ${
              form.unit === u
                ? 'bg-blue-500 text-white border-blue-500'
                : 'border-gray-300 text-gray-600 hover:border-gray-400'
            }`}
          >
            {u}
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={id('lastBoughtDate')}>Last bought</Label>
        <Input
          id={id('lastBoughtDate')}
          type="date"
          value={form.lastBoughtDate}
          onChange={(e) => setForm((p) => ({ ...p, lastBoughtDate: e.target.value }))}
          max={new Date().toISOString().split('T')[0]}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={id('store')}>Store</Label>
        <select
          id={id('store')}
          value={form.storeId}
          onChange={(e) => setForm((p) => ({ ...p, storeId: e.target.value }))}
          className={SELECT_CLASS}
        >
          <option value="">— Not specified —</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdditional((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span>Additional details</span>
          <span className="flex items-center gap-2">
            {!showAdditional && (
              <span className="text-xs text-gray-400 font-normal">
                {[
                  form.category ? ITEM_CATEGORY_LABELS[form.category as ItemCategory] : null,
                  form.consumerCategory
                    ? CONSUMER_CATEGORY_LABELS[form.consumerCategory as ConsumerCategory]
                    : null,
                  form.price ? `$${form.price}` : null,
                  form.monthlyConsumptionRate ? `${form.monthlyConsumptionRate}/mo` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'optional'}
              </span>
            )}
            <span className="text-gray-400">{showAdditional ? '▲' : '▼'}</span>
          </span>
        </button>
        {showAdditional && (
          <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-4">
            <div className="space-y-1.5">
              <Label htmlFor={id('category')}>Category</Label>
              <select
                id={id('category')}
                value={form.category}
                onChange={(e) =>
                  setForm((p) => ({ ...p, category: e.target.value as ItemCategory | '' }))
                }
                className={SELECT_CLASS}
              >
                <option value="">— Not specified —</option>
                {(Object.entries(ITEM_CATEGORY_LABELS) as [ItemCategory, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={id('consumer')}>Consumed by</Label>
              <select
                id={id('consumer')}
                value={form.consumerCategory}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    consumerCategory: e.target.value as ConsumerCategory | '',
                  }))
                }
                className={SELECT_CLASS}
              >
                <option value="">— Not specified —</option>
                {(Object.entries(CONSUMER_CATEGORY_LABELS) as [ConsumerCategory, string][]).map(
                  ([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  )
                )}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={id('price')}>Price</Label>
              <Input
                id={id('price')}
                type="number"
                min="0"
                step="any"
                value={form.price}
                onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={id('rate')}>Monthly usage</Label>
              <Input
                id={id('rate')}
                type="number"
                min="0"
                step="any"
                value={form.monthlyConsumptionRate}
                onChange={(e) =>
                  setForm((p) => ({ ...p, monthlyConsumptionRate: e.target.value }))
                }
                placeholder="e.g. 4"
              />
            </div>
            {form.monthlyConsumptionRate ? (
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium text-gray-700">Adapt to real usage</p>
                  <p className="text-xs text-gray-400">
                    {form.autoCalc
                      ? 'Starts with this rate, adjusts based on actual purchases'
                      : 'Always uses exactly this rate for forecasting'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, autoCalc: !p.autoCalc }))}
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
            ) : (
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                    Enable forecasting
                  </p>
                  <p className="text-xs text-gray-400">
                    {form.forecasting
                      ? 'AI will estimate your consumption rate'
                      : 'No forecast — notifications disabled, updates after real usage'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, forecasting: !p.forecasting }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    form.forecasting ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      form.forecasting ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

type ReviewProductMode = 'choose' | 'existing' | 'new'

interface ReviewProductFormProps {
  parsed: ParsedProductDto
  batchStoreId?: string
  mode: ReviewProductMode
  setMode: (m: ReviewProductMode) => void
  selectedExistingItem: Item | null
  setSelectedExistingItem: (i: Item | null) => void
  matchSuggestions: MatchSuggestion[]
  matchSuggestionsLoading: boolean
  items: Item[]
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  stores: Store[]
  showAdditional: boolean
  setShowAdditional: React.Dispatch<React.SetStateAction<boolean>>
  saveError: string | null
  onBack: () => void
  onSave: (req?: CreateItemRequest) => void
  onSkip: () => void
  onDone: () => void
  progress: string
}

function ReviewProductForm({
  parsed,
  batchStoreId,
  mode,
  setMode,
  selectedExistingItem,
  setSelectedExistingItem,
  matchSuggestions,
  matchSuggestionsLoading,
  items,
  form,
  setForm,
  stores,
  showAdditional,
  setShowAdditional,
  saveError,
  onBack,
  onSave,
  onSkip,
  onDone,
  progress,
}: ReviewProductFormProps) {
  const [nameSuggestionsOpen, setNameSuggestionsOpen] = useState(false)
  const nameInputRef = useRef<HTMLInputElement | null>(null)

  const filteredNameSuggestions = form.name.trim()
    ? items.filter((i) =>
        i.name.toLowerCase().includes(form.name.toLowerCase().trim())
      ).slice(0, 6)
    : []

  function prefillFromParsed(p: ParsedProductDto, storeId?: string) {
    setForm((prev) => ({
      ...prev,
      name: p.name,
      currentQuantity: String(p.quantity),
      unit: p.unit || 'pcs',
      ...(p.priceAmount != null ? { price: String(p.priceAmount) } : {}),
      ...(p.category ? { category: p.category } : {}),
      ...(p.monthlyConsumptionRate != null
        ? { monthlyConsumptionRate: String(p.monthlyConsumptionRate) }
        : {}),
      ...(storeId ? { storeId } : {}),
    }))
  }

  return (
    <div role="tabpanel" className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-gray-500 hover:text-gray-700"
          data-testid="review-back"
        >
          ← Back
        </button>
        <span className="text-sm text-gray-500">{progress}</span>
      </div>
      <p className="text-sm text-gray-600">
        Review each product and save to your inventory, or skip.
      </p>

      {mode === 'choose' && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">
            &quot;{parsed.name}&quot; — link to existing or create new?
          </p>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => {
                setMode('new')
                prefillFromParsed(parsed, batchStoreId)
              }}
              className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50"
            >
              + Create new: {parsed.name}
            </button>
            {matchSuggestionsLoading && (
              <p className="text-sm text-gray-400 p-2">Loading suggestions…</p>
            )}
            {matchSuggestions.map((s) => {
              const item = items.find((i) => i.id === s.itemId)
              if (!item) return null
              return (
                <button
                  key={s.itemId}
                  type="button"
                  onClick={() => {
                    setSelectedExistingItem(item)
                    setMode('existing')
                    setForm((p) => ({ ...p, currentQuantity: String(parsed.quantity) }))
                  }}
                  className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 flex justify-between"
                >
                  <span>{item.name}</span>
                  <span className="text-xs text-gray-400">
                    {item.currentQuantity} {item.unit}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onSkip}>
              Skip
            </Button>
            <Button variant="outline" className="flex-1" onClick={onDone}>
              Done
            </Button>
          </div>
        </div>
      )}

      {mode === 'existing' && selectedExistingItem && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSave()
          }}
          className="space-y-4"
        >
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
            <p className="text-sm font-medium text-blue-900">{selectedExistingItem.name}</p>
            <p className="text-xs text-blue-700">
              Current: {selectedExistingItem.currentQuantity} {selectedExistingItem.unit}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="review-qty">Quantity to add</Label>
            <Input
              id="review-qty"
              type="number"
              min="0"
              step="any"
              value={form.currentQuantity}
              onChange={(e) => setForm((p) => ({ ...p, currentQuantity: e.target.value }))}
              required
            />
          </div>
          {saveError && <p className="text-sm text-red-500">{saveError}</p>}
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">
              Save & Next
            </Button>
            <Button type="button" variant="outline" onClick={onSkip}>
              Skip
            </Button>
            <Button type="button" variant="outline" onClick={onDone}>
              Done
            </Button>
          </div>
        </form>
      )}

      {mode === 'new' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const req: CreateItemRequest = {
              name: form.name.trim(),
              currentQuantity: parseFloat(form.currentQuantity) || 0,
              unit: form.unit.trim(),
              ...(form.storeId ? { storeId: form.storeId } : {}),
              ...(form.category ? { category: form.category as ItemCategory } : {}),
              ...(form.consumerCategory ? { consumerCategory: form.consumerCategory as ConsumerCategory } : {}),
              ...(form.price ? { price: parseFloat(form.price) } : {}),
              ...(form.monthlyConsumptionRate
                ? { monthlyConsumptionRate: parseFloat(form.monthlyConsumptionRate) }
                : {}),
              autoCalc: form.monthlyConsumptionRate ? form.autoCalc : true,
            }
            onSave(req)
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5 relative">
            <Label htmlFor="review-name">Name <span className="text-red-500">*</span></Label>
            <Input
              id="review-name"
              ref={(el) => { nameInputRef.current = el }}
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              onFocus={() => setNameSuggestionsOpen(true)}
              onBlur={() => setTimeout(() => setNameSuggestionsOpen(false), 150)}
              placeholder="e.g. Oat Milk"
              required
            />
            {nameSuggestionsOpen && filteredNameSuggestions.length > 0 && (
              <div className="absolute z-10 top-full left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-48 overflow-auto">
                {filteredNameSuggestions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedExistingItem(item)
                      setMode('existing')
                      setForm((p) => ({
                        ...p,
                        name: item.name,
                        currentQuantity: String(parsed.quantity),
                      }))
                      setNameSuggestionsOpen(false)
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                  >
                    {item.name}
                    <span className="text-xs text-gray-400 ml-2">
                      {item.currentQuantity} {item.unit}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <ProductFormFields
            form={form}
            setForm={setForm}
            stores={stores}
            showAdditional={showAdditional}
            setShowAdditional={setShowAdditional}
            idPrefix="review"
            excludeFields={['name']}
          />
          {saveError && <p className="text-sm text-red-500">{saveError}</p>}
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">
              Save & Next
            </Button>
            <Button type="button" variant="outline" onClick={onSkip}>
              Skip
            </Button>
            <Button type="button" variant="outline" onClick={onDone}>
              Done
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}

function ProgressConsole({ log, isProcessing }: { log: LogEntry[]; isProcessing: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [log])

  if (log.length === 0) return null

  return (
    <div
      ref={containerRef}
      className="bg-gray-900 rounded-xl p-4 font-mono text-xs max-h-56 overflow-y-auto space-y-1 border border-gray-700"
    >
      {log.map((entry, i) => (
        <div key={i} className="flex gap-2">
          <span className="text-gray-500 shrink-0">{entry.time}</span>
          <span
            className={
              entry.type === 'success'
                ? 'text-green-400'
                : entry.type === 'error'
                  ? 'text-red-400'
                  : 'text-gray-300'
            }
          >
            {entry.text}
          </span>
        </div>
      ))}
      {isProcessing && (
        <div className="flex gap-2">
          <span className="text-gray-500 shrink-0">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
          <span className="text-blue-400 animate-pulse">Processing...</span>
        </div>
      )}
    </div>
  )
}

function timeStamp(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  if (MOCK_AUTH) return {}
  try {
    await keycloak.updateToken(30)
  } catch {
    keycloak.login()
    throw new Error('Token expired')
  }
  return { Authorization: `Bearer ${keycloak.token}` }
}

async function mockParseReceipt(
  _formData: FormData,
  onProgress: (msg: string) => void
): Promise<ImportBatchResponse> {
  onProgress('Mock: Extracting text from receipt...')
  await new Promise((r) => setTimeout(r, 300))
  onProgress('Mock: AI identified 3 products')
  onProgress('Import batch ready: 3 products to review')
  return {
    id: crypto.randomUUID(),
    source: 'RECEIPT',
    storeId: 's1',
    parsedProducts: [
      { index: 1, name: 'Mleko świeże 2%', quantity: 2, unit: 'L', category: 'BEVERAGES', monthlyConsumptionRate: 12 },
      { index: 2, name: 'Chleb razowy', quantity: 1, unit: 'pcs', category: 'FOOD', monthlyConsumptionRate: 12 },
      { index: 3, name: 'Jajka 10 szt', quantity: 1, unit: 'pcs', category: 'FOOD', monthlyConsumptionRate: 4 },
    ],
    unrecognizedLines: [],
    createdAt: new Date().toISOString(),
  }
}

async function mockParseEmail(
  _content: string,
  onProgress: (msg: string) => void
): Promise<ImportBatchResponse> {
  onProgress('Mock: Parsing email...')
  await new Promise((r) => setTimeout(r, 300))
  onProgress('Mock: AI identified 2 products')
  onProgress('Import batch ready: 2 products to review')
  return {
    id: crypto.randomUUID(),
    source: 'EMAIL',
    parsedProducts: [
      { index: 1, name: 'Organic Oat Milk', quantity: 2, unit: 'L', category: 'BEVERAGES', monthlyConsumptionRate: 8 },
      { index: 2, name: 'Whole Grain Bread', quantity: 1, unit: 'pcs', category: 'FOOD', monthlyConsumptionRate: 10 },
    ],
    unrecognizedLines: [],
    createdAt: new Date().toISOString(),
  }
}

async function streamParseImport(
  url: string,
  body: FormData | string,
  contentType: 'multipart' | 'json',
  onProgress: (msg: string) => void
): Promise<ImportBatchResponse> {
  const headers = await getAuthHeaders()
  if (contentType === 'json') {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: contentType === 'json' ? body : (body as FormData),
  })

  if (!response.ok) {
    throw new Error(`Parse failed: ${response.status}`)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result: ImportBatchResponse | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    let eventName = ''
    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim()
      } else if (line.startsWith('data:')) {
        const data = line.slice(5)
        if (eventName === 'progress') {
          onProgress(data)
        } else if (eventName === 'result') {
          result = JSON.parse(data)
        } else if (eventName === 'error') {
          throw new Error(data)
        }
        eventName = ''
      }
    }
  }

  if (!result) throw new Error('No result received from server')
  return result
}

export default function AddProductPage() {
  const navigate = useNavigate()
  const [method, setMethod] = useState<Method>('manual')
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [prefillBanner, setPrefillBanner] = useState<string | null>(null)
  const [barcodeProductPreview, setBarcodeProductPreview] = useState<BarcodeProductPreview | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showAdditional, setShowAdditional] = useState(false)

  const { data: stores = [] } = useQuery<Store[]>({
    queryKey: ['stores'],
    queryFn: MOCK_AUTH
      ? () => Promise.resolve(mockStores)
      : () => api.get<Store[]>('/stores').then((r) => r.data),
  })

  // Receipt state
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [receiptProcessing, setReceiptProcessing] = useState(false)
  const [receiptLog, setReceiptLog] = useState<LogEntry[]>([])
  const [receiptError, setReceiptError] = useState<string | null>(null)
  const receiptInputRef = useRef<HTMLInputElement>(null)

  // Email state
  const [emailContent, setEmailContent] = useState('')
  const [emailProcessing, setEmailProcessing] = useState(false)
  const [emailLog, setEmailLog] = useState<LogEntry[]>([])
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailCopied, setEmailCopied] = useState(false)

  const { data: forwardEmailData } = useQuery<{ forwardEmail: string }>({
    queryKey: ['settings', 'forward-email'],
    queryFn: () => api.get<{ forwardEmail: string }>('/settings/forward-email').then((r) => r.data),
    enabled: !MOCK_AUTH,
  })

  const { data: importBatches = [], refetch: refetchBatches } = useQuery<ImportBatchResponse[]>({
    queryKey: ['import-batches'],
    queryFn: MOCK_AUTH
      ? () => Promise.resolve([])
      : () => api.get<ImportBatchResponse[]>('/import-batches').then((r) => r.data),
    enabled: method === 'receipt' || method === 'email',
  })

  // Review flow: batch being reviewed, current product index
  const [reviewBatch, setReviewBatch] = useState<ImportBatchResponse | null>(null)
  const [reviewIndex, setReviewIndex] = useState(0)

  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ['items'],
    queryFn: MOCK_AUTH
      ? () => Promise.resolve(mockItems)
      : () => api.get<Item[]>('/items').then((r) => r.data),
    enabled: !!reviewBatch,
  })

  type ReviewProductMode = 'choose' | 'existing' | 'new'
  const [reviewProductMode, setReviewProductMode] = useState<ReviewProductMode>('choose')
  const [selectedExistingItem, setSelectedExistingItem] = useState<Item | null>(null)
  const [matchSuggestions, setMatchSuggestions] = useState<MatchSuggestion[]>([])
  const [matchSuggestionsLoading, setMatchSuggestionsLoading] = useState(false)
  const FORWARD_EMAIL =
    forwardEmailData?.forwardEmail ??
    import.meta.env.VITE_FORWARD_EMAIL ??
    'inbox@neverempty.app'

  // Barcode state
  const videoRef = useRef<HTMLVideoElement>(null)
  const [scanning, setScanning] = useState(false)
  const [barcodeSupported, setBarcodeSupported] = useState<boolean | null>(null)
  const [barcodeError, setBarcodeError] = useState<string | null>(null)
  const [manualBarcode, setManualBarcode] = useState('')
  const [lookingUp, setLookingUp] = useState(false)
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    setBarcodeSupported('BarcodeDetector' in window)
  }, [])

  useEffect(() => {
    if (!reviewBatch || reviewIndex >= reviewBatch.parsedProducts.length) return
    const parsed = reviewBatch.parsedProducts[reviewIndex]
    const exact = items.find(
      (i) => i.name.toLowerCase().trim() === parsed.name.toLowerCase().trim()
    )
    if (exact) {
      setReviewProductMode('existing')
      setSelectedExistingItem(exact)
      setForm((p) => ({ ...p, currentQuantity: String(parsed.quantity) }))
      setMatchSuggestions([])
      return
    }
    setSelectedExistingItem(null)
    if (items.length === 0) {
      setReviewProductMode('new')
      prefillFromParsed(parsed, reviewBatch.storeId)
      setMatchSuggestions([])
      return
    }
    setReviewProductMode('choose')
    setMatchSuggestionsLoading(true)
    if (MOCK_AUTH) {
      setMatchSuggestions([])
      setMatchSuggestionsLoading(false)
      prefillFromParsed(parsed, reviewBatch.storeId)
      return
    }
    api
      .post<MatchSuggestion[]>('/items/suggest-matches', { productName: parsed.name })
      .then((r) => {
        setMatchSuggestions(r.data)
        prefillFromParsed(parsed, reviewBatch.storeId)
      })
      .catch(() => setMatchSuggestions([]))
      .finally(() => setMatchSuggestionsLoading(false))
  }, [reviewBatch, reviewIndex, items])

  const stopScanning = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setScanning(false)
  }, [])

  useEffect(() => {
    return () => stopScanning()
  }, [stopScanning])

  async function startScanning() {
    setBarcodeError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      setScanning(true)
      const detector = new BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
      })
      scanIntervalRef.current = setInterval(async () => {
        if (!videoRef.current) return
        try {
          const barcodes = await detector.detect(videoRef.current)
          if (barcodes.length > 0) {
            const barcode = barcodes[0].rawValue
            stopScanning()
            await lookupBarcode(barcode)
          }
        } catch {
          // per-frame detection error — continue scanning
        }
      }, 300)
    } catch {
      setBarcodeError('Camera access denied or unavailable. Try typing the barcode below.')
    }
  }

  async function lookupBarcode(barcode: string) {
    setLookingUp(true)
    setBarcodeProductPreview(null)
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`)
      const data = await res.json()
      if (data.status === 1 && data.product) {
        const p = data.product
        const name = p.product_name || p.product_name_en || barcode
        const rawQty: string = p.quantity || ''
        const qtyMatch = rawQty.match(/^([\d.]+)\s*(.*)$/)
        const quantity = qtyMatch ? qtyMatch[1] : '1'
        const unit = qtyMatch && qtyMatch[2] ? qtyMatch[2].trim() : 'pcs'
        const imageUrl =
          p.image_front_small_url ||
          p.image_small_url ||
          p.image_url ||
          p.image_front_url ||
          null
        const brand = p.brands || ''
        setForm((prev) => ({
          ...prev,
          name,
          currentQuantity: quantity,
          unit,
        }))
        setPrefillBanner(`Found: ${name}`)
        setBarcodeProductPreview({
          name,
          brand,
          imageUrl,
          barcode,
          quantity,
          unit,
        })
      } else {
        setForm((prev) => ({ ...prev, name: `Product ${barcode}` }))
        setPrefillBanner(`Barcode ${barcode} not found in database — fill in details manually`)
      }
    } catch {
      setForm((prev) => ({ ...prev, name: `Product ${barcode}` }))
      setPrefillBanner(`Barcode ${barcode} — fill in details manually`)
    }
    setLookingUp(false)
    setMethod('manual')
  }

  // Manual save
  const saveMutation = useMutation({
    mutationFn: (req: CreateItemRequest) => {
      if (MOCK_AUTH) return Promise.resolve({ id: crypto.randomUUID(), ...req } as Item)
      return api.post<Item>('/items', req).then((r) => r.data)
    },
    onSuccess: () => navigate('/products'),
    onError: () => setSaveError('Failed to save. Please try again.'),
  })

  function prefillFromParsed(p: ParsedProductDto, batchStoreId?: string) {
    setForm((prev) => ({
      ...prev,
      name: p.name,
      currentQuantity: String(p.quantity),
      unit: p.unit || 'pcs',
      ...(p.priceAmount != null ? { price: String(p.priceAmount) } : {}),
      ...(p.category ? { category: p.category } : {}),
      ...(p.monthlyConsumptionRate != null
        ? { monthlyConsumptionRate: String(p.monthlyConsumptionRate) }
        : {}),
      ...(batchStoreId ? { storeId: batchStoreId } : {}),
    }))
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaveError(null)
    const req: CreateItemRequest = {
      name: form.name.trim(),
      currentQuantity: parseFloat(form.currentQuantity) || 0,
      unit: form.unit.trim(),
      ...(form.lastBoughtDate ? { lastBoughtDate: form.lastBoughtDate } : {}),
      ...(form.storeId ? { storeId: form.storeId } : {}),
      ...(form.category ? { category: form.category as ItemCategory } : {}),
      ...(form.consumerCategory ? { consumerCategory: form.consumerCategory as ConsumerCategory } : {}),
      ...(form.price ? { price: parseFloat(form.price) } : {}),
      ...(form.monthlyConsumptionRate
        ? { monthlyConsumptionRate: parseFloat(form.monthlyConsumptionRate) }
        : {}),
      autoCalc: form.monthlyConsumptionRate ? form.autoCalc : true,
    }
    saveMutation.mutate(req)
  }

  async function handleReviewSave(req?: CreateItemRequest) {
    setSaveError(null)
    try {
      if (reviewProductMode === 'existing' && selectedExistingItem) {
        const qty = parseFloat(form.currentQuantity) || 0
        if (MOCK_AUTH) {
          await new Promise((r) => setTimeout(r, 300))
        } else {
          await api.post(`/items/${selectedExistingItem.id}/add-quantity`, { quantity: qty })
        }
      } else {
        const r = req ?? {
          name: form.name.trim(),
          currentQuantity: parseFloat(form.currentQuantity) || 0,
          unit: form.unit.trim(),
          ...(form.storeId ? { storeId: form.storeId } : {}),
          ...(form.category ? { category: form.category as ItemCategory } : {}),
          ...(form.consumerCategory ? { consumerCategory: form.consumerCategory as ConsumerCategory } : {}),
          ...(form.price ? { price: parseFloat(form.price) } : {}),
          ...(form.monthlyConsumptionRate
            ? { monthlyConsumptionRate: parseFloat(form.monthlyConsumptionRate) }
            : {}),
          autoCalc: form.monthlyConsumptionRate ? form.autoCalc : true,
        }
        if (MOCK_AUTH) {
          await new Promise((r) => setTimeout(r, 300))
        } else {
          await api.post('/items', r)
        }
      }
      advanceReview()
    } catch {
      setSaveError('Failed to save. Please try again.')
    }
  }

  function advanceReview() {
    if (!reviewBatch) return
    const products = reviewBatch.parsedProducts
    const nextIndex = reviewIndex + 1
    if (nextIndex >= products.length) {
      finishReview()
    } else {
      setReviewIndex(nextIndex)
    }
  }

  function finishReview() {
    if (reviewBatch && !MOCK_AUTH) {
      api.delete(`/import-batches/${reviewBatch.id}`).catch(() => {})
    }
    refetchBatches()
    setReviewBatch(null)
    setReviewIndex(0)
    navigate('/products')
  }

  // Receipt parse with streaming → creates batch for review
  async function handleReceiptImport() {
    if (!receiptFile) return
    setReceiptProcessing(true)
    setReceiptError(null)
    setReceiptLog([{ time: timeStamp(), text: 'Parsing receipt...', type: 'info' }])

    try {
      const formData = new FormData()
      formData.append('image', receiptFile)

      const batch = MOCK_AUTH
        ? await mockParseReceipt(formData, (msg) =>
            setReceiptLog((prev) => [...prev, { time: timeStamp(), text: msg, type: 'info' }])
          )
        : await streamParseImport(
            '/api/v1/items/import/receipt/parse/stream',
            formData,
            'multipart',
            (msg) => {
              const type: LogEntry['type'] =
                msg.includes('ready') ? 'success' : msg.includes('Failed') ? 'error' : 'info'
              setReceiptLog((prev) => [...prev, { time: timeStamp(), text: msg, type }])
            }
          )

      setReceiptLog((prev) => [
        ...prev,
        { time: timeStamp(), text: `${batch.parsedProducts.length} products to review.`, type: 'success' },
      ])
      setReviewBatch(batch)
      setReviewIndex(0)
      refetchBatches()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setReceiptError(msg)
      setReceiptLog((prev) => [...prev, { time: timeStamp(), text: `Error: ${msg}`, type: 'error' }])
    } finally {
      setReceiptProcessing(false)
    }
  }

  function handleReceiptFile(file: File) {
    setReceiptFile(file)
    setReceiptLog([])
    setReceiptError(null)
    setReceiptPreview(URL.createObjectURL(file))
  }

  // Email parse with streaming → creates batch for review
  async function handleEmailImport() {
    if (!emailContent.trim()) return
    setEmailProcessing(true)
    setEmailError(null)
    setEmailLog([{ time: timeStamp(), text: 'Parsing email...', type: 'info' }])

    try {
      const batch = MOCK_AUTH
        ? await mockParseEmail(emailContent, (msg) =>
            setEmailLog((prev) => [...prev, { time: timeStamp(), text: msg, type: 'info' }])
          )
        : await streamParseImport(
            '/api/v1/items/import/email/parse/stream',
            JSON.stringify({ rawEmail: emailContent }),
            'json',
            (msg) => {
              const type: LogEntry['type'] =
                msg.includes('ready') ? 'success' : msg.includes('Failed') ? 'error' : 'info'
              setEmailLog((prev) => [...prev, { time: timeStamp(), text: msg, type }])
            }
          )

      setEmailLog((prev) => [
        ...prev,
        { time: timeStamp(), text: `${batch.parsedProducts.length} products to review.`, type: 'success' },
      ])
      setReviewBatch(batch)
      setReviewIndex(0)
      refetchBatches()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setEmailError(msg)
      setEmailLog((prev) => [...prev, { time: timeStamp(), text: `Error: ${msg}`, type: 'error' }])
    } finally {
      setEmailProcessing(false)
    }
  }

  async function copyEmail() {
    await navigator.clipboard.writeText(FORWARD_EMAIL)
    setEmailCopied(true)
    setTimeout(() => setEmailCopied(false), 2000)
  }

  const methods: { id: Method; icon: string; label: string }[] = [
    { id: 'manual', icon: '✏️', label: 'Manual' },
    { id: 'receipt', icon: '🧾', label: 'Receipt' },
    { id: 'email', icon: '📧', label: 'Email' },
    { id: 'barcode', icon: '🔳', label: 'Barcode' },
  ]

  return (
    <div className="max-w-lg mx-auto pb-8">
      {/* Method selector */}
      <div className="grid grid-cols-4 gap-2 mb-6" role="tablist" aria-label="Add product method">
        {methods.map((m) => (
          <button
            key={m.id}
            role="tab"
            aria-selected={method === m.id}
            aria-controls={`panel-${m.id}`}
            id={`tab-${m.id}`}
            onClick={() => {
              setMethod(m.id)
              stopScanning()
            }}
            className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-colors text-sm font-medium ${
              method === m.id
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            <span className="text-xl">{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>

      {/* ── Manual Entry ── */}
      {method === 'manual' && (
        <div role="tabpanel" id="panel-manual" aria-labelledby="tab-manual">
        <form onSubmit={handleManualSubmit} className="space-y-4">
          {barcodeProductPreview && (
            <div className="relative bg-green-50 border border-green-200 rounded-xl p-4 overflow-hidden">
              <div className="flex gap-4">
                {barcodeProductPreview.imageUrl ? (
                  <img
                    src={barcodeProductPreview.imageUrl}
                    alt={barcodeProductPreview.name}
                    className="w-20 h-20 rounded-lg object-cover shrink-0 bg-white border border-green-200"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-gray-200 flex items-center justify-center shrink-0 text-3xl">
                    📦
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-green-900 truncate">{barcodeProductPreview.name}</p>
                  {barcodeProductPreview.brand && (
                    <p className="text-sm text-green-700 mt-0.5">{barcodeProductPreview.brand}</p>
                  )}
                  <p className="text-xs text-green-600 mt-1">
                    {barcodeProductPreview.quantity} {barcodeProductPreview.unit} · {barcodeProductPreview.barcode}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPrefillBanner(null)
                  setBarcodeProductPreview(null)
                }}
                className="absolute top-2 right-2 p-1 rounded text-green-600 hover:bg-green-100 transition-colors"
                aria-label="Dismiss preview"
              >
                ✕
              </button>
            </div>
          )}
          {prefillBanner && !barcodeProductPreview && (
            <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
              <span>✓</span>
              <span className="flex-1">{prefillBanner}</span>
              <button type="button" onClick={() => setPrefillBanner(null)} className="text-green-500">
                ✕
              </button>
            </div>
          )}

          <ProductFormFields
            form={form}
            setForm={setForm}
            stores={stores}
            showAdditional={showAdditional}
            setShowAdditional={setShowAdditional}
          />

          {saveError && <p className="text-sm text-red-500">{saveError}</p>}

          <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : 'Save Product'}
          </Button>
        </form>
        </div>
      )}

      {/* ── Review batch flow ── */}
      {reviewBatch && (method === 'receipt' || method === 'email') && (
        <ReviewProductForm
          parsed={reviewBatch.parsedProducts[reviewIndex]}
          batchStoreId={reviewBatch.storeId}
          mode={reviewProductMode}
          setMode={setReviewProductMode}
          selectedExistingItem={selectedExistingItem}
          setSelectedExistingItem={setSelectedExistingItem}
          matchSuggestions={matchSuggestions}
          matchSuggestionsLoading={matchSuggestionsLoading}
          items={items}
          form={form}
          setForm={setForm}
          stores={stores}
          showAdditional={showAdditional}
          setShowAdditional={setShowAdditional}
          saveError={saveError}
          onBack={() => {
            setReviewBatch(null)
            setReviewIndex(0)
            setReceiptFile(null)
            setReceiptPreview(null)
            setEmailContent('')
          }}
          onSave={handleReviewSave}
          onSkip={advanceReview}
          onDone={finishReview}
          progress={`${reviewIndex + 1} / ${reviewBatch.parsedProducts.length}`}
        />
      )}

      {/* ── Receipt Photo ── */}
      {method === 'receipt' && !reviewBatch && (
        <div role="tabpanel" id="panel-receipt" aria-labelledby="tab-receipt" className="space-y-4">
          {importBatches.filter((b) => b.source === 'RECEIPT').length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-800">Pending imports</h3>
              <div className="space-y-1">
                {importBatches
                  .filter((b) => b.source === 'RECEIPT')
                  .map((batch) => (
                    <button
                      key={batch.id}
                      type="button"
                      onClick={() => {
                        setReviewBatch(batch)
                        setReviewIndex(0)
                        prefillFromParsed(batch.parsedProducts[0], batch.storeId)
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 text-left transition-colors"
                    >
                      <span className="font-medium text-gray-800">
                        Receipt · {batch.parsedProducts.length} products
                      </span>
                      <span className="text-xs text-gray-400">
                        {batch.createdAt ? new Date(batch.createdAt).toLocaleDateString() : ''}
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          )}
          <div
                onClick={() => !receiptProcessing && receiptInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                  receiptProcessing
                    ? 'border-gray-200 cursor-default'
                    : 'border-gray-300 cursor-pointer hover:border-blue-400'
                }`}
              >
                {receiptPreview ? (
                  <img
                    src={receiptPreview}
                    alt="Receipt preview"
                    className="max-h-48 mx-auto rounded-lg object-contain"
                  />
                ) : (
                  <>
                    <div className="text-5xl mb-3">🧾</div>
                    <p className="font-medium text-gray-700">Tap to upload receipt photo</p>
                    <p className="text-sm text-gray-400 mt-1">JPEG or PNG — or use camera</p>
                  </>
                )}
              </div>
              <input
                ref={receiptInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleReceiptFile(e.target.files[0])
                }}
              />

              <ProgressConsole log={receiptLog} isProcessing={receiptProcessing} />

              {receiptFile && !receiptProcessing && (
                <Button className="w-full" onClick={handleReceiptImport}>
                  Parse & Review
                </Button>
              )}
              {receiptError && !receiptProcessing && (
                <p className="text-sm text-red-500 text-center">
                  Could not parse receipt. Try a clearer photo.
                </p>
              )}
        </div>
      )}

      {/* ── Email Forward ── */}
      {method === 'email' && !reviewBatch && (
        <div role="tabpanel" id="panel-email" aria-labelledby="tab-email" className="space-y-6">
          {importBatches.filter((b) => b.source === 'EMAIL').length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-800">Pending imports</h3>
              <div className="space-y-1">
                {importBatches
                  .filter((b) => b.source === 'EMAIL')
                  .map((batch) => (
                    <button
                      key={batch.id}
                      type="button"
                      onClick={() => {
                        setReviewBatch(batch)
                        setReviewIndex(0)
                        prefillFromParsed(batch.parsedProducts[0], batch.storeId)
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 text-left transition-colors"
                    >
                      <span className="font-medium text-gray-800">
                        Email · {batch.parsedProducts.length} products
                      </span>
                      <span className="text-xs text-gray-400">
                        {batch.createdAt ? new Date(batch.createdAt).toLocaleDateString() : ''}
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          )}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-center">
            <div className="text-4xl mb-3">📧</div>
            <p className="text-sm text-gray-600 mb-3">
              Forward any store order confirmation email to:
            </p>
            <div className="flex items-center justify-center gap-2">
              <code className="bg-white border border-blue-300 rounded-lg px-3 py-2 text-blue-700 font-semibold text-sm">
                {FORWARD_EMAIL}
              </code>
              <button
                onClick={copyEmail}
                className="p-2 rounded-lg border border-blue-300 text-blue-600 hover:bg-blue-100 transition-colors"
                title="Copy address"
              >
                {emailCopied ? '✓' : '📋'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Products will be automatically parsed and added to your list.
              <br />
              Make sure your forwarding email matches the one in your notification settings.
            </p>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-3 text-gray-400">or paste email content directly</span>
            </div>
          </div>

          <div className="space-y-3">
            <textarea
                value={emailContent}
                onChange={(e) => setEmailContent(e.target.value)}
                placeholder="Paste the raw email content here…"
                rows={6}
                disabled={emailProcessing}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-50"
              />

              <ProgressConsole log={emailLog} isProcessing={emailProcessing} />

            {!emailProcessing && (
              <Button
                className="w-full"
                onClick={handleEmailImport}
                disabled={!emailContent.trim()}
              >
                Parse & Review
              </Button>
            )}
            {emailError && !emailProcessing && (
              <p className="text-sm text-red-500 text-center">Could not parse email content.</p>
            )}
          </div>
        </div>
      )}

      {/* ── Barcode Scan ── */}
      {method === 'barcode' && (
        <div role="tabpanel" id="panel-barcode" aria-labelledby="tab-barcode" className="space-y-4">
          {barcodeSupported === false && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
              <p className="text-sm text-yellow-800 font-medium">
                Live barcode scanning is not supported in this browser.
              </p>
              <p className="text-xs text-yellow-600 mt-1">
                Try Chrome on Android or use the manual entry below.
              </p>
            </div>
          )}

          {barcodeSupported && (
            <>
              <div
                className="relative bg-black rounded-xl overflow-hidden"
                style={{ aspectRatio: '4/3' }}
              >
                <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                {!scanning && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-2">
                    <div className="text-5xl">🔳</div>
                    <p className="text-sm text-white/70">Camera off</p>
                  </div>
                )}
                {scanning && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="border-2 border-white/80 rounded-lg w-48 h-32 shadow-lg" />
                  </div>
                )}
              </div>

              {barcodeError && (
                <p className="text-sm text-red-500 text-center">{barcodeError}</p>
              )}

              {!scanning ? (
                <Button className="w-full" onClick={startScanning}>
                  Start Camera
                </Button>
              ) : (
                <Button variant="outline" className="w-full" onClick={stopScanning}>
                  Stop Camera
                </Button>
              )}

              <p className="text-xs text-gray-400 text-center">
                Point camera at a product barcode — it will be looked up automatically.
              </p>
            </>
          )}

          {/* Manual barcode entry fallback */}
          <div className="relative pt-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-3 text-gray-400">or enter barcode manually</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Input
              value={manualBarcode}
              onChange={(e) => setManualBarcode(e.target.value)}
              placeholder="e.g. 4006381333931"
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && manualBarcode.trim()) {
                  e.preventDefault()
                  lookupBarcode(manualBarcode.trim())
                }
              }}
            />
            <Button
              type="button"
              onClick={() => lookupBarcode(manualBarcode.trim())}
              disabled={!manualBarcode.trim() || lookingUp}
            >
              {lookingUp ? '…' : 'Look up'}
            </Button>
          </div>
          <p className="text-xs text-gray-400">
            After lookup, the manual form will be pre-filled with the product details.
          </p>
        </div>
      )}
    </div>
  )
}
