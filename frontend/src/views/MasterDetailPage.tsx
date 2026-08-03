import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { masterApi } from '../features/masters/api/masterApi'
import { masterKeys } from '../shared/query/queryKeys'

export function MasterDetailPage() {
  const { masterId } = useParams()
  const { data: master, isPending, isError } = useQuery({
    queryKey: masterKeys.detail(masterId ?? 'unknown'),
    queryFn: () => masterApi.getById(masterId ?? ''),
    enabled: Boolean(masterId),
  })

  if (isPending) return <div className="rounded-3xl bg-white p-4">Загрузка...</div>
  if (isError || !master) return <div className="rounded-3xl bg-white p-4">Мастер не найден.</div>

  return (
    <div className="space-y-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <h1 className="text-xl font-bold text-slate-900">{master.displayName}</h1>
      <p className="text-sm text-slate-600">{master.biography ?? master.specialization}</p>
      <div className="text-sm text-slate-700">Опыт: {master.experienceYears} лет</div>
      <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">Расписание и запись будут доступны на следующем этапе.</div>
    </div>
  )
}
