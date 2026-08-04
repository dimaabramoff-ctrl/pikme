import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock3, Map, MapPin, Search, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import { NearbyMap } from '../features/catalog/components/NearbyMap'
import { type NearbyCatalogItem, nearbyApi } from '../features/catalog/api/nearbyApi'
import { useUiStore } from '../shared/store/uiStore'

type FilterMode = 'freeNow' | 'nearby' | 'rating' | 'price' | 'today'
type ViewMode = 'list' | 'map'
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

function formatRating(item: NearbyCatalogItem) {
  if (item.rating && item.rating > 0) return item.rating.toFixed(1)
  return 'n/a'
}

function getEntityType(item: NearbyCatalogItem): 'salon' | 'master' {
  return item.id.startsWith('pickme-master:') ? 'master' : 'salon'
}

function getSpecialization(item: NearbyCatalogItem) {
  if (item.category && item.category.trim().length > 0) return item.category
  return 'Стрижки и укладки'
}

function getStatusLabel(item: NearbyCatalogItem) {
  if (item.openNow === true) return 'Открыто'
  if (item.openNow === false) return 'Закрыто'
  return 'Статус не указан'
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
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterMode>('nearby')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [geoState, setGeoState] = useState<GeoState>('idle')

  const { data, isPending, isError, refetch, error } = useQuery({
    queryKey: ['home-nearby', locationState.latitude, locationState.longitude, entityFilter, searchQuery],
    queryFn: () =>
      nearbyApi.list({
        latitude: locationState.latitude as number,
        longitude: locationState.longitude as number,
        radius: entityFilter === 'MASTER' ? 8000 : 6000,
        query: searchQuery.trim() || undefined,
        category: 'hairdresser',
        limit: 30,
      }),
    enabled: locationState.latitude != null && locationState.longitude != null,
  })

  const nearbyItems = useMemo(() => data ?? [], [data])

  const searchedItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return nearbyItems
    return nearbyItems.filter((item) => {
      const haystack = `${item.name} ${item.address ?? ''} ${item.category ?? ''}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [nearbyItems, searchQuery])

  const typedItems = useMemo(() => {
    if (entityFilter === 'MASTER') return searchedItems.filter((item) => getEntityType(item) === 'master')
    if (entityFilter === 'SALON') return searchedItems.filter((item) => getEntityType(item) === 'salon')
    return searchedItems
  }, [entityFilter, searchedItems])

  const filteredItems = useMemo(() => {
    switch (activeFilter) {
      case 'freeNow':
        return typedItems.filter((item) => item.isPickmeConnected && item.isBookable)
      case 'today':
        return typedItems.filter((item) => item.isBookable || item.openNow === true)
      default:
        return typedItems
    }
  }, [activeFilter, typedItems])

  const sortedItems = useMemo(() => {
    const items = [...filteredItems]
    items.sort((a, b) => {
      if (a.isPickmeConnected !== b.isPickmeConnected) {
        return a.isPickmeConnected ? -1 : 1
      }
      return (a.distanceKm ?? Number.MAX_SAFE_INTEGER) - (b.distanceKm ?? Number.MAX_SAFE_INTEGER)
    })
    return items
  }, [filteredItems])

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

  const handleManualAddress = () => {
    const typedAddress = window.prompt('Введите город или район', locationState.address)
    if (!typedAddress) return
    const normalized = typedAddress.trim()
    if (!normalized) return
    setLocationState((prev) => ({ ...prev, address: normalized === 'Локация не выбрана' ? prev.address : normalized }))
    setSearchQuery(normalized)

    if (locationState.latitude == null || locationState.longitude == null) {
      handleRequestLocation()
    }
  }

  const cardsLabel = entityFilter === 'MASTER' ? 'Мастера на дом рядом' : 'Салоны рядом'
  const visibleCount = sortedItems.length

  const renderCard = (item: NearbyCatalogItem) => {
    const isMaster = getEntityType(item) === 'master'
    const isExternal = item.source === 'EXTERNAL'
    const linkTo = isExternal
      ? item.externalUrl || '#'
      : isMaster
        ? `/masters/${item.id.replace('pickme-master:', '')}`
        : `/salons/${item.id.replace('pickme-salon:', '')}`

    const photoUrl = getPhotoUrl(item)

    return (
      <article key={item.id} className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:p-4">
        <div className="flex gap-3">
          <div className="relative h-18 w-18 shrink-0 overflow-hidden rounded-2xl bg-brand-50 sm:h-20 sm:w-20">
            {photoUrl ? (
              <img src={photoUrl} alt={item.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-brand-700">{item.name.charAt(0).toUpperCase()}</div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-base font-semibold text-slate-900">{item.name}</h3>
                  {item.isPickmeConnected ? (
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">PickMe ✓</span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">Внешний источник</span>
                  )}
                </div>
                <p className="mt-1 truncate text-xs text-slate-500">{item.address || 'Адрес уточняется'}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{formatDistance(item.distanceKm)}</span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">
                <Star size={12} /> {formatRating(item)}
              </span>
              {isExternal ? <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">Google Maps</span> : <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">PickMe</span>}
              {item.reviewCount != null ? (
                <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">{item.reviewCount} отзывов</span>
              ) : null}
              {isExternal ? (
                <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">Статус: {getStatusLabel(item)}</span>
              ) : (
                <>
                  <span className="rounded-full bg-brand-50 px-2 py-1 font-semibold text-brand-700">Цена: в профиле</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700"><Clock3 size={12} /> {item.isBookable ? 'Онлайн-запись доступна' : 'Запись по запросу'}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          {!item.isPickmeConnected ? (
            <>
              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                <div className="text-[11px] text-slate-500">Статус</div>
                <div className="mt-0.5 font-semibold text-slate-800">{getStatusLabel(item)}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                <div className="text-[11px] text-slate-500">Категория</div>
                <div className="mt-0.5 font-semibold text-slate-800">{getSpecialization(item)}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                <div className="text-[11px] text-slate-500">Рейтинг источника</div>
                <div className="mt-0.5 font-semibold text-slate-800">Google Maps{item.rating != null ? ` · ${item.rating.toFixed(1)}` : ''}</div>
              </div>
              <a
                href={linkTo}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Открыть на карте
              </a>
            </>
          ) : isMaster ? (
            <>
              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                <div className="text-[11px] text-slate-500">Специализация</div>
                <div className="mt-0.5 font-semibold text-slate-800">{getSpecialization(item)}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                <div className="text-[11px] text-slate-500">Доступность</div>
                <div className="mt-0.5 font-semibold text-emerald-700">{item.isBookable ? 'Онлайн-запись' : 'По запросу'}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                <div className="text-[11px] text-slate-500">Цены</div>
                <div className="mt-0.5 font-semibold text-slate-800">В профиле</div>
              </div>
              <Link to={linkTo} className="inline-flex items-center justify-center rounded-2xl bg-brand-600 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700">
                {item.isBookable ? 'Записаться онлайн' : 'Подробнее'}
              </Link>
            </>
          ) : (
            <>
              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                <div className="text-[11px] text-slate-500">Доступность</div>
                <div className="mt-0.5 font-semibold text-emerald-700">{item.isBookable ? 'Онлайн-запись' : 'По запросу'}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                <div className="text-[11px] text-slate-500">Цены</div>
                <div className="mt-0.5 font-semibold text-slate-800">В профиле</div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                <div className="text-[11px] text-slate-500">Статус</div>
                <div className="mt-0.5 font-semibold text-slate-800">{getStatusLabel(item)}</div>
              </div>
              <Link to={linkTo} className="inline-flex items-center justify-center rounded-2xl bg-brand-600 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700">
                {item.isBookable ? 'Записаться онлайн' : 'Подробнее'}
              </Link>
            </>
          )}
        </div>
      </article>
    )
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[30px] border border-slate-200 bg-[linear-gradient(135deg,_rgba(255,255,255,1),_rgba(241,247,247,1))] p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-brand-700/80">PickMe</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-900">
              {entityFilter === 'MASTER' ? 'Бронируйте мастера на дом' : 'Найдите салон рядом'}
            </h1>
            <p className="mt-1 text-sm text-slate-600">Премиальный поиск без лишней суеты.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-700">
            <MapPin size={15} className="text-brand-700" />
            {locationState.address}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button onClick={handleRequestLocation} className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700">
            <MapPin size={16} />
            {geoState === 'loading' ? 'Определяем...' : 'Вокруг меня'}
          </button>
          <button onClick={handleManualAddress} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50">
            Ввести адрес
          </button>
        </div>

        <p className="mt-2 text-xs text-slate-500">{getGeoErrorMessage(geoState)}</p>

        <label className="mt-3 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <Search size={18} className="text-slate-400" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Поиск салона, услуги или мастера"
            className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
          />
        </label>

        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { key: 'freeNow', label: 'Свободно сейчас' },
            { key: 'nearby', label: 'Рядом' },
            { key: 'rating', label: 'Рейтинг' },
            { key: 'price', label: 'Цена' },
            { key: 'today', label: 'Сегодня' },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveFilter(item.key as FilterMode)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeFilter === item.key ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 shadow-sm hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {viewMode === 'list' ? (
        <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
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
              <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Разрешите геолокацию, чтобы загрузить реальные салоны рядом.</div>
            ) : null}
            {isPending ? <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Загружаем ближайшие варианты...</div> : null}
            {isError ? <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{getCatalogErrorMessage(error)} <button onClick={() => refetch()} className="font-semibold underline">Повторить</button></div> : null}
            {!isPending && !isError && sortedItems.length === 0 ? <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Нет результатов рядом. Измените фильтр или адрес.</div> : null}
            {sortedItems.map(renderCard)}
          </section>
        </div>
      ) : (
        <div className="space-y-4">
          <NearbyMap
            latitude={locationState.latitude}
            longitude={locationState.longitude}
            address={locationState.address}
            onRequestLocation={handleRequestLocation}
            items={sortedItems}
            isLoading={isPending}
            isError={isError}
            onRetry={() => refetch()}
          />

          <section className="grid gap-3 sm:grid-cols-2">
            {sortedItems.slice(0, 6).map(renderCard)}
          </section>
        </div>
      )}

      <div className="sticky bottom-24 z-10 sm:bottom-6">
        <div className="mx-auto flex w-fit gap-1 rounded-full border border-slate-200 bg-white/95 p-1 shadow-sm backdrop-blur">
          <button
            onClick={() => setViewMode('list')}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${viewMode === 'list' ? 'bg-brand-600 text-white' : 'text-slate-600'}`}
          >
            Список
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${viewMode === 'map' ? 'bg-brand-600 text-white' : 'text-slate-600'}`}
          >
            <Map size={16} />
            Карта
          </button>
        </div>
      </div>
    </div>
  )
}
