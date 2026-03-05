import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, CheckCircle2, AlertTriangle, Clock, ShoppingBasket } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import api from '@/lib/axios'
import type { DashboardSummary, ItemForecast } from '@/types/api'
import { cn } from '@/lib/utils'
import { mockDashboard } from '@/lib/mockData'

const MOCK_AUTH = import.meta.env.VITE_MOCK_AUTH === 'true'

function urgencyColor(days?: number) {
  if (days === undefined || days === null) return 'text-gray-500'
  if (days <= 3) return 'text-red-600'
  if (days <= 7) return 'text-orange-500'
  return 'text-green-600'
}

function urgencyBg(days?: number) {
  if (days === undefined || days === null) return 'bg-gray-50 border-gray-200'
  if (days <= 3) return 'bg-red-50 border-red-200'
  if (days <= 7) return 'bg-orange-50 border-orange-200'
  return 'bg-green-50 border-green-200'
}

function UrgencyIcon({ days }: { days?: number }) {
  if (days === undefined) return <Clock className="w-4 h-4 text-gray-400" />
  if (days <= 3) return <AlertTriangle className="w-4 h-4 text-red-500" />
  if (days <= 7) return <Clock className="w-4 h-4 text-orange-500" />
  return <CheckCircle2 className="w-4 h-4 text-green-500" />
}

function ItemCard({ item, onClick }: { item: ItemForecast; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-lg border p-4 transition-shadow hover:shadow-md',
        urgencyBg(item.daysUntilDepletion)
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">{item.itemName}</p>
          <p className="text-sm text-gray-500 mt-0.5">
            {item.currentQuantity} {item.unit} remaining
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <UrgencyIcon days={item.daysUntilDepletion} />
          <span className={cn('text-sm font-medium', urgencyColor(item.daysUntilDepletion))}>
            {item.daysUntilDepletion !== undefined
              ? item.daysUntilDepletion === 0
                ? 'Today'
                : item.daysUntilDepletion === 1
                  ? '1 day left'
                  : `${item.daysUntilDepletion}d left`
              : '—'}
          </span>
        </div>
      </div>
      {item.percentRemaining !== undefined && (
        <div className="mt-3">
          <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                item.daysUntilDepletion !== undefined && item.daysUntilDepletion <= 3
                  ? 'bg-red-500'
                  : item.daysUntilDepletion !== undefined && item.daysUntilDepletion <= 7
                    ? 'bg-orange-400'
                    : 'bg-green-500'
              )}
              style={{ width: `${Math.min(100, item.percentRemaining)}%` }}
            />
          </div>
        </div>
      )}
    </button>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()

  const { data, isLoading, isError } = useQuery<DashboardSummary>({
    queryKey: ['dashboard'],
    queryFn: MOCK_AUTH
      ? () => Promise.resolve(mockDashboard)
      : () => api.get('/dashboard').then((r) => r.data),
    staleTime: 0,
    refetchInterval: MOCK_AUTH ? false : 60_000,
  })

  const allEmpty =
    !isLoading &&
    !isError &&
    data &&
    data.criticalItems.length === 0 &&
    data.upcomingPurchases.length === 0 &&
    data.stockLevels.length === 0

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Empty state */}
      {allEmpty && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-50 mb-4">
              <ShoppingBasket className="w-8 h-8 text-blue-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Your pantry is empty!</h2>
            <p className="text-gray-500 text-sm mb-6 max-w-xs">
              Add your first product. You can scan a receipt, forward an order email, scan a
              barcode, or enter it manually.
            </p>
            <Button onClick={() => navigate('/add-product')} size="lg">
              <Plus className="w-4 h-4" />
              Add Product
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            Could not load dashboard. Please try again.
          </CardContent>
        </Card>
      )}

      {/* Critical items */}
      {data && data.criticalItems.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Running Out Soon
            </h2>
            <span className="ml-auto text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
              {data.criticalItems.length}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {data.criticalItems.map((item) => (
              <ItemCard
                key={item.itemId}
                item={item}
                onClick={() => navigate(`/products/${item.itemId}`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming purchases */}
      {data && data.upcomingPurchases.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-orange-500" />
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Upcoming Purchases
            </h2>
            <span className="ml-auto text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
              {data.upcomingPurchases.length}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {data.upcomingPurchases.map((item) => (
              <ItemCard
                key={item.itemId}
                item={item}
                onClick={() => navigate(`/products/${item.itemId}`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* All good state */}
      {data && !allEmpty && data.criticalItems.length === 0 && data.upcomingPurchases.length === 0 && (
        <Card>
          <CardContent className="py-6 flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-green-500 shrink-0" />
            <div>
              <p className="font-medium text-gray-900">All good!</p>
              <p className="text-sm text-gray-500">No products running out soon.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
