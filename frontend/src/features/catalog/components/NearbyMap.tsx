import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Navigation } from 'lucide-react'
import { Link } from 'react-router-dom'
import { nearbyApi } from '../api/nearbyApi'
import type { NearbyCatalogItem } from '@pickme/api-types'
import { ClaimBusinessModal } from '../../business-claims/ClaimBusinessModal'

interface NearbyMapProps {
  latitude: number | null
  longitude: number | null
  address: string
  onAddressChange: (value: string) => void
  onRequestLocation: () => void
}

export function NearbyMap({ latitude, longitude, address, onAddressChange, onRequestLocation }: NearbyMapProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [locationStatus, setLocationStatus] = useState('')
  const [coordinates, setCoordinates] = useState({ latitude: 52.52, longitude: 13.405 })
  const [claimTarget, setClaimTarget] = useState<NearbyCatalogItem | null>(null)
  const [claimId, setClaimId] = useState<string | undefined>(undefined)
  const fallbackLatitude = 52.52
  const fallbackLongitude = 13.405
  const effectiveLatitude = coordinates.latitude
  const effectiveLongitude = coordinates.longitude

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['nearby', effectiveLatitude, effectiveLongitude, searchQuery],
    queryFn: () => nearbyApi.list({
      latitude: effectiveLatitude,
      longitude: effectiveLongitude,
      radius: 5000,
      ...(searchQuery.trim() ? { query: searchQuery.trim() } : {}),
      category: 'hairdresser',
      limit: 20,
    }),
    enabled: true,
    staleTime: 30_000,
  })

  useEffect(() => {
    const nextLatitude = latitude ?? fallbackLatitude
    const nextLongitude = longitude ?? fallbackLongitude
    setCoordinates({ latitude: nextLatitude, longitude: nextLongitude })

    if (address && !['Standort wird ermittelt…', 'GPS deaktiviert'].includes(address)) {
      setLocationStatus(address)
    } else {
      setLocationStatus('')
    }
  }, [address, latitude, longitude])

  const items = useMemo(() => data ?? [], [data])

  const handleClaimClick = (item: NearbyCatalogItem) => {
    setClaimTarget(item)
    setClaimId(undefined)
  }

  return (
    <section className="space-y-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900">In Ihrer Nähe</h2>
          <p className="text-sm text-slate-600">Echte Orte in der Nähe und PickMe-Betriebe in einer Übersicht.</p>
        </div>
        <button onClick={onRequestLocation} className="rounded-2xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">GPS bestimmen</button>
      </div>

      <div className="rounded-2xl border border-slate-200 p-3">
        <label className="text-sm font-semibold text-slate-700">Adresse manuell suchen</label>
        <input
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.target.value)
            onAddressChange(event.target.value)
          }}
          placeholder="Adresse oder Stadtteil eingeben"
          className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2"
        />
      </div>

      <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
        <div className="flex items-center gap-2 font-semibold text-slate-900"><Navigation size={16} /> Aktueller Standort</div>
        <div className="mt-1">{locationStatus || address || 'Keine Standortdaten verfügbar'}</div>
        <div className="mt-1 text-xs text-slate-500">{effectiveLatitude.toFixed(4)}, {effectiveLongitude.toFixed(4)}</div>
      </div>

      {isPending ? <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">Orte werden geladen...</div> : null}
      {isError ? <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">Der Nearby-Katalog konnte nicht geladen werden. <button className="font-semibold underline" onClick={() => refetch()}>Erneut versuchen</button></div> : null}
      {!isPending && !isError && items.length === 0 ? <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">Keine passenden Orte in der Nähe gefunden.</div> : null}

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id}>
            <article className="rounded-2xl border border-slate-200 p-3">
              <div className={item.source === 'EXTERNAL' ? 'md:grid md:grid-cols-[minmax(0,1fr)_18rem] md:gap-4' : ''}>
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className={`h-2.5 w-2.5 rounded-full ${item.source === 'PICKME' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        <h3 className="font-semibold text-slate-900">{item.name}</h3>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{item.address || 'Adresse nicht angegeben'}</p>
                    </div>
                    <div className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                      {item.source === 'PICKME' ? 'PickMe' : 'Extern'}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-700">
                    {item.distanceKm != null ? <span>{item.distanceKm} km</span> : null}
                    {item.rating != null ? <span>★ {item.rating}</span> : null}
                    {item.openNow != null ? <span>{item.openNow ? 'Geöffnet' : 'Geschlossen'}</span> : null}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {item.source === 'PICKME' ? (
                      <Link
                        to={`/salons/${item.id.replace('pickme-', '')}`}
                        className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                      >
                        Online buchen
                      </Link>
                    ) : (
                      <Link
                        to={`/salons/external/${encodeURIComponent(item.externalPlaceId ?? item.id)}`}
                        state={{ name: item.name, address: item.address, rating: item.rating?.toString(), reviewCount: item.reviewCount?.toString(), distanceKm: item.distanceKm?.toString(), externalUrl: item.externalUrl, googlePlaceId: item.externalPlaceId }}
                        className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"
                      >
                        Mehr anzeigen
                      </Link>
                    )}
                  </div>
                </div>

                {item.source === 'EXTERNAL' ? (
                  <aside className="mt-3 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-3 md:mt-0">
                    <div className="hidden sm:block">
                      <div className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">FÜR UNTERNEHMEN</div>
                      <h4 className="mt-2 text-lg font-bold text-slate-900">Ist das Ihr Salon?</h4>
                      <p className="mt-1 text-sm text-slate-700">Übernehmen Sie Ihr Profil und verwalten Sie Termine, Mitarbeiter und freie Zeiten.</p>
                      <div className="mt-2 inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">30 Tage kostenlos</div>
                      <button
                        onClick={() => handleClaimClick(item)}
                        className="mt-3 w-full rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                        type="button"
                      >
                        Geschäft übernehmen
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2 sm:hidden">
                      <div className="text-sm font-semibold text-slate-900">Ist das Ihr Salon?</div>
                      <button
                        onClick={() => handleClaimClick(item)}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
                        type="button"
                      >
                        Jetzt übernehmen
                      </button>
                    </div>
                  </aside>
                ) : null}
              </div>
            </article>
          </div>
        ))}
      </div>

      {claimTarget && (
        <ClaimBusinessModal
          isOpen={!!claimTarget}
          onClose={() => setClaimTarget(null)}
          googlePlaceId={claimTarget.externalPlaceId ?? undefined}
          salonName={claimTarget.name}
          address={claimTarget.address ?? undefined}
          claimId={claimId}
          onClaimCreated={(id) => setClaimId(id)}
        />
      )}
    </section>
  )
}
