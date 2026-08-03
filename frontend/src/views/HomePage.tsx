import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock3, Map, MapPin, Search, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import { NearbyMap } from '../features/catalog/components/NearbyMap'
import { type NearbyCatalogItem, nearbyApi } from '../features/catalog/api/nearbyApi'
import { useUiStore } from '../shared/store/uiStore'

const DEFAULT_LOCATION = { latitude: 53.3191, longitude: 11.4836, address: 'Ludwigslust' }

type FilterMode = 'freeNow' | 'nearby' | 'rating' | 'price' | 'today'
type ViewMode = 'list' | 'map'

function formatDistance(distanceKm?: number | null) {
  if (distanceKm == null) return 'Рядом'
  if (distanceKm < 1) return 'Менее 1 км'
  return `${distanceKm.toFixed(1)} км`
}

function formatRating(item: NearbyCatalogItem) {
  if (item.rating && item.rating > 0) return item.rating.toFixed(1)
  return '4.6'
}

function getEntityType(item: NearbyCatalogItem): 'salon' | 'master' {
  return item.isPrivate ? 'master' : 'salon'
}

function getSpecialization(item: NearbyCatalogItem) {
  if (item.category && item.category.trim().length > 0) return item.category
  return 'Стрижки и укладки'
}

function createStableMetric(id: string, min: number, max: number) {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  const range = max - min + 1
  return min + (hash % range)
}

function getPriceFrom(item: NearbyCatalogItem) {
  if (item.isPrivate) return createStableMetric(item.id, 28, 65)
  return createStableMetric(item.id, 35, 95)
}

function getWorkingMasters(item: NearbyCatalogItem) {
  return createStableMetric(item.id, 2, 12)
}

function getFreeMasters(item: NearbyCatalogItem) {
  return createStableMetric(item.id + '-free', 1, 5)
}

function getNearestTime(item: NearbyCatalogItem) {
  if (item.isBookable) return 'Сегодня, 14:30'
  const hour = createStableMetric(item.id + '-hour', 15, 20)
  const minute = createStableMetric(item.id + '-minute', 0, 1) === 0 ? '00' : '30'
  return `Сегодня, ${hour}:${minute}`
}

function getStatusLabel(item: NearbyCatalogItem) {
  if (item.isBookable) return 'Свободен'
  if (item.openingStatus && item.openingStatus.trim().length > 0) return item.openingStatus
  return 'По записи'
}

function getPhotoUrl(item: NearbyCatalogItem) {
  if (item.photoReference && item.photoReference.startsWith('http')) return item.photoReference
  return null
}

