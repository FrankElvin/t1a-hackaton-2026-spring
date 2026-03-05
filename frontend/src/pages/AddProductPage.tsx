import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import keycloak from '@/lib/keycloak'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { mockStores } from '@/lib/mockData'
import type { ConsumerCategory, Item, CreateItemRequest, ImportReceiptResponse, Store } from '@/types/api'

const MOCK_AUTH = import.meta.env.VITE_MOCK_AUTH === 'true'

type Method = 'manual' | 'receipt' | 'email' | 'barcode'

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

const EMPTY_FORM: FormState = {
  name: '',
  currentQuantity: '1',
  unit: 'pcs',
  lastBoughtDate: new Date().toISOString().split('T')[0],
  storeId: '',
  consumerCategory: '',
  price: '',
  daysToRestock: '',
  autoCalc: true,
  standardPurchaseQuantity: '',
}

const UNIT_PRESETS = ['pcs', 'kg', 'g', 'L', 'ml', 'pack', 'box', 'bottle', 'bag', 'roll']


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

/**
 * Stream SSE events from an import endpoint.
 * Calls onProgress for each progress event, returns the final result.
 */
async function streamImport(
  url: string,
  body: FormData | string,
  contentType: 'multipart' | 'json',
  onProgress: (msg: string) => void
): Promise<ImportReceiptResponse> {
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
    throw new Error(`Import failed: ${response.status}`)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result: ImportReceiptResponse | null = null

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
  const queryClient = useQueryClient()
  const [method, setMethod] = useState<Method>('manual')
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const stdQtyEditedRef = useRef(false)
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
  const [importedItems, setImportedItems] = useState<Item[] | null>(null)
  const [unrecognizedLines, setUnrecognizedLines] = useState<string[]>([])
  const [receiptProcessing, setReceiptProcessing] = useState(false)
  const [receiptLog, setReceiptLog] = useState<LogEntry[]>([])
  const [receiptError, setReceiptError] = useState<string | null>(null)
  const receiptInputRef = useRef<HTMLInputElement>(null)

  // Email state
  const [emailContent, setEmailContent] = useState('')
  const [emailImported, setEmailImported] = useState<Item[] | null>(null)
  const [emailProcessing, setEmailProcessing] = useState(false)
  const [emailLog, setEmailLog] = useState<LogEntry[]>([])
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailCopied, setEmailCopied] = useState(false)

  const { data: forwardEmailData } = useQuery<{ forwardEmail: string }>({
    queryKey: ['settings', 'forward-email'],
    queryFn: () => api.get<{ forwardEmail: string }>('/settings/forward-email').then((r) => r.data),
    enabled: !MOCK_AUTH,
  })
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
      queryClient.invalidateQueries({ queryKey: ['forecast'] })
      navigate('/products')
    },
    onError: () => setSaveError('Failed to save. Please try again.'),
  })

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaveError(null)
    const req: CreateItemRequest = {
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

  // Receipt import with streaming
  async function handleReceiptImport() {
    if (!receiptFile) return
    setReceiptProcessing(true)
    setReceiptError(null)
    setReceiptLog([{ time: timeStamp(), text: 'Starting receipt import...', type: 'info' }])
    setImportedItems(null)
    setUnrecognizedLines([])

    try {
      const formData = new FormData()
      formData.append('image', receiptFile)

      const result = await streamImport(
        '/api/v1/items/import/receipt/stream',
        formData,
        'multipart',
        (msg) => {
          const type: LogEntry['type'] = msg.includes('Saved:') || msg.includes('complete')
            ? 'success'
            : msg.includes('Failed:')
              ? 'error'
              : 'info'
          setReceiptLog((prev) => [...prev, { time: timeStamp(), text: msg, type }])
        }
      )

      setImportedItems(result.importedItems)
      setUnrecognizedLines(result.unrecognizedLines)
      setReceiptLog((prev) => [
        ...prev,
        { time: timeStamp(), text: `Done! ${result.importedItems.length} products imported.`, type: 'success' },
      ])
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
    setImportedItems(null)
    setUnrecognizedLines([])
    setReceiptLog([])
    setReceiptError(null)
    setReceiptPreview(URL.createObjectURL(file))
  }

  // Email import with streaming
  async function handleEmailImport() {
    if (!emailContent.trim()) return
    setEmailProcessing(true)
    setEmailError(null)
    setEmailLog([{ time: timeStamp(), text: 'Starting email import...', type: 'info' }])
    setEmailImported(null)

    try {
      const result = await streamImport(
        '/api/v1/items/import/email/stream',
        JSON.stringify({ rawEmail: emailContent }),
        'json',
        (msg) => {
          const type: LogEntry['type'] = msg.includes('Saved:') || msg.includes('complete')
            ? 'success'
            : msg.includes('Failed:')
              ? 'error'
              : 'info'
          setEmailLog((prev) => [...prev, { time: timeStamp(), text: msg, type }])
        }
      )

      setEmailImported(result.importedItems)
      setEmailLog((prev) => [
        ...prev,
        { time: timeStamp(), text: `Done! ${result.importedItems.length} products imported.`, type: 'success' },
      ])
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

          <div className="space-y-1.5">
            <Label htmlFor="name">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Oat Milk"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qty">
                Quantity <span className="text-red-500">*</span>
              </Label>
              <Input
                id="qty"
                type="number"
                min="0"
                step="any"
                value={form.currentQuantity}
                onChange={(e) => {
                  const qty = e.target.value
                  setForm((p) => ({
                    ...p,
                    currentQuantity: qty,
                    ...(!stdQtyEditedRef.current ? { standardPurchaseQuantity: qty } : {}),
                  }))
                }}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unit">
                Unit <span className="text-red-500">*</span>
              </Label>
              <Input
                id="unit"
                value={form.unit}
                onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
                placeholder="pcs, kg, L…"
                required
              />
            </div>
          </div>

          {/* Unit presets */}
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
            <Label htmlFor="lastBoughtDate">Last bought</Label>
            <Input
              id="lastBoughtDate"
              type="date"
              value={form.lastBoughtDate}
              onChange={(e) => setForm((p) => ({ ...p, lastBoughtDate: e.target.value }))}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="store">Store</Label>
            <select
              id="store"
              value={form.storeId}
              onChange={(e) => setForm((p) => ({ ...p, storeId: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Not specified —</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
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
              onChange={(e) => setForm((p) => ({ ...p, daysToRestock: e.target.value }))}
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
          )}

          {/* Additional details — collapsible */}
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
                      form.consumerCategory
                        ? CONSUMER_CATEGORY_LABELS[form.consumerCategory as ConsumerCategory]
                        : null,
                      form.price ? `$${form.price}` : null,
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
                  <Label htmlFor="consumer">Consumed by</Label>
                  <select
                    id="consumer"
                    value={form.consumerCategory}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        consumerCategory: e.target.value as ConsumerCategory | '',
                      }))
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— Not specified —</option>
                    {(Object.entries(CONSUMER_CATEGORY_LABELS) as [ConsumerCategory, string][]).map(
                      ([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="stdQty">Standard purchase quantity</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="stdQty"
                      type="number"
                      min="0"
                      step="any"
                      value={form.standardPurchaseQuantity}
                      onChange={(e) => {
                        stdQtyEditedRef.current = true
                        setForm((p) => ({ ...p, standardPurchaseQuantity: e.target.value }))
                      }}
                      placeholder={form.currentQuantity || '1'}
                      className="flex-1"
                    />
                    <span className="text-sm text-gray-500 shrink-0">{form.unit}</span>
                  </div>
                  <p className="text-xs text-gray-400">How much you typically buy in one trip</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="price">Price</Label>
                  <Input
                    id="price"
                    type="number"
                    min="0"
                    step="any"
                    value={form.price}
                    onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>
            )}
          </div>

          {saveError && <p className="text-sm text-red-500">{saveError}</p>}

          <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : 'Save Product'}
          </Button>
        </form>
        </div>
      )}

      {/* ── Receipt Photo ── */}
      {method === 'receipt' && (
        <div role="tabpanel" id="panel-receipt" aria-labelledby="tab-receipt" className="space-y-4">
          {!importedItems ? (
            <>
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
                  Scan Receipt
                </Button>
              )}
              {receiptError && !receiptProcessing && (
                <p className="text-sm text-red-500 text-center">
                  Could not parse receipt. Try a clearer photo.
                </p>
              )}
            </>
          ) : (
            <>
              {/* Success confirmation banner */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <div className="text-3xl mb-2">✅</div>
                <p className="font-semibold text-green-800">
                  {importedItems.length} products imported successfully
                </p>
                {unrecognizedLines.length > 0 && (
                  <p className="text-sm text-orange-600 mt-1">
                    {unrecognizedLines.length} lines skipped
                  </p>
                )}
              </div>

              <details className="group">
                <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                  Show processing log ({receiptLog.length} events)
                </summary>
                <div className="mt-2">
                  <ProgressConsole log={receiptLog} isProcessing={false} />
                </div>
              </details>

              <div className="space-y-2">
                <h3 className="font-semibold text-gray-800">Imported Items</h3>
                {importedItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200"
                  >
                    <div>
                      <span className="font-medium text-gray-800">{item.name}</span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {item.currentQuantity} {item.unit}
                    </span>
                  </div>
                ))}
              </div>
              {unrecognizedLines.length > 0 && (
                <div className="space-y-1 pt-1">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                    Skipped lines
                  </p>
                  {unrecognizedLines.map((line, i) => (
                    <p key={i} className="text-xs text-gray-400 font-mono">
                      {line}
                    </p>
                  ))}
                </div>
              )}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setImportedItems(null)
                    setReceiptFile(null)
                    setReceiptPreview(null)
                    setReceiptLog([])
                  }}
                >
                  Scan Another
                </Button>
                <Button className="flex-1" onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['items'] })
                  queryClient.invalidateQueries({ queryKey: ['forecast'] })
                  navigate('/products')
                }}>
                  Done
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Email Forward ── */}
      {method === 'email' && (
        <div role="tabpanel" id="panel-email" aria-labelledby="tab-email" className="space-y-6">
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

          {!emailImported ? (
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
                  Parse & Import
                </Button>
              )}
              {emailError && !emailProcessing && (
                <p className="text-sm text-red-500 text-center">Could not parse email content.</p>
              )}
            </div>
          ) : (
            <>
              {/* Success confirmation */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <div className="text-3xl mb-2">✅</div>
                <p className="font-semibold text-green-800">
                  {emailImported.length} products imported successfully
                </p>
              </div>

              <details className="group">
                <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                  Show processing log ({emailLog.length} events)
                </summary>
                <div className="mt-2">
                  <ProgressConsole log={emailLog} isProcessing={false} />
                </div>
              </details>

              <div className="space-y-2">
                <h3 className="font-semibold text-gray-800">Imported Items</h3>
                {emailImported.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200"
                  >
                    <div>
                      <span className="font-medium text-gray-800">{item.name}</span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {item.currentQuantity} {item.unit}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setEmailImported(null)
                    setEmailContent('')
                    setEmailLog([])
                  }}
                >
                  Import Another
                </Button>
                <Button className="flex-1" onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['items'] })
                  queryClient.invalidateQueries({ queryKey: ['forecast'] })
                  navigate('/products')
                }}>
                  Done
                </Button>
              </div>
            </>
          )}
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
