import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { salonApi } from '../features/salons/api/salonApi'
import { masterApi } from '../features/masters/api/masterApi'
import { salonKeys, masterKeys } from '../shared/query/queryKeys'
import type { SalonMasterListItem } from '../shared/api/types'

export function SalonDetailPage() {
  const { salonId } = useParams()
  const { data: salon, isPending, isError } = useQuery({
    queryKey: salonKeys.detail(salonId ?? 'unknown'),
    queryFn: () => salonApi.getById(salonId ?? ''),
    enabled: Boolean(salonId),
  })
  const { data: masters } = useQuery({
    queryKey: masterKeys.list({ salonId }),
    queryFn: () => masterApi.list({ salonId, limit: 10, offset: 0 }),
    enabled: Boolean(salonId),
  })

  if (isPending) return <div className="rounded-3xl bg-white p-4">Загрузка...</div>
  if (isError || !salon) return <div className="rounded-3xl bg-white p-4">Салон не найден.</div>

  const getLinkedMaster = (item: SalonMasterListItem) => ('master' in item ? item.master : item)

  return (
    <div className="space-y-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <h1 className="text-xl font-bold text-slate-900">{salon.name}</h1>
      <p className="text-sm text-slate-600">{salon.description}</p>
      <div className="text-sm text-slate-700">{salon.city}, {salon.postalCode}</div>
      <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">Онлайн-запись будет доступна после подключения расписания и свободных слотов.</div>
      <div className="space-y-2">
        <h2 className="font-semibold">Мастера</h2>
        {(masters?.items ?? []).map((master: SalonMasterListItem) => {
          const linkedMaster = getLinkedMaster(master)
          return (
            <a
              key={master.id}
              href={`/masters/${linkedMaster?.id ?? master.id}`}
              className="block rounded-2xl bg-slate-50 p-3 text-sm"
            >
              {linkedMaster?.displayName ?? master.displayName}
            </a>
          )
        })}
      </div>
    </div>
  )
}
