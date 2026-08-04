import { useMemo } from 'react'
import { Compass, Navigation } from 'lucide-react'
import type { NearbyCatalogItem } from '../api/nearbyApi'

interface NearbyMapProps {
  latitude: number | null
  longitude: number | null
  address: string
  onRequestLocation: () => void
  items: NearbyCatalogItem[]
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  compact?: boolean
}

export function NearbyMap({ latitude, longitude, address, onRequestLocation, items, isLoading, isError, onRetry, compact = false }: NearbyMapProps) {
  const locationLabel = address || 'Ваш район'

  const markerItems = useMemo(
    () =>
      items.filter(
        (item) => item.latitude != null && item.longitude != null,
      ),
    [items],
  )

  const bounds = useMemo(() => {
    const coordinates: Array<{ latitude: number; longitude: number }> = []
    if (latitude != null && longitude != null) {
      coordinates.push({ latitude, longitude })
    }
    markerItems.forEach((item) => {
      coordinates.push({ latitude: item.latitude as number, longitude: item.longitude as number })
    })

    if (coordinates.length === 0) return null

    const minLat = Math.min(...coordinates.map((point) => point.latitude))
    const maxLat = Math.max(...coordinates.map((point) => point.latitude))
    const minLon = Math.min(...coordinates.map((point) => point.longitude))
    const maxLon = Math.max(...coordinates.map((point) => point.longitude))

    const latPad = Math.max((maxLat - minLat) * 0.25, 0.005)
    const lonPad = Math.max((maxLon - minLon) * 0.25, 0.005)

    return {
      minLat: minLat - latPad,
      maxLat: maxLat + latPad,
      minLon: minLon - lonPad,
      maxLon: maxLon + lonPad,
    }
  }, [latitude, longitude, markerItems])

  const project = (pointLat: number, pointLon: number) => {
    if (!bounds) return { left: 50, top: 50 }
    const lonRange = Math.max(bounds.maxLon - bounds.minLon, 0.0001)
    const latRange = Math.max(bounds.maxLat - bounds.minLat, 0.0001)
    const left = ((pointLon - bounds.minLon) / lonRange) * 100
    const top = ((bounds.maxLat - pointLat) / latRange) * 100
    return {
      left: Math.min(Math.max(left, 2), 98),
      top: Math.min(Math.max(top, 2), 98),
    }
  }

  const embedUrl = useMemo(() => {
    if (latitude == null || longitude == null) return null
    const lat = latitude
    const lon = longitude
    const bbox = `${lon - 0.04},${lat - 0.03},${lon + 0.04},${lat + 0.03}`
    return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat},${lon}`
  }, [latitude, longitude])

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Карта рядом</h2>
          <p className="mt-1 text-xs text-slate-500">Текущая локация и ближайшие результаты на одном экране.</p>
        </div>
        <button onClick={onRequestLocation} className="rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          Вокруг меня
        </button>
      </div>

      <div className={`relative mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 ${compact ? 'h-[300px]' : 'h-[440px]'}`}>
        {embedUrl ? (
          <iframe
            title="Карта рядом"
            src={embedUrl}
            className="h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-500">
            Определите локацию, чтобы увидеть реальные салоны на карте.
          </div>
        )}

        {embedUrl && bounds ? (
          <div className="pointer-events-none absolute inset-0">
            {latitude != null && longitude != null ? (
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={project(latitude, longitude)}
                aria-label="Ваша позиция"
              >
                <div className="h-4 w-4 rounded-full border-2 border-white bg-blue-600 shadow" />
              </div>
            ) : null}

            {markerItems.map((item) => (
              <div
                key={`marker-${item.id}`}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={project(item.latitude as number, item.longitude as number)}
                aria-label={`Метка: ${item.name}`}
                title={item.name}
              >
                <div className={`h-3.5 w-3.5 rounded-full border border-white shadow ${item.isPickmeConnected ? 'bg-emerald-600' : 'bg-amber-500'}`} />
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-brand-700">
          <Navigation size={12} /> {locationLabel}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1"><span className="h-2 w-2 rounded-full bg-emerald-600" /> PickMe</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Внешние</span>
      </div>

      {isLoading ? <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">Обновляем ближайшие варианты...</div> : null}
      {isError ? <div className="mt-3 rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">Не удалось загрузить варианты. <button className="font-semibold underline" onClick={onRetry}>Повторить</button></div> : null}
      {!isLoading && !isError && items.length === 0 ? <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">Пока нет результатов в этом районе.</div> : null}

      {compact && items.length > 0 ? (
        <div className="mt-3 space-y-2">
          {items.slice(0, 2).map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-slate-900">{item.name}</h3>
                  <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                    <Compass size={14} /> {item.address || 'Адрес уточняется'}
                  </div>
                </div>
                <div className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {item.distanceKm != null ? `${item.distanceKm.toFixed(1)} км` : 'Рядом'}
                </div>
              </div>
              <div className="mt-2 text-xs font-semibold text-slate-500">
                {item.source === 'EXTERNAL' ? 'Внешний каталог' : 'Партнер PickMe'}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  )
}
