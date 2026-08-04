import { useMemo } from 'react'
import { Compass, MapPin, Navigation } from 'lucide-react'
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
          <p className="mt-1 text-sm text-slate-600">Показываем салоны и мастеров около выбранного района.</p>
        </div>
        <button onClick={onRequestLocation} className="rounded-full bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          Вокруг меня
        </button>
      </div>

      <div className={`mt-4 overflow-hidden rounded-[22px] border border-slate-200 bg-slate-50 ${compact ? 'h-[320px]' : 'h-[460px]'}`}>
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
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-brand-700">
          <Navigation size={12} /> {locationLabel}
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1">Салоны</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1">На дом</span>
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
                {item.source === 'EXTERNAL' ? 'Внешний источник' : 'Партнер PickMe'}
              </div>
            </article>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
        <MapPin size={13} /> Точка обновляется под выбранный район и список вариантов.
      </div>
    </section>
  )
}
