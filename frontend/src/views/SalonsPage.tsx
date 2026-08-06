import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { salonApi } from '../features/salons/api/salonApi'
import { SalonCard } from '../features/salons/components/SalonCard'
import { salonKeys } from '../shared/query/queryKeys'

export function SalonsPage() {
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('Berlin')

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: salonKeys.list({ search, city }),
    queryFn: () => salonApi.list({ search, city, limit: 20, offset: 0 }),
  })

  const salons = useMemo(() => data?.items ?? [], [data])

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <h1 className="text-xl font-bold text-slate-900">Salons</h1>
        <div className="mt-3 flex gap-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nach Name oder Stadt suchen" className="w-full rounded-2xl border border-slate-200 px-3 py-2" />
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Stadt" className="w-36 rounded-2xl border border-slate-200 px-3 py-2" />
        </div>
      </section>
      {isPending && <div className="rounded-3xl bg-white p-4 text-sm text-slate-600">Wird geladen...</div>}
      {isError && <div className="rounded-3xl bg-white p-4 text-sm text-rose-600">Salons konnten nicht geladen werden. <button onClick={() => refetch()} className="font-semibold underline">Erneut versuchen</button></div>}
      {!isPending && salons.length === 0 && <div className="rounded-3xl bg-white p-4 text-sm text-slate-600">Keine Treffer gefunden.</div>}
      <div className="space-y-3">
        {salons.map((salon) => (
          <a key={salon.id} href={`/salons/${salon.id}`}>
            <SalonCard salon={salon} />
          </a>
        ))}
      </div>
    </div>
  )
}
