export type PersonCategory = 'ADULT' | 'CHILD'
export type PetCategory = 'CAT' | 'DOG' | 'PARROT' | 'SMALL_ANIMAL' | 'OTHER'
export type ConsumerCategory = 'ADULT' | 'CHILD' | 'CAT' | 'DOG' | 'PARROT' | 'SMALL_ANIMAL'
export type ItemCategory =
  | 'FOOD'
  | 'BEVERAGES'
  | 'CLEANING'
  | 'PERSONAL_CARE'
  | 'PET_FOOD'
  | 'MEDICINE'
  | 'OTHER'

export interface HouseholdMember {
  id?: string
  name?: string
  category: PersonCategory
}

export interface Pet {
  id?: string
  name?: string
  category: PetCategory
}

export interface Household {
  id?: string
  members: HouseholdMember[]
  pets: Pet[]
}

export interface Store {
  id?: string
  name: string
  visitIntervalDays?: number
  lastVisitDate?: string
}

export interface Item {
  id: string
  name: string
  category?: ItemCategory
  currentQuantity: number
  unit: string
  storeId?: string
  price?: number
  consumerCategory?: ConsumerCategory
  daysToRestock?: number
  usagePerDay?: number
  autoCalc?: boolean
  lastBoughtDate?: string
  standardPurchaseQuantity?: number
  createdAt?: string
  updatedAt?: string
}

export interface CreateItemRequest {
  name: string
  category?: ItemCategory
  currentQuantity: number
  unit: string
  storeId?: string
  price?: number
  consumerCategory?: ConsumerCategory
  daysToRestock?: number
  autoCalc?: boolean
  lastBoughtDate?: string
  standardPurchaseQuantity?: number
}

export type UpdateItemRequest = CreateItemRequest

export interface ItemForecast {
  itemId: string
  itemName: string
  currentQuantity: number
  unit: string
  estimatedDailyConsumption: number
  estimatedDepletionDate?: string
  daysUntilDepletion?: number
  percentRemaining?: number
  calculationDate: string
}

export interface DashboardSummary {
  calculationDate: string
  criticalItems: ItemForecast[]
  upcomingPurchases: ItemForecast[]
  stockLevels: ItemForecast[]
}

export interface ShoppingListEntry {
  itemId: string
  itemName: string
  requiredQuantity: number
  unit: string
  price?: number
  estimatedDepletionDate?: string
  urgent: boolean
}

export interface ShoppingList {
  storeId?: string
  storeName?: string
  nextVisitDate?: string
  entries: ShoppingListEntry[]
  totalEstimatedCost?: number
}

export interface ShoppingListsResponse {
  calculationDate: string
  lists: ShoppingList[]
}

export interface ForecastResponse {
  calculationDate: string
  items: ItemForecast[]
}

export interface ImportReceiptResponse {
  importedItems: Item[]
  unrecognizedLines: string[]
}

export type ImportBatchSource = 'RECEIPT' | 'EMAIL' | 'BARCODE'

export interface ParsedProductDto {
  index: number
  name: string
  quantity: number
  unit: string
  priceAmount?: number
  priceCurrency?: string
  category?: ItemCategory
  monthlyConsumptionRate?: number
}

export interface ImportBatchResponse {
  id: string
  source: ImportBatchSource
  sourceMetadata?: string
  storeId?: string
  parsedProducts: ParsedProductDto[]
  unrecognizedLines: string[]
  createdAt?: string
}

export interface MatchSuggestion {
  itemId: string
  name: string
  score: number
}

export interface AddQuantityRequest {
  quantity: number
}

export interface MarkConsumedRequest {
  quantityConsumed?: number
  depletedAt?: string
}

export interface MarkDepletedRequest {
  depletedAt?: string
}

export interface NotificationSettings {
  channel?: 'EMAIL'
  email?: string
  enabled?: boolean
  notifyDaysBeforeDepletion?: number
  lookAheadDays?: number
}

export interface CalculationDateSettings {
  calculationDate: string
  isOverridden?: boolean
}
