import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import api from '@/lib/axios'
import { useAuth } from '@/context/AuthContext'
import keycloak from '@/lib/keycloak'
import type { Household, Pet, PetCategory } from '@/types/api'

const MOCK_AUTH = import.meta.env.VITE_MOCK_AUTH === 'true'

const MOCK_HOUSEHOLD: Household = {
  members: [{ category: 'ADULT' }, { category: 'ADULT' }],
  pets: [],
}

const PET_CATEGORIES: { value: PetCategory; label: string; emoji: string }[] = [
  { value: 'CAT', label: 'Cat', emoji: '🐱' },
  { value: 'DOG', label: 'Dog', emoji: '🐶' },
  { value: 'PARROT', label: 'Parrot', emoji: '🦜' },
  { value: 'SMALL_ANIMAL', label: 'Small Animal', emoji: '🐭' },
  { value: 'OTHER', label: 'Other', emoji: '🐾' },
]

interface PetEntry {
  uid: string
  name?: string
  category: PetCategory
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
          type="button"
          onClick={onDecrement}
          disabled={count === 0}
          className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Minus className="w-3 h-3" />
        </button>
        <span className="text-lg font-semibold text-gray-900 w-6 text-center">{count}</span>
        <button
          type="button"
          onClick={onIncrement}
          className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

function initials(name: string | undefined, email: string | undefined): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return parts[0].slice(0, 2).toUpperCase()
  }
  if (email) return email.slice(0, 2).toUpperCase()
  return '?'
}

export default function SettingsPage() {
  const { userEmail, userName, logout } = useAuth()
  const queryClient = useQueryClient()

  // ── Household state ──────────────────────────────────────────────────────
  const [adults, setAdults] = useState(1)
  const [children, setChildren] = useState(0)
  const [pets, setPets] = useState<PetEntry[]>([])
  const [addingPet, setAddingPet] = useState(false)
  const [newPetName, setNewPetName] = useState('')
  const [newPetCategory, setNewPetCategory] = useState<PetCategory>('CAT')
  const [householdSaved, setHouseholdSaved] = useState(false)

  const { data: household } = useQuery<Household>({
    queryKey: ['household'],
    queryFn: MOCK_AUTH
      ? () => Promise.resolve(MOCK_HOUSEHOLD)
      : () => api.get<Household>('/household').then((r) => r.data),
  })

  // Populate local state when household loads
  useEffect(() => {
    if (!household) return
    setAdults(household.members.filter((m) => m.category === 'ADULT').length)
    setChildren(household.members.filter((m) => m.category === 'CHILD').length)
    setPets(
      household.pets.map((p) => ({
        uid: crypto.randomUUID(),
        name: p.name,
        category: p.category,
      }))
    )
  }, [household])

  const householdMutation = useMutation({
    mutationFn: (h: Household) => {
      if (MOCK_AUTH) return Promise.resolve()
      return api.put('/household', h).then(() => {})
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['household'] })
      setHouseholdSaved(true)
      setTimeout(() => setHouseholdSaved(false), 2000)
    },
  })

  function saveHousehold() {
    const members = [
      ...Array.from({ length: adults }, () => ({ category: 'ADULT' as const })),
      ...Array.from({ length: children }, () => ({ category: 'CHILD' as const })),
    ]
    const petPayload: Pet[] = pets.map(({ name, category }) => ({ name, category }))
    householdMutation.mutate({ members, pets: petPayload })
  }

  function addPet() {
    setPets((prev) => [
      ...prev,
      { uid: crypto.randomUUID(), name: newPetName.trim() || undefined, category: newPetCategory },
    ])
    setNewPetName('')
    setNewPetCategory('CAT')
    setAddingPet(false)
  }

  // ── Profile ──────────────────────────────────────────────────────────────
  function openKeycloakAccount() {
    if (MOCK_AUTH) return
    window.open(keycloak.createAccountUrl(), '_blank')
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">

      {/* ── Profile ── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Profile</h2>
        </div>

        <div className="flex items-center gap-4 px-4 py-4 border-b border-gray-100">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-blue-100 text-blue-700 text-lg font-semibold shrink-0">
            {initials(userName, userEmail)}
          </div>
          <div className="min-w-0">
            {userName && <p className="font-medium text-gray-900 truncate">{userName}</p>}
            {userEmail && <p className="text-sm text-gray-500 truncate">{userEmail}</p>}
          </div>
        </div>

        <button
          onClick={openKeycloakAccount}
          disabled={MOCK_AUTH}
          className="w-full flex items-center justify-between px-4 py-3.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span>Change password</span>
          <span className="text-gray-400">›</span>
        </button>

        <button
          onClick={openKeycloakAccount}
          disabled={MOCK_AUTH}
          className="w-full flex items-center justify-between px-4 py-3.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span>Manage account</span>
          <span className="text-gray-400 text-xs">Opens in Keycloak ›</span>
        </button>

        <button
          onClick={logout}
          className="w-full flex items-center px-4 py-3.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
        >
          Sign out
        </button>
      </div>

      {/* ── Household ── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Household</h2>
        </div>

        <div className="px-4 py-4 space-y-5">
          {/* People */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">People</p>
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
            {adults + children === 0 && (
              <p className="text-xs text-red-500 mt-2">At least 1 person is required</p>
            )}
          </div>

          <div className="border-t border-gray-100" />

          {/* Pets */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Pets</p>

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
                        type="button"
                        onClick={() => setPets((prev) => prev.filter((p) => p.uid !== pet.uid))}
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
                  <Button size="sm" onClick={addPet}>Add</Button>
                  <Button size="sm" variant="ghost" onClick={() => setAddingPet(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingPet(true)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                + Add a pet
              </button>
            )}
          </div>

          <div className="border-t border-gray-100 pt-1">
            <Button
              className="w-full"
              onClick={saveHousehold}
              disabled={adults + children === 0 || householdMutation.isPending}
            >
              {householdSaved ? 'Saved ✓' : householdMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
            {householdMutation.isError && (
              <p className="text-xs text-red-500 text-center mt-2">Failed to save. Please try again.</p>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}
