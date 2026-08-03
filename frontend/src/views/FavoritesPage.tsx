import { useQuery } from '@tanstack/react-query'
import { favoriteApi } from '../features/favorites/api/favoriteApi'
import { favoriteKeys } from '../shared/query/queryKeys'

export function FavoritesPage() {
  const { data, isPending } = useQuery({
    queryKey: favoriteKeys.list(),
    queryFn: () => favoriteApi.list(),
  })

  if (isPending) return <div className="rounded-3xl bg-white p-4">Загрузка...</div>

  return (
    <div className="space-y-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <h1 className="text-xl font-bold text-slate-900">Избранное</h1>
      <div className="space-y-3">
        <div>
          <h2 className="font-semibold">Салоны</h2>
          {(data?.salons ?? []).map((salon) => <div key={salon.id} className="mt-2 rounded-2xl bg-slate-50 p-3 text-sm">{salon.name}</div>)}
        </div>
        <div>
          <h2 className="font-semibold">Мастера</h2>
          {(data?.masters ?? []).map((master) => <div key={master.id} className="mt-2 rounded-2xl bg-slate-50 p-3 text-sm">{master.displayName}</div>)}
        </div>
      </div>
    </div>
  )
}
