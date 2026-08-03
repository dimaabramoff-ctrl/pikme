import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { MasterCard } from '../features/masters/components/MasterCard'
import { masterApi } from '../features/masters/api/masterApi'
import { masterKeys } from '../shared/query/queryKeys'

export function MastersPage() {
  const [search, setSearch] = useState('')
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: masterKeys.list({ search }),
    queryFn: () => masterApi.list({ search, limit: 20, offset: 0 }),
  })

  const masters = useMemo(() => data?.items ?? [], [data])

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <h1 className="text-xl font-bold text-slate-900">Мастера</h1>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по имени или специализации" className="mt-3 w-full rounded-2xl border border-slate-200 px-3 py-2" />
      </section>
      {isPending && <div className="rounded-3xl bg-white p-4 text-sm text-slate-600">Загрузка...</div>}
      {isError && <div className="rounded-3xl bg-white p-4 text-sm text-rose-600">Не удалось загрузить мастеров. <button onClick={() => refetch()} className="font-semibold underline">Повторить</button></div>}
      <div className="space-y-3">
        {masters.map((master) => (
          <a key={master.id} href={`/masters/${master.id}`}>
            <MasterCard master={master} />
          </a>
        ))}
      </div>
    </div>
  )
}
