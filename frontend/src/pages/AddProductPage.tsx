import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { mockStores } from '@/lib/mockData'
import type { ItemCategory, ConsumerCategory, Item, CreateItemRequest, ImportReceiptResponse, Store } from '@/types/api'

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

export default function AddProductPage() {
  const navigate = useNavigate()
  const [method, setMethod] = useState<Method>('manual')
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [prefillBanner, setPrefillBanner] = useState<string | null>(null)
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
  const receiptInputRef = useRef<HTMLInputElement>(null)

  // Email state
  const [emailContent, setEmailContent] = useState('')
  const [emailImported, setEmailImported] = useState<Item[] | null>(null)
  const [emailCopied, setEmailCopied] = useState(false)
  const FORWARD_EMAIL = 'inbox@neverempty.app'

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
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`)
      const data = await res.json()
      if (data.status === 1 && data.product) {
        const p = data.product
        const name = p.product_name || p.product_name_en || barcode
        const rawQty: string = p.quantity || ''
        const qtyMatch = rawQty.match(/^([\d.]+)\s*(.*)$/)
        setForm((prev) => ({
          ...prev,
          name,
          currentQuantity: qtyMatch ? qtyMatch[1] : '1',
          unit: qtyMatch && qtyMatch[2] ? qtyMatch[2].trim() : 'pcs',
        }))
        setPrefillBanner(`Found: ${name}`)
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
    }
    saveMutation.mutate(req)
  }

  // Receipt import
  const receiptMutation = useMutation({
    mutationFn: (file: File) => {
      if (MOCK_AUTH) {
        return Promise.resolve({
          importedItems: [
            { id: crypto.randomUUID(), name: 'Oat Milk', currentQuantity: 2, unit: 'L' },
            { id: crypto.randomUUID(), name: 'Whole Grain Bread', currentQuantity: 1, unit: 'pcs' },
            { id: crypto.randomUUID(), name: 'Greek Yogurt', currentQuantity: 4, unit: 'pcs' },
          ] as Item[],
          unrecognizedLines: ['LOYALTY POINTS: 125', 'CASHBACK: $0.50'],
        })
      }
      const formData = new FormData()
      formData.append('image', file)
      return api
        .post<ImportReceiptResponse>('/items/import/receipt', formData)
        .then((r) => r.data)
    },
    onSuccess: (data) => {
      setImportedItems(data.importedItems)
      setUnrecognizedLines(data.unrecognizedLines)
    },
  })

  function handleReceiptFile(file: File) {
    setReceiptFile(file)
    setImportedItems(null)
    setUnrecognizedLines([])
    setReceiptPreview(URL.createObjectURL(file))
  }

  // Email import
  const emailMutation = useMutation({
    mutationFn: (rawEmail: string) => {
      if (MOCK_AUTH) {
        return Promise.resolve({
          importedItems: [
            {
              id: crypto.randomUUID(),
              name: 'Dishwasher Tablets 40-pack',
              currentQuantity: 40,
              unit: 'pcs',
            },
            { id: crypto.randomUUID(), name: 'Laundry Detergent', currentQuantity: 2, unit: 'kg' },
            { id: crypto.randomUUID(), name: 'Toilet Paper 12-roll', currentQuantity: 12, unit: 'roll' },
          ] as Item[],
          unrecognizedLines: [],
        })
      }
      return api
        .post<ImportReceiptResponse>('/items/import/email', { rawEmail })
        .then((r) => r.data)
    },
    onSuccess: (data) => setEmailImported(data.importedItems),
  })

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
      <div className="grid grid-cols-4 gap-2 mb-6">
        {methods.map((m) => (
          <button
            key={m.id}
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
        <form onSubmit={handleManualSubmit} className="space-y-4">
          {prefillBanner && (
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
                onChange={(e) => setForm((p) => ({ ...p, currentQuantity: e.target.value }))}
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
                      form.storeId ? stores.find((s) => s.id === form.storeId)?.name : null,
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

                <div className="space-y-1.5">
                  <Label htmlFor="category">Category</Label>
                  <select
                    id="category"
                    value={form.category}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, category: e.target.value as ItemCategory | '' }))
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— Not specified —</option>
                    {(Object.entries(ITEM_CATEGORY_LABELS) as [ItemCategory, string][]).map(
                      ([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      )
                    )}
                  </select>
                </div>

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

                <div className="grid grid-cols-2 gap-3">
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
                  <div className="space-y-1.5">
                    <Label htmlFor="rate">Monthly usage</Label>
                    <Input
                      id="rate"
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
                </div>
                <p className="text-xs text-gray-400">
                  Monthly usage: leave empty to auto-calculate from history
                </p>
              </div>
            )}
          </div>

          {saveError && <p className="text-sm text-red-500">{saveError}</p>}

          <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : 'Save Product'}
          </Button>
        </form>
      )}

      {/* ── Receipt Photo ── */}
      {method === 'receipt' && (
        <div className="space-y-4">
          {!importedItems ? (
            <>
              <div
                onClick={() => receiptInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
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
              {receiptFile && (
                <Button
                  className="w-full"
                  onClick={() => receiptMutation.mutate(receiptFile)}
                  disabled={receiptMutation.isPending}
                >
                  {receiptMutation.isPending ? 'Scanning…' : 'Scan Receipt'}
                </Button>
              )}
              {receiptMutation.isError && (
                <p className="text-sm text-red-500 text-center">
                  Could not parse receipt. Try a clearer photo.
                </p>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">Imported Items</h3>
                <span className="text-sm text-green-600 font-medium">
                  {importedItems.length} saved
                </span>
              </div>
              <div className="space-y-2">
                {importedItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200"
                  >
                    <span className="font-medium text-gray-800">{item.name}</span>
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
                  }}
                >
                  Scan Another
                </Button>
                <Button className="flex-1" onClick={() => navigate('/products')}>
                  Done
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Email Forward ── */}
      {method === 'email' && (
        <div className="space-y-6">
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
              Products will be automatically parsed and added to your list
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <Button
                className="w-full"
                onClick={() => emailMutation.mutate(emailContent)}
                disabled={!emailContent.trim() || emailMutation.isPending}
              >
                {emailMutation.isPending ? 'Parsing…' : 'Parse & Import'}
              </Button>
              {emailMutation.isError && (
                <p className="text-sm text-red-500 text-center">Could not parse email content.</p>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800">Imported Items</h3>
                  <span className="text-sm text-green-600 font-medium">
                    {emailImported.length} saved
                  </span>
                </div>
                {emailImported.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200"
                  >
                    <span className="font-medium text-gray-800">{item.name}</span>
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
                  }}
                >
                  Import Another
                </Button>
                <Button className="flex-1" onClick={() => navigate('/products')}>
                  Done
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Barcode Scan ── */}
      {method === 'barcode' && (
        <div className="space-y-4">
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
