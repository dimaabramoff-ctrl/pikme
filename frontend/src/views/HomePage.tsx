import { useEffect, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { CalendarDays, Clock3, MapPin, Star } from 'lucide-react'
import { useAuthStore } from '../features/auth/authStore'
import { type NearbyCatalogItem, nearbyApi } from '../features/catalog/api/nearbyApi'
import { ClaimBusinessModal, loadPendingClaim, type ClaimBusinessModalStep } from '../features/business-claims/ClaimBusinessModal'
import { useUiStore } from '../shared/store/uiStore'
import { useAdminModeStore } from '../shared/store/adminModeStore'
import { useAdminTestLocationStore } from '../shared/store/adminTestLocationStore'
import {
  PRESENTATION_DEFAULT_LOCATION,
  PRESENTATION_MODE,
  nearbyPresentationMasters,
  nearbyPresentationSalons,
} from '../shared/demo/presentationData'

type GeoState = 'loading' | 'ready' | 'denied' | 'unavailable' | 'timeout'

// Radius and filters kept for future compact search feature; not exposed in main UI
type RadiusMeters = 2000 | 3000 | 5000 | 10000 | 15000
const DEFAULT_RADIUS: RadiusMeters = 15000

const FALLBACK_CITIES = [
  { label: 'Hamburg', latitude: 53.5511, longitude: 9.9937 },
  { label: 'Schwerin', latitude: 53.6294, longitude: 11.4148 },
  { label: 'Berlin', latitude: 52.52, longitude: 13.405 },
  { label: 'Ludwigslust', latitude: 53.3262, longitude: 11.4961 },
]

type CatalogFilterKey =
  | 'ALLE'
  | 'DAMEN'
  | 'HERREN'
  | 'KINDER'
  | 'BARBERSHOP'
  | 'NAIL_STUDIO'
  | 'HAIR_NAIL'
  | 'MOBILE_HOME'
  | 'OPEN'
  | 'DISTANCE'
  | 'RATING'
  | 'PICKME_PARTNER'
  | 'ONLINE_BOOKABLE'

interface ClaimTargetState {
  salonId?: string
  googlePlaceId?: string
  salonName: string
  address?: string
  claimId?: string
  initialStep?: ClaimBusinessModalStep
}

interface NearbyPage {
  items: NearbyCatalogItem[]
  nextCursor: string | null
  hasMore: boolean
  totalUniqueResults: number
  radiusMeters: number
  appliedFilters: string[]
}

interface HomeDisplayState {
  items: NearbyCatalogItem[]
  demoSalonCount: number
  realPartnerSalonCount: number
  externalSalonCount: number
  demoMasterCount: number
  realMasterCount: number
}

// FILTERS kept for future compact search; not rendered in main catalog UI
const _FILTERS: Array<{ key: CatalogFilterKey; label: string }> = [
  { key: 'ALLE', label: 'Alle' },
  { key: 'DAMEN', label: 'Damen' },
  { key: 'HERREN', label: 'Herren' },
  { key: 'KINDER', label: 'Kinder' },
  { key: 'BARBERSHOP', label: 'Barbershop' },
  { key: 'NAIL_STUDIO', label: 'Nagelstudio' },
  { key: 'HAIR_NAIL', label: 'Friseur + Nagelstudio' },
  { key: 'MOBILE_HOME', label: 'mobil / Hausbesuch' },
  { key: 'OPEN', label: 'geöffnet' },
  { key: 'DISTANCE', label: 'Entfernung' },
  { key: 'RATING', label: 'Bewertung' },
  { key: 'PICKME_PARTNER', label: 'PickMe Partner' },
  { key: 'ONLINE_BOOKABLE', label: 'Online buchbar' },
]
export { _FILTERS }

function formatDistance(distanceKm?: number | null) {
  if (distanceKm == null) return 'In der Nähe'
  if (distanceKm < 1) return `${(distanceKm * 1000).toFixed(0)} m`
  return `${distanceKm.toFixed(1)} km`
}

function formatReviewCount(value?: number | null) {
  if (value == null) return '0'
  return String(value)
}

function formatNearestSlot(value?: string | null) {
  if (!value) return 'Auf Anfrage'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Auf Anfrage'
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatValue(value?: number | null) {
  return value == null ? 'Auf Anfrage' : String(value)
}

function formatPrice(value?: number | null) {
  return value == null ? null : `Ab ${value} €`
}

function getPhotoUrl(item: NearbyCatalogItem) {
  return item.photoUrl && item.photoUrl.length > 0 ? item.photoUrl : null
}

function getCategoryLabel(item: NearbyCatalogItem) {
  const category = String(item.category ?? '').toLowerCase()
  if (category.includes('barber')) return 'Barbershop'
  if (category.includes('nail')) return 'Nagelstudio'
  if (category.includes('beauty')) return 'Friseursalon'
  if (item.id.startsWith('pickme-master:')) return 'mobiler Friseur'
  return 'Friseursalon'
}

function getProviderStatus(item: NearbyCatalogItem) {
  return item.isPickmeConnected ? 'PickMe Partner' : 'Noch nicht mit PickMe verbunden'
}

function buildHighlights(item: NearbyCatalogItem) {
  const highlights: string[] = []
  if (item.openNow === true) highlights.push('Heute geöffnet')
  if (item.isPickmeConnected && item.nextAvailableSlot) highlights.push('Termin heute verfügbar')
  if (item.rating != null && item.reviewCount != null) {
    highlights.push(`${item.rating.toFixed(1)} bei ${item.reviewCount} Bewertungen`)
  }
  if (item.distanceKm != null) highlights.push(`Nur ${formatDistance(item.distanceKm)} entfernt`)

  const category = String(item.category ?? '').toLowerCase()
  if (category.includes('barber')) highlights.push('Herren')
  if (category.includes('nail')) highlights.push('Nagelstudio')
  if (item.id.startsWith('pickme-master:')) highlights.push('Hausbesuche')
  if (item.isPickmeConnected && item.onlineBookingAvailable) highlights.push('Online buchbar')

  return highlights.slice(0, 3)
}

function getEntityType(item: NearbyCatalogItem): 'salon' | 'master' {
  return item.id.startsWith('pickme-master:') ? 'master' : 'salon'
}

function isDemoSalon(item: NearbyCatalogItem) {
  return item.profileFlags?.isDemoProfile === true && item.id.startsWith('pickme-salon:')
}

function isDemoMaster(item: NearbyCatalogItem) {
  return item.profileFlags?.isDemoProfile === true && item.id.startsWith('pickme-master:')
}

function getProfileLabels(item: NearbyCatalogItem) {
  const labels = item.profileFlags?.labels ?? []
  if (labels.length > 0) return labels
  if (item.profileFlags?.isIndependentProvider) return ['Selbstständiger Anbieter']
  return []
}

function dedupeById(items: NearbyCatalogItem[]) {
  const seen = new Set<string>()
  const unique: NearbyCatalogItem[] = []
  for (const item of items) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    unique.push(item)
  }
  return unique
}

function formatCoords(latitude: number, longitude: number) {
  return `Koordinaten: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
}

function mapFilterToBackend(filter: CatalogFilterKey) {
  switch (filter) {
    case 'OPEN':
      return 'OPEN'
    case 'PICKME_PARTNER':
      return 'PICKME_PARTNER'
    case 'ONLINE_BOOKABLE':
      return 'ONLINE_BOOKABLE'
    case 'BARBERSHOP':
      return 'BARBERSHOP'
    case 'NAIL_STUDIO':
      return 'NAIL_STUDIO'
    case 'MOBILE_HOME':
      return 'MOBILE_HOME'
    default:
      return null
  }
}

function buildSearchParams(entityFilter: 'SALON' | 'MASTER' | 'ALL', activeFilter: CatalogFilterKey) {
  const isMaster = entityFilter === 'MASTER'
  const baseQuery = isMaster ? 'mobile friseur' : 'friseursalon'
  const baseCategory = isMaster ? 'barber_shop' : 'hair_salon'

  if (activeFilter === 'BARBERSHOP') return { query: 'barbershop', category: 'barber_shop' }
  if (activeFilter === 'NAIL_STUDIO') return { query: 'nagelstudio', category: 'beauty_salon' }
  if (activeFilter === 'HAIR_NAIL') return { query: 'friseur nagelstudio', category: 'beauty_salon' }
  if (activeFilter === 'DAMEN') return { query: 'damen friseur', category: baseCategory }
  if (activeFilter === 'HERREN') return { query: 'herren friseur', category: 'barber_shop' }
  if (activeFilter === 'KINDER') return { query: 'kinder friseur', category: baseCategory }
  if (activeFilter === 'MOBILE_HOME') return { query: 'mobiler friseur hausbesuch', category: 'barber_shop' }

  return { query: baseQuery, category: baseCategory }
}

export function buildHomeDisplayState(
  liveItems: NearbyCatalogItem[],
  entityFilter: 'SALON' | 'MASTER' | 'ALL',
  presentationMode: boolean,
): HomeDisplayState {
  const byPriority = (a: NearbyCatalogItem, b: NearbyCatalogItem) => {
    const demoA = a.profileFlags?.isDemoProfile ? 0 : 1
    const demoB = b.profileFlags?.isDemoProfile ? 0 : 1
    if (demoA !== demoB) return demoA - demoB

    const partnerA = a.isPickmeConnected ? 0 : 1
    const partnerB = b.isPickmeConnected ? 0 : 1
    if (partnerA !== partnerB) return partnerA - partnerB

    const distanceA = a.distanceKm ?? Number.MAX_SAFE_INTEGER
    const distanceB = b.distanceKm ?? Number.MAX_SAFE_INTEGER
    if (distanceA !== distanceB) return distanceA - distanceB

    const ratingA = a.rating ?? 0
    const ratingB = b.rating ?? 0
    if (ratingA !== ratingB) return ratingB - ratingA

    return (b.reviewCount ?? 0) - (a.reviewCount ?? 0)
  }

  if (entityFilter === 'MASTER') {
    const liveDemoMasters = liveItems
      .filter((item) => getEntityType(item) === 'master' && item.isPickmeConnected && isDemoMaster(item))
      .sort(byPriority)

    const realMasters = liveItems
      .filter((item) => getEntityType(item) === 'master' && item.isPickmeConnected && !isDemoMaster(item))
      .sort(byPriority)

    const fallbackDemoMasters = presentationMode
      ? nearbyPresentationMasters.filter((item) => getEntityType(item) === 'master').slice(0, 2)
      : []

    const demoMasters = dedupeById([...liveDemoMasters, ...fallbackDemoMasters])

    return {
      items: dedupeById([...demoMasters, ...realMasters]),
      demoSalonCount: 0,
      realPartnerSalonCount: 0,
      externalSalonCount: 0,
      demoMasterCount: demoMasters.length,
      realMasterCount: realMasters.length,
    }
  }

  const realPartnerSalons = liveItems
    .filter((item) => getEntityType(item) === 'salon' && item.isPickmeConnected && !isDemoSalon(item))
    .sort(byPriority)

  const liveDemoSalons = liveItems
    .filter((item) => getEntityType(item) === 'salon' && item.isPickmeConnected && isDemoSalon(item))
    .sort(byPriority)

  const externalSalons = liveItems
    .filter((item) => getEntityType(item) === 'salon' && !item.isPickmeConnected)
    .sort(byPriority)

  const fallbackDemoSalons = presentationMode
    ? nearbyPresentationSalons
      .filter((item) => getEntityType(item) === 'salon')
      .slice(0, 2)
      .sort(byPriority)
    : []

  const demoSalons = dedupeById([...liveDemoSalons, ...fallbackDemoSalons])

  return {
    items: dedupeById([...demoSalons, ...realPartnerSalons, ...externalSalons]),
    demoSalonCount: demoSalons.length,
    realPartnerSalonCount: realPartnerSalons.length,
    externalSalonCount: externalSalons.length,
    demoMasterCount: 0,
    realMasterCount: 0,
  }
}

function StandardSalonCard({
  item,
  onClaim,
  isSuperAdmin,
}: {
  item: NearbyCatalogItem
  onClaim: (item: NearbyCatalogItem) => void
  isSuperAdmin: boolean
}) {
  const image = getPhotoUrl(item)
  const isPartner = item.isPickmeConnected
  const isDemo = isDemoSalon(item)
  const isMasterProfile = item.id.startsWith('pickme-master:')
  const externalId = item.externalPlaceId || item.id
  const externalParams = new URLSearchParams({
    name: item.name,
    address: item.address || '',
    rating: item.rating != null ? String(item.rating) : '',
    reviewCount: item.reviewCount != null ? String(item.reviewCount) : '',
    distanceKm: item.distanceKm != null ? String(item.distanceKm) : '',
    externalUrl: item.externalUrl || '',
    openNow: item.openNow == null ? '' : String(item.openNow),
  })

  const detailsLink = isPartner
    ? isMasterProfile
      ? `/masters/${item.id.replace('pickme-master:', '')}`
      : `/salons/${item.id.replace('pickme-salon:', '')}${isDemo ? '?demoEdit=1' : ''}`
    : `/salons/external/${encodeURIComponent(externalId)}?${externalParams.toString()}`

  const highlights = buildHighlights(item)
  const profileLabels = getProfileLabels(item)

  return (
    <article className="overflow-hidden rounded-[22px] border border-[#d9e3e5] bg-white shadow-[0_10px_22px_rgba(9,37,41,0.08)]">
      <div className="grid gap-0 md:grid-cols-[180px_minmax(0,1fr)]">
        <div className="h-40 bg-[#e7ecec] md:h-full">
          {image ? (
            <img src={image} alt={item.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#dde9ea] via-[#f2f6f6] to-[#e7efe8] px-3 text-center text-xs font-semibold text-[#4f666c]">
              PickMe Standard
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col justify-between p-4">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-[16px] font-semibold text-[#132a31]">{item.name}</h3>
                <p className="text-xs text-[#5a7075]">{getCategoryLabel(item)}</p>
                {profileLabels.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {profileLabels.map((label) => (
                      <span key={`${item.id}-${label}`} className="rounded-full bg-[#fff0de] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-[#8d552c]">
                        {label}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${isPartner ? 'bg-[#124753] text-[#f8f6f0]' : 'bg-[#eceff1] text-[#4f6268]'}`}>
                {getProviderStatus(item)}
              </span>
            </div>

            <p className="line-clamp-1 text-xs text-[#546a70]">{item.address || 'Adresse nicht verfügbar'}</p>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#2d4850]">
              <span className="inline-flex items-center gap-1"><MapPin size={12} /> {formatDistance(item.distanceKm)}</span>
              <span className="inline-flex items-center gap-1"><Star size={12} /> {item.rating?.toFixed(1) ?? 'n/a'} ({formatReviewCount(item.reviewCount)})</span>
              {item.openNow != null ? <span>{item.openNow ? 'Geöffnet' : 'Geschlossen'}</span> : null}
            </div>

            {isPartner ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#2d4850]">
                <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> Frei jetzt: {formatValue(item.availableMasters)}</span>
                <span className="inline-flex items-center gap-1"><Clock3 size={12} /> Nächster Slot: {formatNearestSlot(item.nextAvailableSlot)}</span>
                {formatPrice(item.minPrice) ? <span className="font-semibold text-[#a8673f]">{formatPrice(item.minPrice)}</span> : null}
              </div>
            ) : null}

            {highlights.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {highlights.map((line) => (
                  <span key={`${item.id}-${line}`} className="rounded-full bg-[#f2f7f7] px-2 py-1 text-[11px] text-[#3d5960]">
                    {line}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#e8edee] pt-3">
            <Link to={detailsLink} className="btn-secondary text-xs">Mehr erfahren</Link>
            {isPartner ? (
              isDemo ? (
                <Link to={`/salons/${item.id.replace('pickme-salon:', '')}?demoEdit=1`} className="btn-primary text-xs">Demo bearbeiten</Link>
              ) : (
                <Link to={`/salons/${item.id.replace('pickme-salon:', '')}`} className="btn-primary text-xs">Jetzt buchen</Link>
              )
            ) : null}
            {!isPartner && !isSuperAdmin ? (
              <>
                <span className="text-[11px] text-[#4f666c]">Ist das Ihr Unternehmen? Profil übernehmen und PickMe 30 Tage kostenlos testen.</span>
                <button
                  type="button"
                  onClick={() => onClaim(item)}
                  className="rounded-xl bg-[#17666D] px-3 py-2 text-xs font-semibold text-white hover:bg-[#12545b]"
                >
                  Profil übernehmen
                </button>
              </>
            ) : null}
            {!isPartner && isSuperAdmin ? (
              <span className="text-[11px] font-semibold text-[#355861]">Claim ist für SUPER_ADMIN deaktiviert.</span>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  )
}

export function HomePage() {
  const { entityFilter } = useUiStore()
  const currentUser = useAuthStore((state) => state.currentUser)
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN'
  const adminModeEnabled = useAdminModeStore((state) => state.enabled)
  const adminTestLocationEnabled = useAdminTestLocationStore((state) => state.enabled)
  const adminTestCityLabel = useAdminTestLocationStore((state) => state.cityLabel)
  const adminTestLatitude = useAdminTestLocationStore((state) => state.latitude)
  const adminTestLongitude = useAdminTestLocationStore((state) => state.longitude)
  const adminTestRadiusMeters = useAdminTestLocationStore((state) => state.radiusMeters)
  const setAdminTestLocationEnabled = useAdminTestLocationStore((state) => state.setEnabled)
  const setAdminTestPreset = useAdminTestLocationStore((state) => state.setPreset)
  const setAdminTestCoordinates = useAdminTestLocationStore((state) => state.setCoordinates)
  const setAdminTestRadiusMeters = useAdminTestLocationStore((state) => state.setRadiusMeters)
  const resetAdminTestLocation = useAdminTestLocationStore((state) => state.reset)
  const [geoState, setGeoState] = useState<GeoState>(() => {
    if (typeof navigator === 'undefined') return 'unavailable'
    return navigator.geolocation ? 'loading' : 'unavailable'
  })
  const [locationState, setLocationState] = useState<{ latitude: number | null; longitude: number | null; label: string }>({
    latitude: PRESENTATION_MODE ? PRESENTATION_DEFAULT_LOCATION.latitude : null,
    longitude: PRESENTATION_MODE ? PRESENTATION_DEFAULT_LOCATION.longitude : null,
    label: PRESENTATION_MODE ? PRESENTATION_DEFAULT_LOCATION.label : 'Aktuelle Adresse ist nicht bestimmt',
  })
  const [claimTarget, setClaimTarget] = useState<ClaimTargetState | null>(null)
  const [claimId, setClaimId] = useState<string | undefined>(undefined)
  const [manualCity, setManualCity] = useState(FALLBACK_CITIES[0].label)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const isAdminTestModeActive = Boolean(isSuperAdmin && adminModeEnabled && adminTestLocationEnabled)

  const effectiveLatitude = isAdminTestModeActive ? adminTestLatitude : locationState.latitude
  const effectiveLongitude = isAdminTestModeActive ? adminTestLongitude : locationState.longitude
  const effectiveRadius = (isAdminTestModeActive ? adminTestRadiusMeters : DEFAULT_RADIUS) as RadiusMeters

  useEffect(() => {
    const pending = loadPendingClaim()
    if (!pending) return

    setClaimTarget({
      salonId: pending.salonId,
      googlePlaceId: pending.googlePlaceId,
      salonName: pending.salonName,
      address: pending.address,
      claimId: pending.claimId,
      initialStep: pending.pendingStep,
    })
    setClaimId(pending.claimId)
  }, [])

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    requestLocation()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const requestLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    setGeoState('loading')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationState({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          label: formatCoords(position.coords.latitude, position.coords.longitude),
        })
        setGeoState('ready')
      },
      (error) => {
        if (error.code === error.TIMEOUT) { setGeoState('timeout'); return }
        if (error.code === error.PERMISSION_DENIED) { setGeoState('denied'); return }
        setGeoState('unavailable')
      },
      { timeout: 7000, enableHighAccuracy: true },
    )
  }

  const backendFilter = mapFilterToBackend('ALLE')
  const searchPreset = buildSearchParams(entityFilter, 'ALLE')

  const nearbyQuery = useInfiniteQuery({
    queryKey: [
      'home-nearby-cursor',
      effectiveLatitude,
      effectiveLongitude,
      entityFilter,
      effectiveRadius,
      'ALLE',
      searchPreset.query,
      searchPreset.category,
      backendFilter,
      isAdminTestModeActive,
      adminTestCityLabel,
    ],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const response = await nearbyApi.listWithMeta({
        latitude: effectiveLatitude as number,
        longitude: effectiveLongitude as number,
        radius: effectiveRadius,
        query: searchPreset.query,
        category: searchPreset.category,
        limit: 24,
        cursor: pageParam ?? undefined,
        filters: backendFilter ?? undefined,
      }, signal)

      return response.payload as NearbyPage
    },
    enabled: effectiveLatitude != null && effectiveLongitude != null,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : null),
    retry: 1,
  })

  useEffect(() => {
    if (!sentinelRef.current) return
    if (typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (!entry?.isIntersecting) return
        if (!nearbyQuery.hasNextPage) return
        if (nearbyQuery.isFetchingNextPage) return
        nearbyQuery.fetchNextPage()
      },
      { rootMargin: '200px 0px' },
    )

    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [nearbyQuery])

  const liveItems = useMemo(() => {
    const pages = nearbyQuery.data?.pages ?? []
    return dedupeById(pages.flatMap((page) => page.items))
  }, [nearbyQuery.data])

  const displayState = useMemo(() => {
    const base = buildHomeDisplayState(liveItems, entityFilter, PRESENTATION_MODE)
    if (entityFilter === 'MASTER' && base.items.length === 0) {
      const forcedItems = nearbyPresentationMasters.filter((item) => getEntityType(item) === 'master')
      return {
        ...base,
        items: forcedItems,
        demoMasterCount: forcedItems.length,
      }
    }
    return base
  }, [entityFilter, liveItems])

  const hasMore = Boolean(nearbyQuery.hasNextPage)
  const showNoRealMastersHint =
    PRESENTATION_MODE &&
    entityFilter === 'MASTER' &&
    !nearbyQuery.isPending &&
    displayState.realMasterCount === 0 &&
    displayState.demoMasterCount > 0

  const showSkeletonCards = nearbyQuery.isPending && displayState.items.length === 0 && geoState === 'ready'

  return (
    <div className="space-y-4">
      {/* Compact PickMe trust intro — replaces the large filter hero */}
      <section data-testid="pickme-trust-intro" className="rounded-[26px] border border-[#dbe7e9] bg-gradient-to-br from-[#f8fbfb] via-[#f4f7f6] to-[#f0ebe4] px-4 py-4 shadow-[0_8px_20px_rgba(9,37,41,0.05)] sm:px-6 sm:py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#5d7a80]">PickMe</p>
        <h2 className="mt-1.5 text-xl font-semibold leading-snug text-[#102f35] sm:text-2xl">
          Dein Termin. Ohne Anrufen. Ohne Warten.
        </h2>
        <p className="mt-1.5 text-sm leading-6 text-[#51666b]">
          PickMe zeigt dir verfügbare Salons und selbstständige Anbieter in deiner Nähe.
          Leistung wählen, Termin reservieren und zur bestätigten Zeit kommen.
        </p>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="flex items-start gap-2 rounded-xl bg-white/70 px-3 py-2.5 ring-1 ring-[#dce7ea]">
            <CalendarDays size={15} className="mt-0.5 shrink-0 text-[#17666D]" />
            <div>
              <p className="text-[12px] font-semibold text-[#0f3039]">Echte Verfügbarkeit</p>
              <p className="mt-0.5 text-[11px] leading-4 text-[#4f686f]">Freie Zeiten werden aus dem PickMe-Terminplan berechnet.</p>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-xl bg-white/70 px-3 py-2.5 ring-1 ring-[#dce7ea]">
            <Star size={15} className="mt-0.5 shrink-0 text-[#17666D]" />
            <div>
              <p className="text-[12px] font-semibold text-[#0f3039]">Verifizierte PickMe-Bewertungen</p>
              <p className="mt-0.5 text-[11px] leading-4 text-[#4f686f]">Bewerten können nur Kundinnen und Kunden nach einem abgeschlossenen Termin.</p>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-xl bg-white/70 px-3 py-2.5 ring-1 ring-[#dce7ea]">
            <Clock3 size={15} className="mt-0.5 shrink-0 text-[#17666D]" />
            <div>
              <p className="text-[12px] font-semibold text-[#0f3039]">Einfach buchen</p>
              <p className="mt-0.5 text-[11px] leading-4 text-[#4f686f]">Leistung, Mitarbeiter, Zeit und Zahlungsart in einem Ablauf.</p>
            </div>
          </div>
        </div>

        {/* Geo status: compact, only shown when needed */}
        {(geoState === 'denied' || geoState === 'unavailable' || geoState === 'timeout') && locationState.latitude == null ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-[#5a6f74]">
              {geoState === 'denied' ? 'Standortzugriff verweigert.' : 'Standort nicht verfügbar.'}
            </span>
            <button
              type="button"
              onClick={requestLocation}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#d0e1e3] bg-white px-3 py-1 text-xs font-semibold text-[#17666D] hover:bg-[#f0f9f9]"
            >
              <MapPin size={12} /> Standort verwenden
            </button>
          </div>
        ) : null}

        {geoState === 'loading' && locationState.latitude == null ? (
          <p className="mt-2 text-xs text-[#5a6f74]">Standort wird ermittelt…</p>
        ) : null}

        {(geoState === 'denied' || geoState === 'unavailable' || geoState === 'timeout') && locationState.latitude == null ? (
          <div className="mt-3 grid gap-2 rounded-xl border border-[#d8e5e7] bg-white px-3 py-3 text-xs text-[#3f5960] sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="block">
              <span className="mb-1 block font-semibold">Stadt als Fallback wählen</span>
              <select
                value={manualCity}
                onChange={(event) => setManualCity(event.target.value)}
                className="field-input"
              >
                {FALLBACK_CITIES.map((city) => (
                  <option key={city.label} value={city.label}>{city.label}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => {
                const city = FALLBACK_CITIES.find((item) => item.label === manualCity) ?? FALLBACK_CITIES[0]
                setLocationState({
                  latitude: city.latitude,
                  longitude: city.longitude,
                  label: `${city.label} (Fallback)`,
                })
                setGeoState('ready')
              }}
              className="rounded-full border border-[#d0e1e3] bg-white px-3 py-2 font-semibold text-[#17666D] hover:bg-[#f0f9f9]"
            >
              Stadt verwenden
            </button>
          </div>
        ) : null}

        {isSuperAdmin && adminModeEnabled ? (
          <div className="mt-3 rounded-xl border border-[#c6dde1] bg-[#eef6f8] px-3 py-3 text-xs text-[#204e57]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">Test Location Mode (nur SUPER_ADMIN Session)</span>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={adminTestLocationEnabled}
                  onChange={(event) => setAdminTestLocationEnabled(event.target.checked)}
                />
                Aktiv
              </label>
            </div>

            {adminTestLocationEnabled ? (
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block font-semibold">Stadt-Preset</span>
                  <select
                    value={adminTestCityLabel}
                    onChange={(event) => {
                      const city = FALLBACK_CITIES.find((item) => item.label === event.target.value) ?? FALLBACK_CITIES[0]
                      setAdminTestPreset({
                        cityLabel: city.label,
                        latitude: city.latitude,
                        longitude: city.longitude,
                      })
                    }}
                    className="field-input"
                  >
                    {FALLBACK_CITIES.map((city) => (
                      <option key={`admin-city-${city.label}`} value={city.label}>{city.label}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block font-semibold">Test Radius (1-15 km)</span>
                  <input
                    type="number"
                    min={1}
                    max={15}
                    value={Math.round(adminTestRadiusMeters / 1000)}
                    onChange={(event) => {
                      const valueKm = Number(event.target.value)
                      setAdminTestRadiusMeters((Number.isFinite(valueKm) ? valueKm : 15) * 1000)
                    }}
                    className="field-input"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block font-semibold">Latitude</span>
                  <input
                    type="number"
                    value={adminTestLatitude}
                    onChange={(event) => {
                      const nextLat = Number(event.target.value)
                      if (Number.isFinite(nextLat)) {
                        setAdminTestCoordinates({
                          latitude: nextLat,
                          longitude: adminTestLongitude,
                        })
                      }
                    }}
                    className="field-input"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block font-semibold">Longitude</span>
                  <input
                    type="number"
                    value={adminTestLongitude}
                    onChange={(event) => {
                      const nextLon = Number(event.target.value)
                      if (Number.isFinite(nextLon)) {
                        setAdminTestCoordinates({
                          latitude: adminTestLatitude,
                          longitude: nextLon,
                        })
                      }
                    }}
                    className="field-input"
                  />
                </label>

                <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2">
                  <span>
                    Aktiv: {adminTestCityLabel}, Radius {Math.round(adminTestRadiusMeters / 1000)} km, {formatCoords(adminTestLatitude, adminTestLongitude)}
                  </span>
                  <button
                    type="button"
                    onClick={resetAdminTestLocation}
                    className="rounded-full border border-[#c6dde1] bg-white px-3 py-1 font-semibold text-[#265861]"
                  >
                    Testwerte zurücksetzen
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#102F35]">
            {entityFilter === 'MASTER' ? 'Mobile Services in der Nähe' : 'Salons in der Nähe'}
          </h2>
          <span className="text-xs font-semibold text-[#5e747a]">{displayState.items.length}</span>
        </div>

        {showSkeletonCards ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <article key={`skeleton-${index}`} className="animate-pulse rounded-[22px] border border-[#dbe9ea] bg-white p-4">
                <div className="flex gap-3">
                  <div className="h-20 w-24 rounded-xl bg-[#e5eeee]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/5 rounded bg-[#e5eeee]" />
                    <div className="h-3 w-4/5 rounded bg-[#edf3f3]" />
                    <div className="h-3 w-2/5 rounded bg-[#edf3f3]" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {!showSkeletonCards ? (
          <div className="space-y-3">
            {displayState.items.map((item) => (
              <StandardSalonCard
                key={item.id}
                item={item}
                isSuperAdmin={Boolean(isSuperAdmin)}
                onClaim={(target) => {
                  setClaimTarget({
                    googlePlaceId: target.externalPlaceId ?? undefined,
                    salonName: target.name,
                    address: target.address ?? undefined,
                    initialStep: 'options',
                  })
                  setClaimId(undefined)
                }}
              />
            ))}
          </div>
        ) : null}

        {nearbyQuery.isError ? (
          <div className="rounded-xl border border-[#f1ddcf] bg-[#fff7f2] px-3 py-2 text-xs text-[#8a5a2d]">
            Ergebnisse konnten nicht geladen werden.
            <button type="button" onClick={() => nearbyQuery.refetch()} className="ml-2 font-semibold underline">
              Erneut versuchen
            </button>
          </div>
        ) : null}

        {nearbyQuery.isFetchingNextPage ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <article key={`next-skeleton-${index}`} className="animate-pulse rounded-[22px] border border-[#dbe9ea] bg-white p-4">
                <div className="h-5 w-44 rounded bg-[#e5eeee]" />
              </article>
            ))}
          </div>
        ) : null}

        <div ref={sentinelRef} className="h-2" />

        {!hasMore && !nearbyQuery.isPending && displayState.items.length > 0 ? (
          <p className="rounded-xl border border-[#dce7ea] bg-[#f7fbfc] px-3 py-2 text-xs text-[#486068]">
            Alle verfügbaren Ergebnisse in diesem Umkreis wurden geladen.
          </p>
        ) : null}

        {showNoRealMastersHint ? (
          <p className="rounded-xl border border-[#dce7ea] bg-[#f7fbfc] px-3 py-2 text-xs text-[#486068]">
            Derzeit sind keine weiteren mobilen Service-Profis in Ihrer Nähe verfügbar
          </p>
        ) : null}
      </section>

      {claimTarget ? (
        <ClaimBusinessModal
          isOpen={!!claimTarget}
          onClose={() => setClaimTarget(null)}
          googlePlaceId={claimTarget.googlePlaceId ?? undefined}
          salonName={claimTarget.salonName}
          address={claimTarget.address ?? undefined}
          claimId={claimTarget.claimId ?? claimId}
          initialStep={claimTarget.initialStep}
          onClaimCreated={(id) => setClaimId(id)}
        />
      ) : null}
    </div>
  )
}