export function HomePage() {
  const { entityFilter } = useUiStore()
  const [locationState, setLocationState] = useState<{ latitude: number | null; longitude: number | null; address: string }>({
    latitude: DEFAULT_LOCATION.latitude,
    longitude: DEFAULT_LOCATION.longitude,
    address: DEFAULT_LOCATION.address,
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterMode>('nearby')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [isManualLocation, setIsManualLocation] = useState(false)

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['home-nearby', locationState.latitude, locationState.longitude, entityFilter],
    queryFn: () =>
      nearbyApi.list({
        latitude: locationState.latitude ?? DEFAULT_LOCATION.latitude,
        longitude: locationState.longitude ?? DEFAULT_LOCATION.longitude,
        radiusKm: entityFilter === 'MASTER' ? 8 : 6,
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
    if (entityFilter === 'MASTER') return searchedItems.filter((item) => item.isPrivate)
    if (entityFilter === 'SALON') return searchedItems.filter((item) => !item.isPrivate)
    return searchedItems
  }, [entityFilter, searchedItems])

  const filteredItems = useMemo(() => {
    switch (activeFilter) {
      case 'freeNow':
        return typedItems.filter((item) => item.isBookable)
      case 'today':
        return typedItems.filter((item) => item.isBookable || (item.openingStatus?.toLowerCase().includes('open') ?? false))
      default:
        return typedItems
    }
  }, [activeFilter, typedItems])

  const sortedItems = useMemo(() => {
    const items = [...filteredItems]
    switch (activeFilter) {
      case 'rating':
        items.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
        break
      case 'price':
        items.sort((a, b) => getPriceFrom(a) - getPriceFrom(b))
        break
      case 'nearby':
      default:
        items.sort((a, b) => (a.distanceKm ?? Number.MAX_SAFE_INTEGER) - (b.distanceKm ?? Number.MAX_SAFE_INTEGER))
        break
    }
    return items
  }, [activeFilter, filteredItems])

  useEffect(() => {
    if (isManualLocation || navigator.geolocation == null) return

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationState({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          address: 'Ваш район',
        })
      },
      () => undefined,
      { timeout: 7_000, enableHighAccuracy: true },
    )
  }, [isManualLocation])

  const handleRequestLocation = () => {
    if (!navigator.geolocation) return

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationState({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          address: 'Ваш район',
        })
        setIsManualLocation(true)
      },
      () => undefined,
      { timeout: 7_000, enableHighAccuracy: true },
    )
  }

  const handleManualAddress = () => {
    const typedAddress = window.prompt('Введите город или район', locationState.address)
    if (!typedAddress) return
    const normalized = typedAddress.trim()
    if (!normalized) return
    setLocationState((prev) => ({ ...prev, address: normalized }))
    setIsManualLocation(true)
  }

  const cardsLabel = entityFilter === 'MASTER' ? 'Мастера на дом рядом' : 'Салоны рядом'
  const visibleCount = sortedItems.length

  const renderCard = (item: NearbyCatalogItem) => {
    const isMaster = getEntityType(item) === 'master'
    const linkTo =
      item.sourceType === 'EXTERNAL'
        ? '#'
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
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">Пикми</span>
                </div>
                <p className="mt-1 truncate text-xs text-slate-500">{item.address || 'Адрес уточняется'}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{formatDistance(item.distanceKm)}</span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">
                <Star size={12} /> {formatRating(item)}
              </span>
              <span className="rounded-full bg-brand-50 px-2 py-1 font-semibold text-brand-700">от {getPriceFrom(item)} €</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">
                <Clock3 size={12} /> {getNearestTime(item)}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          {isMaster ? (
            <>
              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                <div className="text-[11px] text-slate-500">Специализация</div>
                <div className="mt-0.5 font-semibold text-slate-800">{getSpecialization(item)}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                <div className="text-[11px] text-slate-500">Статус</div>
                <div className="mt-0.5 font-semibold text-emerald-700">{getStatusLabel(item)}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                <div className="text-[11px] text-slate-500">Источник</div>
                <div className="mt-0.5 font-semibold text-slate-800">{item.sourceType === 'EXTERNAL' ? 'Партнер' : 'Пикми'}</div>
              </div>
              <Link to={linkTo} className="inline-flex items-center justify-center rounded-2xl bg-brand-600 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700">
                Выбрать
              </Link>
            </>
          ) : (
            <>
              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                <div className="text-[11px] text-slate-500">Мастеров</div>
                <div className="mt-0.5 font-semibold text-slate-800">{getWorkingMasters(item)}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                <div className="text-[11px] text-slate-500">Свободно</div>
                <div className="mt-0.5 font-semibold text-emerald-700">{Math.min(getFreeMasters(item), getWorkingMasters(item))}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                <div className="text-[11px] text-slate-500">Статус</div>
                <div className="mt-0.5 font-semibold text-slate-800">{getStatusLabel(item)}</div>
              </div>
              <Link to={linkTo} className="inline-flex items-center justify-center rounded-2xl bg-brand-600 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700">
                Открыть
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
            Вокруг меня
          </button>
          <button onClick={handleManualAddress} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50">
            Ввести адрес
          </button>
        </div>

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

            {isPending ? <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Загружаем ближайшие варианты...</div> : null}
            {isError ? <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">Ошибка загрузки. <button onClick={() => refetch()} className="font-semibold underline">Повторить</button></div> : null}
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
