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
  monthlyConsumptionRate?: number
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
  monthlyConsumptionRate?: number
}

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
