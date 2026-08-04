import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock3, MapPin, Scissors, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import { NearbyMap } from '../features/catalog/components/NearbyMap'
import { type NearbyCatalogItem, nearbyApi } from '../features/catalog/api/nearbyApi'
import { useUiStore } from '../shared/store/uiStore'

type GeoState = 'idle' | 'loading' | 'denied' | 'timeout' | 'unavailable'

interface ApiLikeError {
  statusCode?: number
  code?: string
  message?: string
}

function formatDistance(distanceKm?: number | null) {
  if (distanceKm == null) return 'Рядом'
  if (distanceKm < 1) return 'Менее 1 км'
  return `${distanceKm.toFixed(1)} км`
}

function getEntityType(item: NearbyCatalogItem): 'salon' | 'master' {
  return item.id.startsWith('pickme-master:') ? 'master' : 'salon'
}

function getSpecialization(item: NearbyCatalogItem) {
  if (item.category && item.category.trim().length > 0) return item.category
  return 'Стрижки и укладки'
}

function formatGoogleRating(item: NearbyCatalogItem) {
  if (item.rating == null) return 'Рейтинг уточняется'
  return `★ ${item.rating.toFixed(1)}${item.source === 'EXTERNAL' ? ' Google' : ''}`
}

function formatNearestSlot(item: NearbyCatalogItem) {
  if (!item.isPickmeConnected) return null
  if (!item.nextAvailableSlot) return 'По запросу'

  const date = new Date(item.nextAvailableSlot)
  if (Number.isNaN(date.getTime())) return 'По запросу'

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatOperationalValue(value: number | null) {
  return value == null ? 'По запросу' : String(value)
}

function formatMinPrice(value: number | null) {
  if (value == null) return 'По запросу'
  return `от €${value}`
}

function getPhotoUrl(item: NearbyCatalogItem) {
  if (item.photoUrl && item.photoUrl.startsWith('http')) return item.photoUrl
  return null
}

function getGeoErrorMessage(state: GeoState) {
  if (state === 'denied') return 'Доступ к геолокации запрещен. Включите разрешение в браузере.'
  if (state === 'timeout') return 'Не удалось получить координаты вовремя. Повторите попытку.'
  if (state === 'unavailable') return 'Геолокация недоступна на этом устройстве.'
  if (state === 'loading') return 'Определяем вашу геопозицию...'
  return 'Нажмите "Вокруг меня", чтобы загрузить реальные салоны рядом.'
}

function extractApiError(error: unknown): ApiLikeError | null {
  if (!error || typeof error !== 'object') return null
  const candidate = error as Record<string, unknown>
  return {
    statusCode: typeof candidate.statusCode === 'number' ? candidate.statusCode : undefined,
    code: typeof candidate.code === 'string' ? candidate.code : undefined,
    message: typeof candidate.message === 'string' ? candidate.message : undefined,
  }
}

function getCatalogErrorMessage(error: unknown) {
  const apiError = extractApiError(error)
  if (!apiError) return 'Не удалось загрузить каталог рядом.'
  if (apiError.code === 'CATALOG_PROVIDER_UNAVAILABLE' || apiError.statusCode === 503) {
    return 'Google Places временно недоступен. Повторите попытку через минуту.'
  }
  if (apiError.code === 'CATALOG_PROVIDER_NOT_CONFIGURED') {
    return 'Google Places не настроен на сервере.'
  }
  if (apiError.code === 'NETWORK_ERROR') {
    return 'Сервер недоступен. Проверьте соединение и повторите попытку.'
  }
  return apiError.message || 'Не удалось загрузить каталог рядом.'
}

export function HomePage() {
  const { entityFilter } = useUiStore()
  const [locationState, setLocationState] = useState<{ latitude: number | null; longitude: number | null; address: string }>({
    latitude: null,
    longitude: null,
    address: 'Локация не выбрана',
  })
  const [geoState, setGeoState] = useState<GeoState>('idle')
  const [manualAddressPending, setManualAddressPending] = useState(false)

  const { data, isPending, isError, refetch, error } = useQuery({
    queryKey: ['home-nearby', locationState.latitude, locationState.longitude, entityFilter],
    queryFn: () =>
      nearbyApi.list({
        latitude: locationState.latitude as number,
        longitude: locationState.longitude as number,
        radius: entityFilter === 'MASTER' ? 8000 : 6000,
        query: entityFilter === 'MASTER' ? 'mobile hair stylist' : 'hair salon',
        category: entityFilter === 'MASTER' ? 'barber_shop' : 'hair_salon',
        limit: 30,
      }),
    enabled: locationState.latitude != null && locationState.longitude != null,
  })

  const typedItems = useMemo(() => {
    const items = data ?? []
    if (entityFilter === 'MASTER') return items.filter((item) => getEntityType(item) === 'master')
    return items.filter((item) => getEntityType(item) === 'salon')
  }, [data, entityFilter])

  const sortedItems = useMemo(() => {
    const items = [...typedItems]
    if (entityFilter === 'MASTER') {
      items.sort((a, b) => (a.distanceKm ?? Number.MAX_SAFE_INTEGER) - (b.distanceKm ?? Number.MAX_SAFE_INTEGER))
      return items
    }

    items.sort((a, b) => {
      const pickmeA = a.isPickmeConnected ? 0 : 1
      const pickmeB = b.isPickmeConnected ? 0 : 1
      if (pickmeA !== pickmeB) return pickmeA - pickmeB
      return (a.distanceKm ?? Number.MAX_SAFE_INTEGER) - (b.distanceKm ?? Number.MAX_SAFE_INTEGER)
    })

    return items
  }, [typedItems, entityFilter])

  const handleRequestLocation = () => {
    if (!navigator.geolocation) {
      setGeoState('unavailable')
      return
    }

    setGeoState('loading')

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationState({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          address: 'Ваш район',
        })
        setGeoState('idle')
      },
      (geoError) => {
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setGeoState('denied')
          return
        }
        if (geoError.code === geoError.TIMEOUT) {
          setGeoState('timeout')
          return
        }
        setGeoState('unavailable')
      },
      { timeout: 7_000, enableHighAccuracy: true },
    )
  }

  const handleManualAddress = async () => {
    const typedAddress = window.prompt('Введите город или район', locationState.address)
    if (!typedAddress) return
    const normalized = typedAddress.trim()
    if (!normalized) return

    setManualAddressPending(true)
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(normalized)}`)
      const payload = (await response.json().catch(() => [])) as Array<{ lat: string; lon: string }>
      const first = payload[0]

      if (!first) {
        setLocationState((prev) => ({ ...prev, address: normalized }))
        setGeoState('unavailable')
        return
      }

      setLocationState({
        latitude: Number(first.lat),
        longitude: Number(first.lon),
        address: normalized,
      })
      setGeoState('idle')
    } catch {
      setGeoState('unavailable')
    } finally {
      setManualAddressPending(false)
    }
  }

  const cardsLabel = entityFilter === 'MASTER' ? 'Мастера на дом' : 'Салоны рядом'
  const visibleCount = sortedItems.length
  const isMasterMode = entityFilter === 'MASTER'

  const renderExternalSalonCard = (item: NearbyCatalogItem) => {
    const photoUrl = getPhotoUrl(item)
    const linkTo = item.externalUrl || '#'

    return (
      <article key={item.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex gap-3">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-brand-50">
            {photoUrl ? (
              <img src={photoUrl} alt={item.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-brand-700">{item.name.charAt(0).toUpperCase()}</div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="truncate text-base font-semibold text-slate-900">{item.name}</h3>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{formatDistance(item.distanceKm)}</span>
            </div>
            <p className="mt-1 truncate text-xs text-slate-500">{item.address || 'Адрес уточняется'}</p>
            <p className="mt-2 text-xs font-medium text-slate-600">{formatGoogleRating(item)}{item.reviewCount != null ? ` · ${item.reviewCount} отзывов` : ''}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">Внешний каталог</span>
          <a
            href={linkTo}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Подробнее
          </a>
        </div>
      </article>
    )
  }

  const renderPickmeSalonCard = (item: NearbyCatalogItem) => {
    const photoUrl = getPhotoUrl(item)
    const linkTo = `/salons/${item.id.replace('pickme-salon:', '')}`
    const nearestSlot = formatNearestSlot(item)
    const ctaLabel = item.onlineBookingAvailable ? 'Записаться' : 'Выбрать'

    return (
      <article key={item.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex gap-3">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-brand-50">
            {photoUrl ? (
              <img src={photoUrl} alt={item.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-brand-700">{item.name.charAt(0).toUpperCase()}</div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-slate-900">{item.name}</h3>
                <p className="mt-1 truncate text-xs text-slate-500">{item.address || 'Адрес уточняется'}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{formatDistance(item.distanceKm)}</span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-brand-50 px-2 py-1 font-semibold text-brand-700">PickMe Partner</span>
              <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">{formatGoogleRating(item)}</span>
              {item.reviewCount != null ? <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">{item.reviewCount} отзывов</span> : null}
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 px-3 py-2">
            <div className="text-[11px] text-slate-500">Мастеров на смене</div>
            <div className="mt-0.5 font-semibold text-slate-800">{formatOperationalValue(item.mastersOnShift)}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 px-3 py-2">
            <div className="text-[11px] text-slate-500">Свободны сейчас</div>
            <div className="mt-0.5 font-semibold text-slate-800">{formatOperationalValue(item.availableMasters)}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 px-3 py-2">
            <div className="text-[11px] text-slate-500">Заняты</div>
            <div className="mt-0.5 font-semibold text-slate-800">{formatOperationalValue(item.busyMasters)}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 px-3 py-2">
            <div className="text-[11px] text-slate-500">Ближайшее время</div>
            <div className="mt-0.5 font-semibold text-slate-800">{nearestSlot}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 px-3 py-2">
            <div className="text-[11px] text-slate-500">Цена от</div>
            <div className="mt-0.5 font-semibold text-slate-800">{formatMinPrice(item.minPrice)}</div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1 text-xs text-slate-600"><Clock3 size={12} /> PickMe Partner</span>
          <Link to={linkTo} className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700">
            {ctaLabel}
          </Link>
        </div>
      </article>
    )
  }

  const renderMasterCard = (item: NearbyCatalogItem) => {
    const photoUrl = getPhotoUrl(item)
    const linkTo = `/masters/${item.id.replace('pickme-master:', '')}`

    return (
      <article key={item.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex gap-3">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-brand-50">
            {photoUrl ? (
              <img src={photoUrl} alt={item.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-brand-700">{item.name.charAt(0).toUpperCase()}</div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="truncate text-base font-semibold text-slate-900">{item.name}</h3>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{formatDistance(item.distanceKm)}</span>
            </div>
            <p className="mt-1 truncate text-xs text-slate-500">{item.address || 'Район уточняется'}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-brand-50 px-2 py-1 font-semibold text-brand-700">PickMe ✓</span>
              <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700"><Star size={12} className="inline" /> {item.rating != null ? item.rating.toFixed(1) : 'Рейтинг уточняется'}</span>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 px-3 py-2">
            <div className="text-[11px] text-slate-500">Специализация</div>
            <div className="mt-0.5 font-semibold text-slate-800">{getSpecialization(item)}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 px-3 py-2">
            <div className="text-[11px] text-slate-500">Выезд на дом</div>
            <div className="mt-0.5 font-semibold text-emerald-700">Да</div>
          </div>
          <div className="rounded-2xl bg-slate-50 px-3 py-2">
            <div className="text-[11px] text-slate-500">Ближайшее время</div>
            <div className="mt-0.5 font-semibold text-slate-800">{item.isBookable ? 'Сейчас' : 'Уточняется'}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 px-3 py-2">
            <div className="text-[11px] text-slate-500">Цена от</div>
            <div className="mt-0.5 font-semibold text-slate-800">в профиле</div>
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <Link to={linkTo} className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700">
            Записаться
          </Link>
        </div>
      </article>
    )
  }

  const renderCard = (item: NearbyCatalogItem) => {
    if (entityFilter === 'MASTER') return renderMasterCard(item)
    if (!item.isPickmeConnected) return renderExternalSalonCard(item)
    return renderPickmeSalonCard(item)
  }

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{isMasterMode ? 'Мастера на дом рядом с вами' : 'Салоны рядом с вами'}</h1>
            <p className="mt-1 text-xs text-slate-500">Нажмите «Вокруг меня», чтобы сразу увидеть подходящие варианты.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700">
            <Scissors size={12} />
            {isMasterMode ? 'На дом' : 'Салоны'}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button onClick={handleRequestLocation} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700">
            <MapPin size={16} />
            {geoState === 'loading' ? 'Определяем...' : 'Вокруг меня'}
          </button>
          <button
            onClick={() => {
              void handleManualAddress()
            }}
            className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            {manualAddressPending ? 'Ищем адрес...' : 'Ввести адрес'}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
            <MapPin size={12} className="text-brand-700" /> {locationState.address}
          </span>
          <span className="text-slate-500">•</span>
          <span>{getGeoErrorMessage(geoState)}</span>
        </div>
      </section>

      <NearbyMap
        latitude={locationState.latitude}
        longitude={locationState.longitude}
        address={locationState.address}
        onRequestLocation={handleRequestLocation}
        items={sortedItems}
        isLoading={isPending}
        isError={isError}
        onRetry={() => refetch()}
        compact
      />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{cardsLabel}</h2>
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">{visibleCount}</span>
        </div>

        {locationState.latitude == null || locationState.longitude == null ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Разрешите геолокацию или укажите адрес для поиска рядом.</div>
        ) : null}
        {isPending ? <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Подбираем ближайшие варианты...</div> : null}
        {isError ? <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{getCatalogErrorMessage(error)} <button onClick={() => refetch()} className="font-semibold underline">Повторить</button></div> : null}
        {!isPending && !isError && sortedItems.length === 0 ? <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600">По выбранной локации пока нет подходящих результатов.</div> : null}

        <div className="space-y-3">{sortedItems.map(renderCard)}</div>
      </section>
    </div>
  )
}
