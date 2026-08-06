import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuthStore } from '../features/auth/authStore'
import { masterApi } from '../features/masters/api/masterApi'
import { masterKeys } from '../shared/query/queryKeys'

export function MasterPanelPage() {
  const currentUser = useAuthStore((state) => state.currentUser)
  const [biography, setBiography] = useState('')
  const queryClient = useQueryClient()

  const { data: master } = useQuery({
    queryKey: masterKeys.detail(currentUser?.id ?? 'me'),
    queryFn: () => masterApi.getById(currentUser?.id ?? ''),
    enabled: Boolean(currentUser?.id),
  })

  const mutation = useMutation({
    mutationFn: (payload: { biography: string }) => fetch('/api/masters/me', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then((res) => res.json()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: masterKeys.detail(currentUser?.id ?? 'me') })
    },
  })

  return (
    <div className="space-y-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <h1 className="text-xl font-bold text-slate-900">Meister-Bereich</h1>
      <textarea value={biography} onChange={(e) => setBiography(e.target.value)} className="w-full rounded-2xl border border-slate-200 px-3 py-2" placeholder="Biografie" />
      <button onClick={() => mutation.mutate({ biography })} className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Speichern</button>
      <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">{master?.biography ?? 'Meisterprofil.'}</div>
    </div>
  )
}
