import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Check, X, Store as StoreIcon } from 'lucide-react'
import api from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { mockStores } from '@/lib/mockData'
import type { Store } from '@/types/api'

const MOCK_AUTH = import.meta.env.VITE_MOCK_AUTH === 'true'

// ── Delete dialog ─────────────────────────────────────────────────────────────

function DeleteDialog({
  storeName,
  onConfirm,
  onCancel,
}: {
  storeName: string
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
        <h2 className="text-lg font-semibold text-gray-900 text-center mb-1">Delete store?</h2>
        <p className="text-sm text-gray-500 text-center mb-6">
          <span className="font-medium text-gray-800">{storeName}</span> will be removed. Products
          assigned to it will keep their data.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={onConfirm}>
            Delete
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Store row ─────────────────────────────────────────────────────────────────

function StoreRow({
  store,
  onEdit,
  onDelete,
  onNavigate,
}: {
  store: Store
  onEdit: (updated: Store) => void
  onDelete: () => void
  onNavigate: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(store.name)
  const [visitDays, setVisitDays] = useState(String(store.visitIntervalDays ?? ''))

  function handleSave() {
    if (!name.trim()) return
    onEdit({
      ...store,
      name: name.trim(),
      visitIntervalDays: visitDays ? Math.max(1, parseInt(visitDays, 10) || 7) : undefined,
    })
    setEditing(false)
  }

  function handleCancel() {
    setName(store.name)
    setVisitDays(String(store.visitIntervalDays ?? ''))
    setEditing(false)
  }

  if (editing) {
    return (
      <li className="flex items-center gap-2 bg-white border border-blue-200 rounded-xl px-4 py-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          className="flex-1 h-8 text-sm"
          autoFocus
        />
        <Input
          type="number"
          min="1"
          placeholder="Days"
          value={visitDays}
          onChange={(e) => setVisitDays(e.target.value)}
          className="w-20 h-8 text-sm"
          title="Visit every N days"
        />
        <button
          onClick={handleSave}
          disabled={!name.trim()}
          className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 disabled:opacity-40 transition-colors"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={handleCancel}
          className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </li>
    )
  }

  return (
    <li className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-blue-200 hover:shadow-sm transition-shadow">
      <button
        className="flex items-center gap-3 flex-1 min-w-0 text-left"
        onClick={onNavigate}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 shrink-0">
          <StoreIcon className="w-4 h-4 text-gray-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">{store.name}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {store.visitIntervalDays
              ? `Every ${store.visitIntervalDays} day${store.visitIntervalDays !== 1 ? 's' : ''}`
              : 'No schedule'}
            {store.lastVisitDate && (
              <span className="ml-2">· Last visit {store.lastVisitDate}</span>
            )}
          </p>
        </div>
      </button>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => setEditing(true)}
          className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          title="Edit"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={onDelete}
          className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </li>
  )
}

// ── Add form ──────────────────────────────────────────────────────────────────

function AddStoreForm({ onAdd, onCancel }: { onAdd: (s: Omit<Store, 'id'>) => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [visitDays, setVisitDays] = useState('7')

  function handleAdd() {
    if (!name.trim()) return
    onAdd({
      name: name.trim(),
      visitIntervalDays: Math.max(1, parseInt(visitDays, 10) || 7),
    })
  }

  return (
    <li className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 space-y-2">
      <div className="flex gap-2">
        <Input
          placeholder="Store name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          autoFocus
          className="flex-1 bg-white"
        />
        <Input
          type="number"
          min="1"
          placeholder="Days"
          value={visitDays}
          onChange={(e) => setVisitDays(e.target.value)}
          className="w-20 bg-white"
          title="Visit every N days"
        />
      </div>
      <p className="text-xs text-blue-500">Visit frequency in days (e.g. 7 = weekly)</p>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleAdd} disabled={!name.trim()}>
          Add store
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </li>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function StoresPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const { data: stores = [], isLoading } = useQuery<Store[]>({
    queryKey: ['stores'],
    queryFn: MOCK_AUTH
      ? () => Promise.resolve(mockStores)
      : () => api.get<Store[]>('/stores').then((r) => r.data),
  })

  const addMutation = useMutation({
    mutationFn: (payload: Omit<Store, 'id'>) => {
      if (MOCK_AUTH) {
        const newStore: Store = { ...payload, id: crypto.randomUUID() }
        return Promise.resolve(newStore)
      }
      return api.post<Store>('/stores', payload).then((r) => r.data)
    },
    onSuccess: (created) => {
      queryClient.setQueryData<Store[]>(['stores'], (prev) => [...(prev ?? []), created])
      setAdding(false)
    },
  })

  const editMutation = useMutation({
    mutationFn: (store: Store) => {
      if (MOCK_AUTH) return Promise.resolve(store)
      return api.put<Store>(`/stores/${store.id}`, store).then((r) => r.data)
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<Store[]>(['stores'], (prev) =>
        prev?.map((s) => (s.id === updated.id ? updated : s)) ?? []
      )
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (MOCK_AUTH) return Promise.resolve()
      return api.delete(`/stores/${id}`).then(() => {})
    },
    onSuccess: (_, id) => {
      queryClient.setQueryData<Store[]>(['stores'], (prev) =>
        prev?.filter((s) => s.id !== id) ?? []
      )
    },
  })

  const deleteTarget = deleteTargetId ? stores.find((s) => s.id === deleteTargetId) : null

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {stores.length} store{stores.length !== 1 ? 's' : ''}
        </p>
        <Button size="sm" onClick={() => setAdding(true)} disabled={adding}>
          <Plus className="w-4 h-4" />
          <span className="ml-1">Add store</span>
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {adding && (
            <AddStoreForm
              onAdd={(payload) => addMutation.mutate(payload)}
              onCancel={() => setAdding(false)}
            />
          )}
          {stores.length === 0 && !adding ? (
            <li className="text-center py-16 space-y-3">
              <p className="text-gray-400 text-sm">No stores yet.</p>
              <Button onClick={() => setAdding(true)}>
                <Plus className="w-4 h-4" />
                Add your first store
              </Button>
            </li>
          ) : (
            stores.map((store) => (
              <StoreRow
                key={store.id}
                store={store}
                onEdit={(updated) => editMutation.mutate(updated)}
                onDelete={() => setDeleteTargetId(store.id!)}
                onNavigate={() => navigate(`/stores/${store.id}`)}
              />
            ))
          )}
        </ul>
      )}

      {/* Delete dialog */}
      {deleteTarget && (
        <DeleteDialog
          storeName={deleteTarget.name}
          onConfirm={() => {
            deleteMutation.mutate(deleteTarget.id!)
            setDeleteTargetId(null)
          }}
          onCancel={() => setDeleteTargetId(null)}
        />
      )}
    </div>
  )
}
