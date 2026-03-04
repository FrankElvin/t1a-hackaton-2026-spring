import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Minus, Plus, Trash2, ShoppingBasket } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import api from '@/lib/axios'
import type { Household, Pet, PetCategory } from '@/types/api'

const MOCK_AUTH = import.meta.env.VITE_MOCK_AUTH === 'true'

const PET_CATEGORIES: { value: PetCategory; label: string; emoji: string }[] = [
  { value: 'CAT', label: 'Cat', emoji: '🐱' },
  { value: 'DOG', label: 'Dog', emoji: '🐶' },
  { value: 'PARROT', label: 'Parrot', emoji: '🦜' },
  { value: 'SMALL_ANIMAL', label: 'Small Animal', emoji: '🐭' },
  { value: 'OTHER', label: 'Other', emoji: '🐾' },
]

interface PetEntry {
  uid: string
  name: string
  category: PetCategory
}

interface StoreEntry {
  uid: string
  name: string
  visitIntervalDays: number
}

function Stepper({
  label,
  count,
  onDecrement,
  onIncrement,
}: {
  label: string
  count: number
  onDecrement: () => void
  onIncrement: () => void
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-gray-800">{label}</span>
      <div className="flex items-center gap-3">
        <button
          onClick={onDecrement}
          disabled={count === 0}
          className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Minus className="w-3 h-3" />
        </button>
        <span className="text-lg font-semibold text-gray-900 w-6 text-center">{count}</span>
        <button
          onClick={onIncrement}
          className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [adults, setAdults] = useState(1)
  const [children, setChildren] = useState(0)
  const [pets, setPets] = useState<PetEntry[]>([])
  const [addingPet, setAddingPet] = useState(false)
  const [newPetName, setNewPetName] = useState('')
  const [newPetCategory, setNewPetCategory] = useState<PetCategory>('CAT')
  const [stores, setStores] = useState<StoreEntry[]>([])
  const [addingStore, setAddingStore] = useState(false)
  const [newStoreName, setNewStoreName] = useState('')
  const [newStoreVisitDays, setNewStoreVisitDays] = useState('7')

  const totalPeople = adults + children

  const mutation = useMutation({
    mutationFn: async ({
      household,
      storesToCreate,
    }: {
      household: Household
      storesToCreate: StoreEntry[]
    }) => {
      if (MOCK_AUTH) return
      await api.put('/household', household)
      await Promise.all(
        storesToCreate.map((s) =>
          api.post('/stores', { name: s.name, visitIntervalDays: s.visitIntervalDays })
        )
      )
    },
    onSuccess: () => navigate('/dashboard', { replace: true }),
  })

  function addPet() {
    setPets((prev) => [
      ...prev,
      { uid: crypto.randomUUID(), name: newPetName.trim(), category: newPetCategory },
    ])
    setNewPetName('')
    setNewPetCategory('CAT')
  }

  function removePet(uid: string) {
    setPets((prev) => prev.filter((p) => p.uid !== uid))
  }

  function addStore() {
    const name = newStoreName.trim()
    if (!name) return
    const visitIntervalDays = Math.max(1, parseInt(newStoreVisitDays, 10) || 7)
    setStores((prev) => [...prev, { uid: crypto.randomUUID(), name, visitIntervalDays }])
    setNewStoreName('')
    setNewStoreVisitDays('7')
  }

  function removeStore(uid: string) {
    setStores((prev) => prev.filter((s) => s.uid !== uid))
  }

  function handleSubmit() {
    const members = [
      ...Array.from({ length: adults }, () => ({ category: 'ADULT' as const })),
      ...Array.from({ length: children }, () => ({ category: 'CHILD' as const })),
    ]
    const petPayload: Pet[] = pets.map(({ name, category }) => ({ name, category }))
    mutation.mutate({ household: { members, pets: petPayload }, storesToCreate: stores })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 mb-4">
            <ShoppingBasket className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Set up your household</h1>
          <p className="text-gray-500 text-sm mt-1 text-center">
            Tell us who lives here so we can calculate consumption correctly
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-6">
            {/* People */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                People
              </p>
              <div className="space-y-3">
                <Stepper
                  label="Adults"
                  count={adults}
                  onDecrement={() => setAdults((n) => Math.max(0, n - 1))}
                  onIncrement={() => setAdults((n) => n + 1)}
                />
                <Stepper
                  label="Children"
                  count={children}
                  onDecrement={() => setChildren((n) => Math.max(0, n - 1))}
                  onIncrement={() => setChildren((n) => n + 1)}
                />
              </div>
              {totalPeople === 0 && (
                <p className="text-xs text-red-500 mt-2">At least 1 person is required</p>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-gray-100" />

            {/* Pets */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Pets
              </p>

              {pets.length > 0 && (
                <ul className="space-y-2 mb-3">
                  {pets.map((pet) => {
                    const meta = PET_CATEGORIES.find((c) => c.value === pet.category)
                    return (
                      <li
                        key={pet.uid}
                        className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
                      >
                        <span className="text-sm text-gray-800">
                          {meta?.emoji} {pet.name}{' '}
                          <span className="text-gray-400 text-xs">({meta?.label})</span>
                        </span>
                        <button
                          onClick={() => removePet(pet.uid)}
                          className="text-gray-400 hover:text-red-500 transition-colors ml-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}

              {addingPet ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <select
                      value={newPetCategory}
                      onChange={(e) => setNewPetCategory(e.target.value as PetCategory)}
                      className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      {PET_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.emoji} {c.label}
                        </option>
                      ))}
                    </select>
                    <Input
                      placeholder="Pet's name (optional)"
                      value={newPetName}
                      onChange={(e) => setNewPetName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addPet()}
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={addPet}>
                      Add
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setAddingPet(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingPet(true)}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  + Add a pet
                </button>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-gray-100" />

            {/* Stores */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Stores
              </p>

              {stores.length > 0 && (
                <ul className="space-y-2 mb-3">
                  {stores.map((store) => (
                    <li
                      key={store.uid}
                      className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
                    >
                      <span className="text-sm text-gray-800">
                        {store.name}
                        <span className="text-gray-400 text-xs ml-2">
                          every {store.visitIntervalDays}d
                        </span>
                      </span>
                      <button
                        onClick={() => removeStore(store.uid)}
                        className="text-gray-400 hover:text-red-500 transition-colors ml-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {addingStore ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Store name"
                      value={newStoreName}
                      onChange={(e) => setNewStoreName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addStore()}
                      autoFocus
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      min="1"
                      placeholder="Days"
                      value={newStoreVisitDays}
                      onChange={(e) => setNewStoreVisitDays(e.target.value)}
                      className="w-20"
                      title="Visit every N days"
                    />
                  </div>
                  <p className="text-xs text-gray-400">Visit frequency in days (e.g. 7 = weekly)</p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={addStore} disabled={!newStoreName.trim()}>
                      Add
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setAddingStore(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingStore(true)}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  + Add a store
                </button>
              )}
            </div>

            {/* Submit */}
            <div className="pt-2">
              <Button
                className="w-full"
                size="lg"
                onClick={handleSubmit}
                disabled={totalPeople === 0 || mutation.isPending}
              >
                {mutation.isPending ? 'Saving...' : 'Continue'}
              </Button>
              {mutation.isError && (
                <p className="text-xs text-red-500 text-center mt-2">
                  Something went wrong. Please try again.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
