import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuthStore } from '../features/auth/authStore'
import { salonApi } from '../features/salons/api/salonApi'
import { salonKeys } from '../shared/query/queryKeys'

export function SalonAdminPanelPage() {
  const currentUser = useAuthStore((state) => state.currentUser)
  const [description, setDescription] = useState('')
  const queryClient = useQueryClient()

  const { data: salon } = useQuery({
    queryKey: salonKeys.detail(currentUser?.id ?? 'salon'),
    queryFn: () => salonApi.getById(currentUser?.id ?? ''),
    enabled: Boolean(currentUser?.id),
  })

  const mutation = useMutation({
    mutationFn: (payload: { description: string }) => fetch('/api/salons/unknown', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then((res) => res.json()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: salonKeys.detail(currentUser?.id ?? 'salon') })
    },
  })

  return (
    <div className="space-y-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <h1 className="text-xl font-bold text-slate-900">Панель администратора салона</h1>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-2xl border border-slate-200 px-3 py-2" placeholder="Описание салона" />
      <button onClick={() => mutation.mutate({ description })} className="rounded-2xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Сохранить</button>
      <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">{salon?.description ?? 'Описание салона.'}</div>
    </div>
  )
}
