import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  CreditCard,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { AuthPromptModal } from '../features/auth/components/AuthPromptModal'
import { useAuthStore } from '../features/auth/authStore'
import { SuperAdminModePanel } from '../shared/components/SuperAdminModePanel'
import { bookingApi } from '../features/bookings/api/bookingApi'
import { masterApi } from '../features/masters/api/masterApi'
import { salonApi } from '../features/salons/api/salonApi'
import { serviceApi } from '../features/services/api/serviceApi'
import type { CurrentUser } from '../features/auth/authTypes'
import type {
  EditorPaymentMethod,
  MasterSummary,
  SalonEditorDraftPayload,
  SalonEditorPhotoItem,
  SalonEditorPublishedPayload,
  SalonEditorScheduleRow,
  SalonEditorStaffItem,
  SalonSummary,
  ServiceSummary,
} from '../shared/api/types'
import {
  buildPresentationBookingNumber,
  PRESENTATION_CUSTOMER,
  getPresentationSalonById,
  getPresentationSalonMasters,
  getPresentationSalonServices,
  getPresentationSalonSlots,
  getPresentationSalonSummary,
  PRESENTATION_MODE,
} from '../shared/demo/presentationData'
import { bookingKeys, masterKeys, salonKeys, serviceKeys } from '../shared/query/queryKeys'
import { useAdminModeStore } from '../shared/store/adminModeStore'

type BookingStep = 1 | 2 | 3 | 4 | 5 | 6 | 7
type DemoWizardStep =
  | 'UNTERNEHMEN'
  | 'BESCHREIBUNG'
  | 'FOTOS'
  | 'LEISTUNGEN'
  | 'PREISE'
  | 'MITARBEITER'
  | 'SPEZIALISIERUNGEN'
  | 'ARBEITSZEITEN'
  | 'VERFUEGBARKEITEN'
  | 'ZAHLUNGSARTEN'
  | 'SPRACHEN_AUSSTATTUNG'
  | 'VORSCHAU'

type DemoPreviewView = 'KATALOG' | 'SALONSEITE'
type DemoPreviewViewport = 'DESKTOP' | 'MOBILE'

type DemoServicePriceType = 'FESTPREIS' | 'AB_PREIS' | 'VORAUSSICHTLICHER_PREIS' | 'PREIS_NACH_BERATUNG'

interface DemoServiceMeta {
  serviceKey: string
  priceType: DemoServicePriceType
  addOns: string[]
  assignedStaffIds: string[]
  isActive: boolean
}

interface DemoStaffMeta {
  staffKey: string
  jobTitle: string
  languages: string[]
  isActive: boolean
}

interface DemoSimulationState {
  busyStaffIds: string[]
  pausedStaffIds: string[]
  simulateNextFree: boolean
  nextFreeAt: string
}

interface DemoCompletenessResult {
  percent: number
  tips: string[]
}

type PaymentMethod = 'IN_SALON' | 'CARD'

interface ApiLikeError {
  statusCode?: number
  code?: string
  message?: string
}

interface BookingDraft {
  serviceId?: string
  serviceIds?: string[]
  items?: Array<{
    serviceId: string
    quantity: number
    modifierOptionIds: string[]
  }>
  masterId?: string
  date?: string
  slot?: string
  step?: BookingStep
  paymentMethod?: PaymentMethod | null
  clientComment?: string
  additionalWish?: string
}

interface SelectedBookingItem {
  serviceId: string
  quantity: number
  modifierOptionIds: string[]
}

interface ModifierOption {
  id: string
  label: string
  extraPrice: number
  extraDurationMinutes: number
  repeatable: boolean
  unit: string
}

const BOOKING_MODIFIER_OPTIONS: ModifierOption[] = [
  { id: 'HAIR_LEN_SHORT', label: 'Kurze Haare', extraPrice: 0, extraDurationMinutes: 0, repeatable: false, unit: 'Anpassung' },
  { id: 'HAIR_LEN_MEDIUM', label: 'Mittlere Haare', extraPrice: 8, extraDurationMinutes: 10, repeatable: false, unit: 'Anpassung' },
  { id: 'HAIR_LEN_LONG', label: 'Lange Haare', extraPrice: 16, extraDurationMinutes: 20, repeatable: false, unit: 'Anpassung' },
  { id: 'COLOR_EXTRA_1', label: 'Zusätzliche Farbe', extraPrice: 12, extraDurationMinutes: 15, repeatable: true, unit: 'Farben' },
  { id: 'COLOR_EXTRA_2', label: 'Intensive Farberweiterung', extraPrice: 24, extraDurationMinutes: 30, repeatable: true, unit: 'Farben' },
  { id: 'NAIL_ART_BASIC', label: 'Nail Art Basic', extraPrice: 10, extraDurationMinutes: 15, repeatable: true, unit: 'Nägel' },
  { id: 'NAIL_ART_PRO', label: 'Nail Art Pro', extraPrice: 18, extraDurationMinutes: 25, repeatable: true, unit: 'Nägel' },
  { id: 'REMOVE_OLD', label: 'Altes Material entfernen', extraPrice: 8, extraDurationMinutes: 12, repeatable: true, unit: 'Zonen' },
]

interface PresentationPartnerOrderRecord {
  bookingNumber: string
  customerName: string
  customerPhone: string
  salonName: string
  salonPhone: string
  serviceName: string
  masterName: string
  date: string
  time: string
  durationMinutes: number
  servicePrice: number
  optionalExtrasPrice: number
  totalPrice: number
  paymentMethodLabel: string
  paymentStatus: string
  clientComment: string
}

const ANY_MASTER_VALUE = 'ANY_MASTER'
const SERVICE_SEARCH_THRESHOLD = 9
const DAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
const GOOGLE_COVER_SENTINEL = '__GOOGLE_COVER__'
const DEMO_WIZARD_STEPS: Array<{ id: DemoWizardStep; label: string }> = [
  { id: 'UNTERNEHMEN', label: '1. Unternehmensdaten' },
  { id: 'BESCHREIBUNG', label: '2. Beschreibung' },
  { id: 'FOTOS', label: '3. Fotos' },
  { id: 'LEISTUNGEN', label: '4. Leistungen' },
  { id: 'PREISE', label: '5. Preise und Dauer' },
  { id: 'MITARBEITER', label: '6. Mitarbeiter' },
  { id: 'SPEZIALISIERUNGEN', label: '7. Spezialisierungen' },
  { id: 'ARBEITSZEITEN', label: '8. Arbeitszeiten' },
  { id: 'VERFUEGBARKEITEN', label: '9. Verfügbarkeiten' },
  { id: 'ZAHLUNGSARTEN', label: '10. Zahlungsarten' },
  { id: 'SPRACHEN_AUSSTATTUNG', label: '11. Sprachen und Ausstattung' },
  { id: 'VORSCHAU', label: '12. Vorschau' },
]

const DEMO_PRICE_TYPE_OPTIONS: Array<{ value: DemoServicePriceType; label: string }> = [
  { value: 'FESTPREIS', label: 'Festpreis' },
  { value: 'AB_PREIS', label: 'Ab-Preis' },
  { value: 'VORAUSSICHTLICHER_PREIS', label: 'Voraussichtlicher Preis' },
  { value: 'PREIS_NACH_BERATUNG', label: 'Preis nach Beratung' },
]
const EDITOR_PAYMENT_OPTIONS: Array<{ id: EditorPaymentMethod; label: string }> = [
  { id: 'IN_SALON', label: 'Vor Ort bezahlen' },
  { id: 'CARD', label: 'Karte vor Ort' },
]

function getTodayDateInput() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function formatCurrency(value: number | string) {
  const amount = Number(value)
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + ' €'
}

function formatSlotDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Auf Anfrage'
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
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

function readBookingDraft(storageKey: string): BookingDraft {
  try {
    const raw = sessionStorage.getItem(storageKey)
    if (!raw) return {}
    return JSON.parse(raw) as BookingDraft
  } catch {
    sessionStorage.removeItem(storageKey)
    return {}
  }
}

function canEditDemoSalon(user: CurrentUser | null, salonId: string, ownerId: string, editableByUserIds: string[]) {
  if (!user) return false
  if (user.id === ownerId) return true
  if (editableByUserIds.includes(user.id)) return true
  if (user.role === 'SUPER_ADMIN') return true

  const presentationAccessByEmail: Record<string, string[]> = {
    'admin@example.test': ['demo-atelier-royal'],
    'owner2@example.test': ['demo-nordic-cut'],
  }

  return presentationAccessByEmail[user.email]?.includes(salonId) ?? false
}

function getPartnerOrdersStorageKey(salonId: string) {
  return `pickme:partner-orders:${salonId}`
}

function readPartnerOrders(salonId: string): PresentationPartnerOrderRecord[] {
  try {
    const raw = localStorage.getItem(getPartnerOrdersStorageKey(salonId))
    if (!raw) return []
    return JSON.parse(raw) as PresentationPartnerOrderRecord[]
  } catch {
    return []
  }
}

function savePartnerOrder(salonId: string, order: PresentationPartnerOrderRecord) {
  const current = readPartnerOrders(salonId)
  const updated = [order, ...current].slice(0, 20)
  localStorage.setItem(getPartnerOrdersStorageKey(salonId), JSON.stringify(updated))
}

function getMasterStatusLabel(master: MasterSummary) {
  if (master.currentStatus === 'AVAILABLE') return 'Verfügbar'
  if (master.currentStatus === 'SOON_AVAILABLE') return 'Wenig verfügbar'
  if (master.currentStatus === 'BUSY') return 'Ausgebucht'
  return 'Nicht im Dienst'
}

function getMasterStatusClass(master: MasterSummary) {
  if (master.currentStatus === 'AVAILABLE') return 'text-[#2F8B5D]'
  if (master.currentStatus === 'SOON_AVAILABLE') return 'text-[#B97620]'
  if (master.currentStatus === 'BUSY') return 'text-[#C95C4B]'
  return 'text-[#64777d]'
}

function mapCategoryLabel(category: string) {
  const normalized = category.trim().toLowerCase()
  if (normalized.includes('men') || normalized.includes('herren')) return 'Herren'
  if (normalized.includes('women') || normalized.includes('damen')) return 'Damen'
  if (normalized.includes('kids') || normalized.includes('kinder')) return 'Kinder'
  if (normalized.includes('color')) return 'Farbe'
  if (normalized.includes('styl')) return 'Styling'
  if (normalized.includes('beard') || normalized.includes('bart')) return 'Bart'
  if (normalized.includes('care') || normalized.includes('pflege')) return 'Pflege'
  if (normalized.includes('nail') || normalized.includes('nagel')) return 'Nägel'
  return 'Extras'
}

function groupServicesByCategory(services: ServiceSummary[]) {
  const categoryOrder = ['Herren', 'Damen', 'Kinder', 'Farbe', 'Styling', 'Bart', 'Pflege', 'Nägel', 'Extras']
  const grouped = new Map<string, ServiceSummary[]>()

  for (const service of services) {
    const category = mapCategoryLabel(service.category)
    const list = grouped.get(category) ?? []
    list.push(service)
    grouped.set(category, list)
  }

  return categoryOrder
    .map((category) => ({ category, services: grouped.get(category) ?? [] }))
    .filter((entry) => entry.services.length > 0)
}

function getModifierCount(modifierIds: string[], modifierId: string) {
  return modifierIds.filter((id) => id === modifierId).length
}

function canEditOwnedSalon(user: CurrentUser | null, salonId: string) {
  if (!user) return false
  if (user.role === 'SUPER_ADMIN') return true
  return user.salonAdminProfile?.some((membership) => membership.isActive !== false && membership.salon?.id === salonId) ?? false
}

function extractOwnerEditorPublished(salon: SalonSummary | null): SalonEditorPublishedPayload | null {
  const metadata = salon?.cancellationPolicyJson
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null

  const ownerEditor = (metadata as { pickmeOwnerEditor?: { published?: SalonEditorPublishedPayload } }).pickmeOwnerEditor
  return ownerEditor?.published ?? null
}

function mapEditorStaffStatus(status?: SalonEditorStaffItem['currentStatus']): MasterSummary['currentStatus'] {
  if (status === 'SOON_AVAILABLE') return 'SOON_AVAILABLE'
  if (status === 'BUSY') return 'BUSY'
  if (status === 'OFFLINE') return 'OFFLINE'
  return 'AVAILABLE'
}

function createDefaultEditorSchedule(): SalonEditorScheduleRow[] {
  return [1, 2, 3, 4, 5].map((dayOfWeek) => ({
    dayOfWeek,
    shiftStart: '09:00',
    shiftEnd: '18:00',
    isDayOff: false,
    acceptsBookings: true,
    acceptsUrgentBookings: true,
    supportsHomeVisits: false,
    breaks: [],
  }))
}

function parseCsvInput(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

const ALLOWED_EDITOR_PAYMENT_METHODS: EditorPaymentMethod[] = ['IN_SALON', 'CARD']

function toEditorPaymentMethods(input: unknown): EditorPaymentMethod[] {
  if (!Array.isArray(input)) return ['IN_SALON', 'CARD']
  const methods = input
    .filter((item): item is EditorPaymentMethod =>
      typeof item === 'string' && ALLOWED_EDITOR_PAYMENT_METHODS.includes(item as EditorPaymentMethod),
    )
  return methods.length > 0 ? methods : ['IN_SALON', 'CARD']
}

function toOpeningHoursText(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'Mo-Sa 09:00 - 20:00'
  const displayText = (value as { displayText?: unknown }).displayText
  return typeof displayText === 'string' && displayText.trim().length > 0
    ? displayText
    : 'Mo-Sa 09:00 - 20:00'
}

function toDemoEditorDraftFromLive(input: {
  salon: SalonSummary
  services: ServiceSummary[]
  masters: MasterSummary[]
}): SalonEditorDraftPayload {
  const metadata = input.salon.cancellationPolicyJson
  const profileMeta = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? (metadata as { profileMeta?: Record<string, unknown> }).profileMeta
    : undefined

  const photos = (input.salon.photos ?? []).map((photo, index) => ({
    id: photo.id,
    imageUrl: photo.imageUrl,
    sortOrder: photo.sortOrder ?? index,
  }))

  const services = input.services.map((service) => ({
    id: service.id,
    name: service.name,
    description: service.description ?? '',
    category: service.category,
    basePrice: Number(service.basePrice),
    durationMinutes: Number(service.durationMinutes),
    availableInSalon: service.availableInSalon ?? true,
    availableAtHome: service.availableAtHome ?? false,
    isActive: service.isActive ?? true,
  }))

  const staff = input.masters.map((master) => ({
    id: master.id,
    displayName: master.displayName,
    specialization: master.specialization ?? '',
    biography: master.biography ?? '',
    experienceYears: master.experienceYears ?? 0,
    acceptsHomeVisits: master.acceptsHomeVisits,
    currentStatus: master.currentStatus ?? 'AVAILABLE',
    avatarUrl: master.photoUrl ?? '',
    serviceIds: (master.services ?? []).map((service) => service.id),
    schedules: createDefaultEditorSchedule(),
  }))

  return {
    overview: {
      name: input.salon.name,
      businessType: typeof profileMeta?.businessType === 'string' ? profileMeta.businessType : 'Friseursalon',
      tagline: input.salon.description ?? 'Demo-Profil für PickMe Partner Onboarding',
      description: input.salon.description ?? '',
      phone: input.salon.phone ?? '',
      email: input.salon.email ?? '',
      website: input.salon.website ?? '',
      addressLine: input.salon.addressLine ?? input.salon.addressLine1 ?? '',
      city: input.salon.city,
      postalCode: input.salon.postalCode,
      openingHoursText: toOpeningHoursText(input.salon.openingHoursJson),
      languages: Array.isArray(profileMeta?.languages)
        ? profileMeta.languages.filter((entry): entry is string => typeof entry === 'string')
        : ['Deutsch'],
      amenities: Array.isArray(profileMeta?.amenities)
        ? profileMeta.amenities.filter((entry): entry is string => typeof entry === 'string')
        : [],
      parking: typeof profileMeta?.parking === 'string' ? profileMeta.parking : '',
      accessibility: typeof profileMeta?.accessibility === 'string' ? profileMeta.accessibility : 'Barrierearmer Zugang',
      paymentMethods: toEditorPaymentMethods(profileMeta?.paymentMethods),
      bookingConfirmationMode: profileMeta?.bookingConfirmationMode === 'REQUEST' ? 'REQUEST' : 'AUTO',
      foundedYear: typeof profileMeta?.foundedYear === 'number' ? profileMeta.foundedYear : 2019,
    },
    moreInfo: {
      about: typeof profileMeta?.moreInfo === 'string' ? profileMeta.moreInfo : 'Live Demo-Profil für zukünftige Saloninhaber auf PickMe.',
      history: typeof profileMeta?.history === 'string' ? profileMeta.history : 'PickMe Demo Studio mit realen Team- und Verfügbarkeitsdaten.',
      serviceDirections: Array.isArray(profileMeta?.serviceDirections)
        ? profileMeta.serviceDirections.filter((entry): entry is string => typeof entry === 'string')
        : ['Haarschnitt', 'Coloration', 'Styling'],
      rules: Array.isArray(profileMeta?.rules)
        ? profileMeta.rules.filter((entry): entry is string => typeof entry === 'string')
        : ['Bitte 10 Minuten vor Termin erscheinen'],
      teamNote: typeof profileMeta?.teamNote === 'string' ? profileMeta.teamNote : 'Teamstatus wird live aus Buchungen berechnet.',
    },
    services,
    staff,
    photos,
    coverPhotoId: photos[0]?.id ?? photos[0]?.imageUrl ?? null,
    googleCoverUrl: null,
  }
}

function readSalonProfileFlags(value: unknown): { labels: string[]; isDemoProfile: boolean } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { labels: [], isDemoProfile: false }
  }

  const flags = (value as { pickmeProfileFlags?: unknown }).pickmeProfileFlags
  if (!flags || typeof flags !== 'object' || Array.isArray(flags)) {
    return { labels: [], isDemoProfile: false }
  }

  const casted = flags as { labels?: unknown; isDemoProfile?: unknown }
  return {
    labels: Array.isArray(casted.labels) ? casted.labels.filter((item): item is string => typeof item === 'string') : [],
    isDemoProfile: casted.isDemoProfile === true,
  }
}

function formatPaymentMethodLabel(value: EditorPaymentMethod) {
  return EDITOR_PAYMENT_OPTIONS.find((option) => option.id === value)?.label ?? value
}

function isGooglePhotoUrl(url?: string | null) {
  return Boolean(url?.includes('/api/catalog/google-photo?'))
}

function getPlaceholderCover(name?: string | null) {
  const label = encodeURIComponent(name || 'PickMe')
  return `https://placehold.co/1200x720/E8EFEF/1B3338?text=${label}`
}

function resolveCoverUrl(input: {
  coverPhotoId?: string | null
  googleCoverUrl?: string | null
  photos: SalonEditorPhotoItem[]
  fallbackName?: string | null
}) {
  if (input.coverPhotoId === GOOGLE_COVER_SENTINEL && input.googleCoverUrl) {
    return input.googleCoverUrl
  }

  const explicitPhoto = input.photos.find((photo) => photo.id && photo.id === input.coverPhotoId)
  if (explicitPhoto?.imageUrl) {
    return explicitPhoto.imageUrl
  }

  if (input.googleCoverUrl) {
    return input.googleCoverUrl
  }

  const firstOwnPhoto = input.photos.find((photo) => !isGooglePhotoUrl(photo.imageUrl))
  if (firstOwnPhoto?.imageUrl) {
    return firstOwnPhoto.imageUrl
  }

  return getPlaceholderCover(input.fallbackName)
}

function createEmptyDemoDraftFromSalon(salon: SalonSummary): SalonEditorDraftPayload {
  return {
    overview: {
      name: salon.name || 'Demo Salon',
      businessType: '',
      tagline: 'Demo-Profil: Schritt für Schritt zur fertigen PickMe-Vitrine',
      description: '',
      phone: '',
      email: '',
      website: '',
      addressLine: '',
      city: salon.city || '',
      postalCode: salon.postalCode || '',
      openingHoursText: '',
      languages: [],
      amenities: [],
      parking: '',
      accessibility: '',
      paymentMethods: [],
      bookingConfirmationMode: 'AUTO',
      foundedYear: null,
    },
    moreInfo: {
      about: '',
      history: '',
      serviceDirections: [],
      rules: [],
      teamNote: '',
    },
    services: [],
    staff: [],
    photos: [],
    coverPhotoId: null,
    googleCoverUrl: null,
  }
}

function getEntityKey(id: string | undefined, index: number, prefix: string) {
  return id && id.trim().length > 0 ? id : `${prefix}-${index}`
}

function calculateDemoCompleteness(draft: SalonEditorDraftPayload): DemoCompletenessResult {
  const checks = {
    unternehmensdaten: Boolean(draft.overview.name.trim() && draft.overview.addressLine.trim()),
    fotos: draft.photos.some((photo) => photo.imageUrl.trim().length > 0),
    leistungen: draft.services.some((service) => service.name.trim().length > 0),
    mitarbeiter: draft.staff.some((staff) => staff.displayName.trim().length > 0),
    arbeitszeiten: draft.staff.some((staff) =>
      staff.schedules.some((row) => !row.isDayOff && row.shiftStart.trim().length > 0 && row.shiftEnd.trim().length > 0),
    ),
    zahlungsarten: draft.overview.paymentMethods.length > 0,
    beschreibung: Boolean(draft.overview.description.trim() || draft.moreInfo.about.trim()),
  }

  const values = Object.values(checks)
  const passed = values.filter(Boolean).length
  const percent = Math.round((passed / values.length) * 100)
  const tips: string[] = []

  if (!checks.fotos) tips.push('Fügen Sie mindestens ein Titelbild hinzu.')
  if (!checks.leistungen) tips.push('Legen Sie mindestens eine Leistung an.')
  if (!checks.arbeitszeiten) tips.push('Fügen Sie Arbeitszeiten für Mitarbeiter hinzu.')
  if (!checks.beschreibung) tips.push('Vervollständigen Sie Ihre Beschreibung.')

  return { percent, tips }
}

export function SalonDetailPage() {
  const { salonId } = useParams()

  if (!salonId) {
    return <div className="rounded-3xl bg-white p-4">Salondetails sind derzeit nicht verfügbar.</div>
  }

  return <SalonDetailContent salonId={salonId} key={salonId} />
}

function SalonDetailContent({ salonId }: { salonId: string }) {
  const navigate = useNavigate()
  const location = useLocation()
  const currentUser = useAuthStore((state) => state.currentUser)
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN'
  const adminModeEnabled = useAdminModeStore((state) => state.enabled)
  const isSuperAdminMode = isSuperAdmin && adminModeEnabled
  const queryClient = useQueryClient()

  const presentationSalon = PRESENTATION_MODE ? getPresentationSalonById(salonId) : undefined
  const isPresentationSalon = Boolean(presentationSalon)

  const draftStorageKey = `pickme:booking-draft:${salonId}`
  const initialDraft = useMemo(() => readBookingDraft(draftStorageKey), [draftStorageKey])

  const [step, setStep] = useState<BookingStep>(
    initialDraft.step && initialDraft.step >= 1 && initialDraft.step <= 6 ? initialDraft.step : 1,
  )
  const [selectedItems, setSelectedItems] = useState<SelectedBookingItem[]>(() => {
    if (initialDraft.items && initialDraft.items.length > 0) {
      return initialDraft.items.map((item) => ({ ...item, quantity: 1 }))
    }
    if (initialDraft.serviceIds && initialDraft.serviceIds.length > 0) {
      return initialDraft.serviceIds.map((serviceId) => ({ serviceId, quantity: 1, modifierOptionIds: [] }))
    }
    return initialDraft.serviceId ? [{ serviceId: initialDraft.serviceId, quantity: 1, modifierOptionIds: [] }] : []
  })
  const [activeServiceForAddons, setActiveServiceForAddons] = useState<string | null>(selectedItems[0]?.serviceId ?? null)
  const [selectedMasterId, setSelectedMasterId] = useState<string>(initialDraft.masterId ?? ANY_MASTER_VALUE)
  const [selectedDate, setSelectedDate] = useState<string>(initialDraft.date ?? getTodayDateInput())
  const [selectedSlot, setSelectedSlot] = useState<string | null>(initialDraft.slot ?? null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(initialDraft.paymentMethod ?? null)
  const [clientComment, setClientComment] = useState(initialDraft.clientComment ?? '')
  const [additionalWish, setAdditionalWish] = useState(initialDraft.additionalWish ?? '')
  const [bookingNumber, setBookingNumber] = useState<string | null>(null)
  const [confirmedBookingStatus, setConfirmedBookingStatus] = useState<string | null>(null)
  const [isAuthPromptOpen, setIsAuthPromptOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [serviceSearch, setServiceSearch] = useState('')
  const [openedCategory, setOpenedCategory] = useState<string | null>(null)
  const [activeEditorSection, setActiveEditorSection] = useState<'hero' | 'gallery' | 'services' | 'staff' | 'moreInfo' | null>(null)
  const [editorDraft, setEditorDraft] = useState<SalonEditorDraftPayload | null>(null)
  const [demoInitialDraft, setDemoInitialDraft] = useState<SalonEditorDraftPayload | null>(null)
  const [demoPublishedDraft, setDemoPublishedDraft] = useState<SalonEditorDraftPayload | null>(null)
  const [demoWizardStep, setDemoWizardStep] = useState<DemoWizardStep>('UNTERNEHMEN')
  const [demoPreviewView, setDemoPreviewView] = useState<DemoPreviewView>('SALONSEITE')
  const [demoPreviewViewport, setDemoPreviewViewport] = useState<DemoPreviewViewport>('DESKTOP')
  const [demoServiceMeta, setDemoServiceMeta] = useState<Record<string, DemoServiceMeta>>({})
  const [demoStaffMeta, setDemoStaffMeta] = useState<Record<string, DemoStaffMeta>>({})
  const [demoSimulation, setDemoSimulation] = useState<DemoSimulationState>({
    busyStaffIds: [],
    pausedStaffIds: [],
    simulateNextFree: false,
    nextFreeAt: '13:30',
  })
  const [editorStatusMessage, setEditorStatusMessage] = useState<string | null>(null)
  const [pendingCoverPhotoId, setPendingCoverPhotoId] = useState<string | null>(null)

  const demoConstructorStorageKey = `pickme:demo-constructor:${salonId}`

  const salonQuery = useQuery({
    queryKey: salonKeys.detail(salonId),
    queryFn: () => salonApi.getById(salonId),
    enabled: !isPresentationSalon,
  })

  const serviceListQuery = useQuery({
    queryKey: serviceKeys.list({ salonId }),
    queryFn: () => serviceApi.list({ salonId, limit: 200 }),
    enabled: !isPresentationSalon,
  })

  const effectiveServices = useMemo(() => {
    if (isPresentationSalon) return getPresentationSalonServices(salonId)
    return serviceListQuery.data?.items ?? []
  }, [isPresentationSalon, salonId, serviceListQuery.data])

  const effectiveSelectedServiceId = selectedItems[0]?.serviceId ?? effectiveServices[0]?.id ?? null

  const masterListQuery = useQuery({
    queryKey: masterKeys.list({ salonId, serviceId: effectiveSelectedServiceId }),
    queryFn: () =>
      masterApi.list({
        salonId,
        serviceId: effectiveSelectedServiceId ?? undefined,
        limit: 50,
        offset: 0,
      }),
    enabled: !isPresentationSalon && Boolean(effectiveSelectedServiceId),
  })

  const effectiveMasters = useMemo(() => {
    if (!effectiveSelectedServiceId && isPresentationSalon) return getPresentationSalonMasters(salonId)
    if (isPresentationSalon) return getPresentationSalonMasters(salonId, effectiveSelectedServiceId ?? undefined)
    return masterListQuery.data?.items ?? []
  }, [effectiveSelectedServiceId, isPresentationSalon, masterListQuery.data, salonId])

  const quoteQuery = useQuery({
    queryKey: ['booking-quote', salonId, selectedItems],
    queryFn: () =>
      bookingApi.quote({
        salonId,
        items: selectedItems.map((item) => ({
          serviceId: item.serviceId,
          quantity: 1,
          modifierOptionIds: item.modifierOptionIds,
        })),
      }),
    enabled: selectedItems.length > 0,
  })

  const effectiveSalon = useMemo(() => {
    if (isPresentationSalon) return getPresentationSalonSummary(salonId)
    return salonQuery.data ?? null
  }, [isPresentationSalon, salonId, salonQuery.data])

  const salonProfileFlags = readSalonProfileFlags(effectiveSalon?.cancellationPolicyJson)
  const isLiveDemoSalon = !isPresentationSalon && salonProfileFlags.isDemoProfile

  const slotsQuery = useQuery({
    queryKey: bookingKeys.slots({
      salonId,
      serviceId: effectiveSelectedServiceId,
      masterId: selectedMasterId,
      date: selectedDate,
      presentation: isPresentationSalon || (isLiveDemoSalon && PRESENTATION_MODE),
      selectedItems,
    }),
    queryFn: async () => {
      // live demo salons in presentation mode use template slots (no schedule in DB)
      const usePresentationSlots = isPresentationSalon || (isLiveDemoSalon && PRESENTATION_MODE)
      const presentationSalonId = isPresentationSalon ? salonId : 'demo-atelier-royal'
      if (usePresentationSlots) {
        return {
          salonId,
          serviceId: effectiveSelectedServiceId ?? '',
          durationMinutes: quoteQuery.data?.totalDurationMinutes ?? 45,
          date: selectedDate,
          slots: getPresentationSalonSlots({
            salonId: presentationSalonId,
            // live demo salons use real service IDs; pass empty string to match all presentation staff
            serviceId: isPresentationSalon ? (effectiveSelectedServiceId ?? '') : '',
            date: selectedDate,
            masterId: selectedMasterId === ANY_MASTER_VALUE ? undefined : selectedMasterId,
          }),
        }
      }

      return bookingApi.getSlots({
        salonId,
        serviceId: effectiveSelectedServiceId ?? '',
        serviceIds: selectedItems.map((item) => item.serviceId).join(','),
        date: selectedDate,
        masterId: selectedMasterId === ANY_MASTER_VALUE ? undefined : selectedMasterId,
      })
    },
    enabled: Boolean(effectiveSelectedServiceId && selectedDate && selectedItems.length > 0),
  })

  const createBookingMutation = useMutation({
    mutationFn: bookingApi.create,
  })

  const realCanEdit = !isPresentationSalon && (isSuperAdmin ? isSuperAdminMode : canEditOwnedSalon(currentUser, salonId))

  const editorStateQuery = useQuery({
    queryKey: ['salon-editor', salonId],
    queryFn: () => salonApi.getEditorState(salonId),
    enabled: realCanEdit,
  })

  const saveEditorDraftMutation = useMutation({
    mutationFn: (draft: SalonEditorDraftPayload) => salonApi.saveDraft(salonId, draft),
    onSuccess: (response) => {
      setEditorDraft(response.draft)
      setEditorStatusMessage('Entwurf gespeichert')
      void queryClient.invalidateQueries({ queryKey: ['salon-editor', salonId] })
    },
  })

  const publishEditorDraftMutation = useMutation({
    mutationFn: () => salonApi.publishDraft(salonId),
    onSuccess: async (response) => {
      setEditorDraft(response.draft)
      setEditorStatusMessage('Profil veröffentlicht')
      setIsEditMode(false)
      setIsPreviewMode(false)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: salonKeys.detail(salonId) }),
        queryClient.invalidateQueries({ queryKey: serviceKeys.list({ salonId }) }),
        queryClient.invalidateQueries({ queryKey: masterKeys.list({ salonId }) }),
        queryClient.invalidateQueries({ queryKey: bookingKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['salon-editor', salonId] }),
      ])
    },
  })

  const ownerPublished = useMemo(() => {
    if (isPresentationSalon) return null
    return editorStateQuery.data?.published ?? extractOwnerEditorPublished(effectiveSalon as SalonSummary | null)
  }, [editorStateQuery.data?.published, effectiveSalon, isPresentationSalon])

  useEffect(() => {
    if (editorStateQuery.data?.draft) {
      setEditorDraft(editorStateQuery.data.draft)
    }
  }, [editorStateQuery.data])

  const ownerDraft = editorDraft ?? editorStateQuery.data?.draft ?? null

  const selectedMaster =
    selectedMasterId === ANY_MASTER_VALUE
      ? null
      : (effectiveMasters.find((master) => master.id === selectedMasterId) ?? null)

  const demoCanEdit = isSuperAdminMode && (isLiveDemoSalon || (isPresentationSalon && presentationSalon
    ? canEditDemoSalon(currentUser, salonId, presentationSalon.ownerId, presentationSalon.editableByUserIds)
    : false))

  const canEditSalonProfile = demoCanEdit || realCanEdit

  const partnerOrders = (demoCanEdit || realCanEdit) ? readPartnerOrders(salonId) : []

  useEffect(() => {
    if (!demoCanEdit || !effectiveSalon || editorDraft) return

    if (isLiveDemoSalon) {
      try {
        const raw = localStorage.getItem(demoConstructorStorageKey)
        if (raw) {
          const parsed = JSON.parse(raw) as {
            draft?: SalonEditorDraftPayload
            initialDraft?: SalonEditorDraftPayload
            publishedDraft?: SalonEditorDraftPayload
            serviceMeta?: Record<string, DemoServiceMeta>
            staffMeta?: Record<string, DemoStaffMeta>
            simulation?: DemoSimulationState
          }

          if (parsed.draft && parsed.initialDraft && parsed.publishedDraft) {
            setEditorDraft(parsed.draft)
            setDemoInitialDraft(parsed.initialDraft)
            setDemoPublishedDraft(parsed.publishedDraft)
            setDemoServiceMeta(parsed.serviceMeta ?? {})
            setDemoStaffMeta(parsed.staffMeta ?? {})
            setDemoSimulation(parsed.simulation ?? {
              busyStaffIds: [],
              pausedStaffIds: [],
              simulateNextFree: false,
              nextFreeAt: '13:30',
            })
            return
          }
        }
      } catch {
        localStorage.removeItem(demoConstructorStorageKey)
      }

      const emptyDraft = createEmptyDemoDraftFromSalon(effectiveSalon)
      setEditorDraft(emptyDraft)
      setDemoInitialDraft(emptyDraft)
      setDemoPublishedDraft(emptyDraft)
      setDemoServiceMeta({})
      setDemoStaffMeta({})
      setDemoSimulation({
        busyStaffIds: [],
        pausedStaffIds: [],
        simulateNextFree: false,
        nextFreeAt: '13:30',
      })
      return
    }

    const draft = toDemoEditorDraftFromLive({
      salon: effectiveSalon,
      services: effectiveServices,
      masters: effectiveMasters,
    })
    setEditorDraft(draft)
    setDemoInitialDraft(draft)
    setDemoPublishedDraft(draft)
  }, [
    demoCanEdit,
    demoConstructorStorageKey,
    effectiveMasters,
    effectiveSalon,
    effectiveServices,
    editorDraft,
    isLiveDemoSalon,
  ])

  useEffect(() => {
    if (!demoCanEdit || !isLiveDemoSalon || !editorDraft || !demoInitialDraft || !demoPublishedDraft) return
    localStorage.setItem(
      demoConstructorStorageKey,
      JSON.stringify({
        draft: editorDraft,
        initialDraft: demoInitialDraft,
        publishedDraft: demoPublishedDraft,
        serviceMeta: demoServiceMeta,
        staffMeta: demoStaffMeta,
        simulation: demoSimulation,
      }),
    )
  }, [
    demoCanEdit,
    demoConstructorStorageKey,
    demoInitialDraft,
    demoPublishedDraft,
    demoServiceMeta,
    demoSimulation,
    demoStaffMeta,
    editorDraft,
    isLiveDemoSalon,
  ])

  useEffect(() => {
    if (!demoCanEdit || !canEditSalonProfile) return
    const params = new URLSearchParams(location.search)
    if (params.get('demoEdit') !== '1') return
    setIsEditMode(true)
    setIsPreviewMode(false)
    setActiveEditorSection('hero')
  }, [canEditSalonProfile, demoCanEdit, location.search])

  const visibleDraft = isPreviewMode
    ? ownerDraft
    : demoCanEdit
      ? demoPublishedDraft
      : null

  const isDemoConstructorMode = demoCanEdit && isLiveDemoSalon

  const displayOverview = visibleDraft?.overview ?? ownerPublished?.overview ?? null
  const displayMoreInfo = visibleDraft?.moreInfo ?? ownerPublished?.moreInfo ?? null
  const displayPhotos = visibleDraft?.photos ?? ((effectiveSalon?.photos ?? []) as SalonEditorPhotoItem[])
  const previewServices = visibleDraft?.services ?? null
  const previewStaff = visibleDraft?.staff ?? null

  const publicHeroTagline = displayOverview?.tagline || effectiveSalon?.description || 'Beschreibung wird ergänzt.'
  const publicBusinessType = displayOverview?.businessType || (effectiveSalon?.sourceType === 'EXTERNAL' ? 'Externer Salon' : 'Friseursalon')
  const publicAddressLine = isDemoConstructorMode
    ? (displayOverview?.addressLine || 'Adresse wird im Demo Editor ergänzt')
    : (displayOverview?.addressLine || effectiveSalon?.addressLine || `${effectiveSalon?.city}, ${effectiveSalon?.postalCode}`)
  const publicPhone = isDemoConstructorMode
    ? (displayOverview?.phone || 'Noch nicht angegeben')
    : (displayOverview?.phone || effectiveSalon?.phone || 'Auf Anfrage')
  const publicOpeningHoursText = isDemoConstructorMode
    ? (displayOverview?.openingHoursText || 'Noch nicht angegeben')
    : (displayOverview?.openingHoursText || (typeof effectiveSalon?.openingHoursJson === 'object' && effectiveSalon?.openingHoursJson && !Array.isArray(effectiveSalon.openingHoursJson) ? String((effectiveSalon.openingHoursJson as { displayText?: string }).displayText ?? '') : '') || presentationSalon?.workHours || 'Mo-Sa 09:00 - 20:00')
  const publicCoverUrl = isPresentationSalon
    ? presentationSalon?.photos?.[0] ?? getPlaceholderCover(effectiveSalon?.name)
    : resolveCoverUrl({
        coverPhotoId: ownerPublished?.coverPhotoId ?? null,
        googleCoverUrl: ownerPublished?.googleCoverUrl ?? null,
        photos: ((effectiveSalon?.photos ?? []) as SalonEditorPhotoItem[]),
        fallbackName: displayOverview?.name || effectiveSalon?.name,
      })
  const previewCoverUrl = visibleDraft
    ? resolveCoverUrl({
        coverPhotoId: visibleDraft.coverPhotoId ?? null,
        googleCoverUrl: visibleDraft.googleCoverUrl ?? null,
        photos: visibleDraft.photos,
        fallbackName: visibleDraft.overview.name,
      })
    : publicCoverUrl
  const activeCoverUrl = previewCoverUrl

  const quotedItems = quoteQuery.data?.items ?? []
  const optionalExtrasPrice = quotedItems.reduce((sum, line) => sum + line.modifierPrice * line.quantity, 0)
  const baseServicesPrice = quotedItems.reduce((sum, line) => sum + line.basePrice * line.quantity, 0)
  const totalPrice = quoteQuery.data?.totalPrice ?? 0
  const totalDurationMinutes = quoteQuery.data?.totalDurationMinutes ?? 0
  const bookingDateTimeLabel = selectedSlot ? formatSlotDateTime(selectedSlot) : '-'
  const serviceFee = 0
  const amountOnline = 0
  const amountAtSalon = totalPrice

  const paymentMethodLabel =
    paymentMethod === 'IN_SALON'
      ? 'Vor Ort bezahlen'
      : paymentMethod === 'CARD'
        ? 'Karte vor Ort'
        : 'Nicht gewählt'

  const clientName = currentUser?.name || PRESENTATION_CUSTOMER.fullName
  const clientPhone = currentUser?.phone || PRESENTATION_CUSTOMER.phone

  const filteredServices = useMemo(() => {
    if (!serviceSearch.trim()) return effectiveServices
    const needle = serviceSearch.trim().toLowerCase()
    return effectiveServices.filter((service) => service.name.toLowerCase().includes(needle))
  }, [effectiveServices, serviceSearch])

  const groupedServices = useMemo(() => groupServicesByCategory(filteredServices), [filteredServices])

  const contentServices = previewServices?.map((service) => ({
    id: service.id ?? service.name,
    name: service.name,
    description: service.description,
    category: service.category,
    basePrice: service.basePrice,
    durationMinutes: service.durationMinutes,
    availableInSalon: service.availableInSalon,
    availableAtHome: service.availableAtHome,
    isActive: service.isActive,
  })) ?? effectiveServices
  const filteredContentServices = useMemo(() => {
    if (!serviceSearch.trim()) return contentServices
    const needle = serviceSearch.trim().toLowerCase()
    return contentServices.filter((service) => service.name.toLowerCase().includes(needle))
  }, [contentServices, serviceSearch])
  const groupedContentServices = useMemo(() => groupServicesByCategory(filteredContentServices), [filteredContentServices])
  const availablePaymentMethods = displayOverview?.paymentMethods?.length
    ? displayOverview.paymentMethods
    : ['IN_SALON', 'CARD'] as EditorPaymentMethod[]

  const contentMasters = previewStaff?.map((staff) => ({
    id: staff.id ?? staff.displayName,
    displayName: staff.displayName,
    specialization: staff.specialization,
    currentStatus: mapEditorStaffStatus(staff.currentStatus),
    acceptsHomeVisits: staff.acceptsHomeVisits ?? false,
    biography: staff.biography,
    experienceYears: staff.experienceYears,
  })) ?? effectiveMasters

  const demoCompleteness = useMemo(() => {
    if (!editorDraft) return { percent: 0, tips: [] }
    return calculateDemoCompleteness(editorDraft)
  }, [editorDraft])

  const todayWeekDay = new Date().getDay()
  const demoWorkingStaff = useMemo(() => {
    if (!editorDraft) return []
    return editorDraft.staff.filter((staff, index) => {
      const staffKey = getEntityKey(staff.id, index, 'staff')
      const meta = demoStaffMeta[staffKey]
      if (meta?.isActive === false) return false
      const todaySchedule = staff.schedules.find((row) => row.dayOfWeek === todayWeekDay)
      if (!todaySchedule || todaySchedule.isDayOff) return false
      if (!todaySchedule.shiftStart || !todaySchedule.shiftEnd) return false
      return true
    })
  }, [demoStaffMeta, editorDraft, todayWeekDay])

  const demoBusySet = useMemo(() => new Set(demoSimulation.busyStaffIds), [demoSimulation.busyStaffIds])
  const demoPauseSet = useMemo(() => new Set(demoSimulation.pausedStaffIds), [demoSimulation.pausedStaffIds])

  const demoLiveSummary = useMemo(() => {
    if (!editorDraft) {
      return {
        hasIncompleteData: true,
        heuteImEinsatz: 0,
        jetztVerfuegbar: 0,
        inKuerzeVerfuegbar: 0,
        ausgebucht: 0,
        naechsterFreierTermin: null as string | null,
      }
    }

    const hasServices = editorDraft.services.some((service) => service.name.trim().length > 0)
    const hasSchedules = editorDraft.staff.some((staff) =>
      staff.schedules.some((row) => !row.isDayOff && row.shiftStart.trim().length > 0 && row.shiftEnd.trim().length > 0),
    )

    const heuteImEinsatz = demoWorkingStaff.length
    const ausgebucht = demoWorkingStaff.filter((staff) => demoBusySet.has(staff.id ?? staff.displayName)).length
    const inKuerzeVerfuegbar = demoWorkingStaff.filter((staff) => demoPauseSet.has(staff.id ?? staff.displayName)).length
    const jetztVerfuegbar = Math.max(heuteImEinsatz - ausgebucht - inKuerzeVerfuegbar, 0)

    let naechsterFreierTermin: string | null = null
    if (demoSimulation.simulateNextFree && demoSimulation.nextFreeAt.trim().length > 0) {
      naechsterFreierTermin = demoSimulation.nextFreeAt
    } else if (jetztVerfuegbar > 0) {
      const now = new Date()
      now.setMinutes(now.getMinutes() + 30)
      naechsterFreierTermin = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(now)
    }

    return {
      hasIncompleteData: !(hasServices && hasSchedules),
      heuteImEinsatz,
      jetztVerfuegbar,
      inKuerzeVerfuegbar,
      ausgebucht,
      naechsterFreierTermin,
    }
  }, [demoBusySet, demoPauseSet, demoSimulation.nextFreeAt, demoSimulation.simulateNextFree, demoWorkingStaff, editorDraft])

  const masterNextSlotById = useMemo(() => {
    const map = new Map<string, string | null>()
    for (const master of contentMasters) {
      const slot = (slotsQuery.data?.slots ?? []).find((entry) => entry.availableMasterIds.includes(master.id))
      map.set(master.id, slot?.startsAt ?? null)
    }
    return map
  }, [contentMasters, slotsQuery.data])

  const updateDraft = (updater: (draft: SalonEditorDraftPayload) => SalonEditorDraftPayload) => {
    setEditorDraft((currentDraft) => {
      if (!currentDraft) return currentDraft
      setEditorStatusMessage('Nicht veröffentlicht')
      return updater(currentDraft)
    })
  }

  const handleSaveEditorDraft = async () => {
    if (!editorDraft) return
    await saveEditorDraftMutation.mutateAsync(editorDraft)
  }

  const handlePublishEditorDraft = async () => {
    setEditorStatusMessage(null)
    await publishEditorDraftMutation.mutateAsync()
  }

  const handleDemoPublish = () => {
    if (!editorDraft) return
    const snapshot = JSON.parse(JSON.stringify(editorDraft)) as SalonEditorDraftPayload
    setDemoPublishedDraft(snapshot)
    setIsPreviewMode(false)
    setIsEditMode(false)
    setEditorStatusMessage('Demo veröffentlicht (nur lokal)')
  }

  const handleDemoReset = () => {
    const confirmed = window.confirm('Demo zurücksetzen? Alle eingegebenen Demo-Daten werden lokal gelöscht.')
    if (!confirmed) return

    if (!demoInitialDraft) return
    const snapshot = JSON.parse(JSON.stringify(demoInitialDraft)) as SalonEditorDraftPayload
    setEditorDraft(snapshot)
    setDemoPublishedDraft(snapshot)
    setDemoServiceMeta({})
    setDemoStaffMeta({})
    setDemoSimulation({
      busyStaffIds: [],
      pausedStaffIds: [],
      simulateNextFree: false,
      nextFreeAt: '13:30',
    })
    setIsPreviewMode(false)
    setIsEditMode(false)
    if (isLiveDemoSalon) {
      localStorage.removeItem(demoConstructorStorageKey)
    }
    setEditorStatusMessage('Demo zurückgesetzt')
  }

  const handleDemoPhotoUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const dataUrls = await Promise.all(
      Array.from(files).slice(0, 8).map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result ?? ''))
            reader.onerror = () => reject(new Error('FILE_READ_FAILED'))
            reader.readAsDataURL(file)
          }),
      ),
    )

    updateDraft((draft) => {
      const startIndex = draft.photos.length
      const appended = dataUrls
        .filter((value) => value.length > 0)
        .map((imageUrl, index) => ({
          id: `demo-upload-${Date.now()}-${index}`,
          imageUrl,
          sortOrder: startIndex + index,
        }))

      const nextPhotos = [...draft.photos, ...appended]
      return {
        ...draft,
        photos: nextPhotos,
        coverPhotoId: draft.coverPhotoId ?? appended[0]?.id ?? nextPhotos[0]?.id ?? null,
      }
    })
  }

  const toggleEditorPaymentMethod = (value: EditorPaymentMethod) => {
    updateDraft((draft) => ({
      ...draft,
      overview: {
        ...draft.overview,
        paymentMethods: draft.overview.paymentMethods.includes(value)
          ? draft.overview.paymentMethods.filter((item) => item !== value)
          : [...draft.overview.paymentMethods, value],
      },
    }))
  }

  const addDraftService = () => {
    const newId = `demo-service-${Date.now()}`
    updateDraft((draft) => ({
      ...draft,
      services: [...draft.services, {
        id: newId,
        name: '',
        description: '',
        category: 'Styling',
        basePrice: 0,
        durationMinutes: 30,
        availableInSalon: true,
        availableAtHome: false,
        isActive: true,
      }],
    }))
    setDemoServiceMeta((current) => ({
      ...current,
      [newId]: {
        serviceKey: newId,
        priceType: 'FESTPREIS',
        addOns: [],
        assignedStaffIds: [],
        isActive: true,
      },
    }))
  }

  const addDraftStaff = () => {
    const newId = `demo-staff-${Date.now()}`
    updateDraft((draft) => ({
      ...draft,
      staff: [...draft.staff, {
        id: newId,
        displayName: '',
        specialization: '',
        biography: '',
        experienceYears: 0,
        acceptsHomeVisits: false,
        currentStatus: 'AVAILABLE',
        avatarUrl: '',
        serviceIds: [],
        schedules: createDefaultEditorSchedule(),
      }],
    }))
    setDemoStaffMeta((current) => ({
      ...current,
      [newId]: {
        staffKey: newId,
        jobTitle: '',
        languages: [],
        isActive: true,
      },
    }))
  }

  const addDraftPhoto = () => {
    updateDraft((draft) => ({
      ...draft,
      photos: [...draft.photos, {
        imageUrl: '',
        sortOrder: draft.photos.length,
      }],
    }))
  }

  const selectCoverPhoto = (coverPhotoId: string) => {
    if (!editorDraft) return

    if (editorDraft.coverPhotoId === GOOGLE_COVER_SENTINEL && editorDraft.googleCoverUrl && !isGooglePhotoUrl(editorDraft.photos.find((photo) => photo.id === coverPhotoId)?.imageUrl)) {
      setPendingCoverPhotoId(coverPhotoId)
      return
    }

    updateDraft((draft) => ({
      ...draft,
      coverPhotoId,
    }))
  }

  const restoreGoogleCover = () => {
    updateDraft((draft) => ({
      ...draft,
      coverPhotoId: GOOGLE_COVER_SENTINEL,
    }))
    setPendingCoverPhotoId(null)
  }

  useEffect(() => {
    if (groupedServices.length > 0 && !openedCategory) {
      setOpenedCategory(groupedServices[0].category)
    }
  }, [groupedServices, openedCategory])

  useEffect(() => {
    if (step === 7) return

    const draft: BookingDraft = {
      serviceId: effectiveSelectedServiceId ?? undefined,
      serviceIds: selectedItems.map((item) => item.serviceId),
      items: selectedItems,
      masterId: selectedMasterId,
      date: selectedDate,
      slot: selectedSlot ?? undefined,
      step,
      paymentMethod,
      clientComment,
      additionalWish,
    }

    sessionStorage.setItem(draftStorageKey, JSON.stringify(draft))
  }, [
    clientComment,
    draftStorageKey,
    effectiveSelectedServiceId,
    additionalWish,
    paymentMethod,
    selectedDate,
    selectedItems,
    selectedMasterId,
    selectedSlot,
    step,
  ])

  if (salonQuery.isPending && !isPresentationSalon) {
    return <div className="rounded-3xl bg-white p-4">Laden...</div>
  }

  if (!effectiveSalon) {
    return <div className="rounded-3xl bg-white p-4">Salondetails sind derzeit nicht verfügbar.</div>
  }

  const isExternalSalon = effectiveSalon.sourceType === 'EXTERNAL'
  const resetScope: 'DEMO_SALON' | 'TESTBETRIEB' | undefined = salonProfileFlags.isDemoProfile
    ? 'DEMO_SALON'
    : ((effectiveSalon as { externalProvider?: string | null }).externalProvider === 'PICKME_TEST' ? 'TESTBETRIEB' : undefined)
  const isLocked = String((effectiveSalon as { openingStatus?: string | null }).openingStatus ?? 'ACTIVE').toUpperCase() === 'LOCKED'
  const slots = slotsQuery.data?.slots ?? []
  const slotsError = extractApiError(slotsQuery.error)
  const createBookingError = extractApiError(createBookingMutation.error)

  const handleConfirmBooking = async () => {
    if (!effectiveSelectedServiceId || !selectedSlot || !paymentMethod) return

    if (!currentUser) {
      setIsAuthPromptOpen(true)
      return
    }

    const selectedService = effectiveServices.find((service) => service.id === effectiveSelectedServiceId)
    if (!selectedService) return

    if (isPresentationSalon || (isLiveDemoSalon && PRESENTATION_MODE)) {
      const generatedBookingNumber = buildPresentationBookingNumber()
      setBookingNumber(generatedBookingNumber)
      setConfirmedBookingStatus('confirmed')
      savePartnerOrder(salonId, {
        bookingNumber: generatedBookingNumber,
        customerName: clientName,
        customerPhone: clientPhone,
        salonName: effectiveSalon.name,
        salonPhone: effectiveSalon.phone || 'Auf Anfrage',
        serviceName: selectedService.name,
        masterName: selectedMaster?.displayName ?? 'Beliebiger verfügbarer Meister',
        date: selectedDate,
        time: bookingDateTimeLabel,
        durationMinutes: totalDurationMinutes,
        servicePrice: baseServicesPrice,
        optionalExtrasPrice,
        totalPrice,
        paymentMethodLabel,
        paymentStatus: 'Vor Ort zu zahlen',
        clientComment,
      })
      sessionStorage.removeItem(draftStorageKey)
      setStep(7)
      return
    }

    const response = await createBookingMutation.mutateAsync({
      salonId: effectiveSalon.id,
      serviceId: selectedService.id,
      startsAt: selectedSlot,
      masterId: selectedMasterId === ANY_MASTER_VALUE ? undefined : selectedMasterId,
      items: selectedItems.map((item) => ({
        serviceId: item.serviceId,
        quantity: 1,
        modifierOptionIds: item.modifierOptionIds,
      })),
      additionalWish: additionalWish.trim() || undefined,
      paymentMethod,
    })

    setBookingNumber(`PM-2026-${response.id.slice(-5).toUpperCase()}`)
    setConfirmedBookingStatus(response.status)
    sessionStorage.removeItem(draftStorageKey)
    setStep(7)
  }

  const selectedServiceForAddons = selectedItems.find((item) => item.serviceId === activeServiceForAddons) ?? selectedItems[0]

  const updateModifierCount = (modifierId: string, nextCount: number) => {
    if (!selectedServiceForAddons) return
    const safeCount = Math.max(0, Math.floor(nextCount))
    setSelectedItems(selectedItems.map((item) => {
      if (item.serviceId !== selectedServiceForAddons.serviceId) return item
      const filtered = item.modifierOptionIds.filter((id) => id !== modifierId)
      return {
        ...item,
        modifierOptionIds: [...filtered, ...Array.from({ length: safeCount }, () => modifierId)],
      }
    }))
  }

  return (
    <div className="space-y-4">
      {isSuperAdminMode ? (
        <SuperAdminModePanel
          entityType="Salon"
          entityId={effectiveSalon.id}
          title={`Admin actions for ${effectiveSalon.name}`}
          canOpenOwnerEditor
          canManageTrial={!isExternalSalon}
          canResetDemo={Boolean(resetScope)}
          resetScope={resetScope}
          onOpenEditor={() => {
            setIsEditMode(true)
            setIsPreviewMode(false)
            setActiveEditorSection('hero')
          }}
          onRefresh={async () => {
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: salonKeys.detail(salonId) }),
              queryClient.invalidateQueries({ queryKey: serviceKeys.list({ salonId }) }),
              queryClient.invalidateQueries({ queryKey: masterKeys.list({ salonId }) }),
              queryClient.invalidateQueries({ queryKey: bookingKeys.all }),
            ])
          }}
          isActive={Boolean((effectiveSalon as { isActive?: boolean }).isActive ?? true)}
          isLocked={isLocked}
        />
      ) : null}

      <section className="rounded-[30px] border border-[#cdd8da] bg-white p-4 shadow-[0_22px_36px_rgba(9,37,41,0.1)]">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm font-semibold text-[#5f757b]">
          <ArrowLeft size={16} /> Zurück
        </button>

        {canEditSalonProfile ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-[#dbe6e8] bg-[#f8fbfb] px-3 py-3">
            <button
              onClick={() => {
                setIsEditMode(true)
                setIsPreviewMode(false)
                setActiveEditorSection('hero')
              }}
              className="btn-secondary"
              type="button"
            >
              {demoCanEdit ? 'Demo bearbeiten' : 'Profil bearbeiten'}
            </button>
            <button onClick={() => setIsPreviewMode((value) => !value)} className="btn-secondary" type="button" disabled={!editorDraft && !demoCanEdit}>
              {isPreviewMode ? 'Vorschau ausblenden' : demoCanEdit ? 'Vorschau als Kunde' : 'Vorschau'}
            </button>
            {!demoCanEdit ? (
              <button onClick={() => void handleSaveEditorDraft()} className="btn-secondary" type="button" disabled={!editorDraft || saveEditorDraftMutation.isPending}>
                {saveEditorDraftMutation.isPending ? 'Speichert...' : 'Entwurf speichern'}
              </button>
            ) : null}
            {!demoCanEdit ? (
              <button onClick={() => void handlePublishEditorDraft()} className="btn-primary" type="button" disabled={publishEditorDraftMutation.isPending}>
                {publishEditorDraftMutation.isPending ? 'Veröffentlicht...' : 'Veröffentlichen'}
              </button>
            ) : null}
            {demoCanEdit ? (
              <button
                onClick={handleDemoPublish}
                className="btn-primary"
                type="button"
                disabled={!editorDraft}
              >
                OK / Veröffentlichen
              </button>
            ) : null}
            {demoCanEdit ? (
              <button
                onClick={handleDemoReset}
                className="btn-secondary"
                type="button"
                disabled={!demoInitialDraft}
              >
                Demo zurücksetzen
              </button>
            ) : null}
            {editorStatusMessage ? <span className="text-xs font-semibold text-[#547278]">{editorStatusMessage}</span> : null}
            {demoCanEdit ? (
              <span className="rounded-full bg-[#edf5f5] px-3 py-1 text-xs font-semibold text-[#1a525a]">
                Profilvollständigkeit: {demoCompleteness.percent}%
              </span>
            ) : null}
            {!demoCanEdit && editorStateQuery.data?.validationIssues?.length ? (
              <div className="basis-full rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Vor Veröffentlichung prüfen: {editorStateQuery.data.validationIssues.join(' · ')}
              </div>
            ) : null}
            {demoCanEdit ? (
              <div className="basis-full rounded-xl border border-[#d8e5e7] bg-[#f8fbfb] px-3 py-2 text-xs text-[#486068]">
                Je vollständiger Sie Ihr Profil ausfüllen, desto professioneller erscheint Ihre PickMe-Vitrine.
              </div>
            ) : null}
          </div>
        ) : null}

        {demoCanEdit && isEditMode && editorDraft ? (
          <div className="mt-3 space-y-3 rounded-2xl border border-[#d7e3e5] bg-[#f8fbfb] p-3">
            <div className="flex flex-wrap gap-2">
              {DEMO_WIZARD_STEPS.map((stepItem) => (
                <button
                  key={stepItem.id}
                  type="button"
                  onClick={() => setDemoWizardStep(stepItem.id)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${demoWizardStep === stepItem.id ? 'bg-[#17666D] text-white' : 'bg-white text-[#355861] border border-[#d6e3e5]'}`}
                >
                  {stepItem.label}
                </button>
              ))}
            </div>

            {demoWizardStep === 'UNTERNEHMEN' ? (
              <div className="grid gap-2 md:grid-cols-2">
                <label className="text-xs font-semibold text-[#5e747b]">Name<input className="field-input mt-1" value={editorDraft.overview.name} onChange={(event) => updateDraft((draft) => ({ ...draft, overview: { ...draft.overview, name: event.target.value } }))} /></label>
                <label className="text-xs font-semibold text-[#5e747b]">Unternehmenstyp<select className="field-input mt-1" value={editorDraft.overview.businessType} onChange={(event) => updateDraft((draft) => ({ ...draft, overview: { ...draft.overview, businessType: event.target.value } }))}><option value="">Bitte wählen</option><option>Friseursalon</option><option>Barbershop</option><option>Nagelstudio</option><option>Beauty Salon</option></select></label>
                <label className="text-xs font-semibold text-[#5e747b]">Telefon<input className="field-input mt-1" value={editorDraft.overview.phone} onChange={(event) => updateDraft((draft) => ({ ...draft, overview: { ...draft.overview, phone: event.target.value } }))} /></label>
                <label className="text-xs font-semibold text-[#5e747b]">E-Mail<input className="field-input mt-1" value={editorDraft.overview.email} onChange={(event) => updateDraft((draft) => ({ ...draft, overview: { ...draft.overview, email: event.target.value } }))} /></label>
                <label className="text-xs font-semibold text-[#5e747b] md:col-span-2">Adresse<input className="field-input mt-1" value={editorDraft.overview.addressLine} onChange={(event) => updateDraft((draft) => ({ ...draft, overview: { ...draft.overview, addressLine: event.target.value } }))} /></label>
              </div>
            ) : null}

            {demoWizardStep === 'BESCHREIBUNG' ? (
              <div className="grid gap-2">
                <label className="text-xs font-semibold text-[#5e747b]">Kurzbeschreibung<textarea className="field-input mt-1 min-h-20" value={editorDraft.overview.description} onChange={(event) => updateDraft((draft) => ({ ...draft, overview: { ...draft.overview, description: event.target.value } }))} /></label>
                <label className="text-xs font-semibold text-[#5e747b]">Über uns<textarea className="field-input mt-1 min-h-20" value={editorDraft.moreInfo.about} onChange={(event) => updateDraft((draft) => ({ ...draft, moreInfo: { ...draft.moreInfo, about: event.target.value } }))} /></label>
              </div>
            ) : null}

            {demoWizardStep === 'FOTOS' ? (
              <div className="space-y-2">
                <label className="flex items-center gap-2 rounded-xl border border-[#d6e3e5] bg-white px-3 py-2 text-xs font-semibold text-[#36555d]">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="max-w-[220px] text-[11px]"
                    onChange={(event) => {
                      void handleDemoPhotoUpload(event.target.files)
                      event.currentTarget.value = ''
                    }}
                  />
                  Fotos hochladen
                </label>
                {editorDraft.photos.length === 0 ? <div className="text-xs text-[#5f7378]">Noch keine Fotos hochgeladen.</div> : null}
              </div>
            ) : null}

            {demoWizardStep === 'LEISTUNGEN' || demoWizardStep === 'PREISE' ? (
              <div className="space-y-2">
                <button type="button" onClick={addDraftService} className="btn-secondary">Leistung hinzufügen</button>
                {editorDraft.services.map((service, index) => {
                  const serviceKey = getEntityKey(service.id, index, 'service')
                  const meta = demoServiceMeta[serviceKey] ?? {
                    serviceKey,
                    priceType: 'FESTPREIS' as DemoServicePriceType,
                    addOns: [],
                    assignedStaffIds: [],
                    isActive: true,
                  }
                  return (
                    <div key={serviceKey} className="grid gap-2 rounded-xl border border-[#d9e3e5] bg-white p-3 md:grid-cols-2">
                      <label className="text-xs font-semibold text-[#5e747b]">Leistungsname<input className="field-input mt-1" value={service.name} onChange={(event) => updateDraft((draft) => ({ ...draft, services: draft.services.map((item, i) => i === index ? { ...item, name: event.target.value } : item) }))} /></label>
                      <label className="text-xs font-semibold text-[#5e747b]">Kategorie<input className="field-input mt-1" value={service.category} onChange={(event) => updateDraft((draft) => ({ ...draft, services: draft.services.map((item, i) => i === index ? { ...item, category: event.target.value } : item) }))} /></label>
                      <label className="text-xs font-semibold text-[#5e747b]">Preis<input className="field-input mt-1" type="number" value={service.basePrice} onChange={(event) => updateDraft((draft) => ({ ...draft, services: draft.services.map((item, i) => i === index ? { ...item, basePrice: Number(event.target.value) } : item) }))} /></label>
                      <label className="text-xs font-semibold text-[#5e747b]">Dauer (Min)<input className="field-input mt-1" type="number" value={service.durationMinutes} onChange={(event) => updateDraft((draft) => ({ ...draft, services: draft.services.map((item, i) => i === index ? { ...item, durationMinutes: Number(event.target.value) } : item) }))} /></label>
                      <label className="text-xs font-semibold text-[#5e747b]">Preis-Typ<select className="field-input mt-1" value={meta.priceType} onChange={(event) => setDemoServiceMeta((current) => ({ ...current, [serviceKey]: { ...meta, priceType: event.target.value as DemoServicePriceType } }))}>{DEMO_PRICE_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                      <label className="text-xs font-semibold text-[#5e747b]">Add-ons (kommagetrennt)<input className="field-input mt-1" value={meta.addOns.join(', ')} onChange={(event) => setDemoServiceMeta((current) => ({ ...current, [serviceKey]: { ...meta, addOns: parseCsvInput(event.target.value) } }))} /></label>
                      <div className="md:col-span-2 flex flex-wrap items-center gap-2 text-xs">
                        <label className="inline-flex items-center gap-2"><input type="checkbox" checked={meta.isActive} onChange={(event) => setDemoServiceMeta((current) => ({ ...current, [serviceKey]: { ...meta, isActive: event.target.checked } }))} /> Aktiv</label>
                        <span className="text-[#5e747b]">Mitarbeiter für diese Leistung:</span>
                        {editorDraft.staff.map((staff, staffIndex) => {
                          const staffKey = getEntityKey(staff.id, staffIndex, 'staff')
                          const checked = meta.assignedStaffIds.includes(staffKey)
                          return (
                            <label key={`${serviceKey}-${staffKey}`} className="inline-flex items-center gap-1 rounded-full bg-[#f2f7f7] px-2 py-1">
                              <input type="checkbox" checked={checked} onChange={(event) => setDemoServiceMeta((current) => ({
                                ...current,
                                [serviceKey]: {
                                  ...meta,
                                  assignedStaffIds: event.target.checked
                                    ? [...meta.assignedStaffIds, staffKey]
                                    : meta.assignedStaffIds.filter((entry) => entry !== staffKey),
                                },
                              }))} />
                              {staff.displayName || 'Mitarbeiter'}
                            </label>
                          )
                        })}
                        <button type="button" className="text-[#8a3f35]" onClick={() => {
                          updateDraft((draft) => ({ ...draft, services: draft.services.filter((_, i) => i !== index) }))
                          setDemoServiceMeta((current) => {
                            const next = { ...current }
                            delete next[serviceKey]
                            return next
                          })
                        }}>Entfernen</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : null}

            {demoWizardStep === 'MITARBEITER' || demoWizardStep === 'SPEZIALISIERUNGEN' || demoWizardStep === 'ARBEITSZEITEN' ? (
              <div className="space-y-2">
                <button type="button" onClick={addDraftStaff} className="btn-secondary">Mitarbeiter hinzufügen</button>
                {editorDraft.staff.map((staff, index) => {
                  const staffKey = getEntityKey(staff.id, index, 'staff')
                  const meta = demoStaffMeta[staffKey] ?? { staffKey, jobTitle: '', languages: [], isActive: true }
                  const filledItems = [
                    staff.displayName.trim().length > 0,
                    meta.jobTitle.trim().length > 0,
                    (staff.specialization ?? '').trim().length > 0,
                    (staff.biography ?? '').trim().length > 0,
                    staff.serviceIds.length > 0,
                    staff.schedules.some((row) => !row.isDayOff && row.shiftStart && row.shiftEnd),
                    meta.languages.length > 0,
                    (staff.avatarUrl ?? '').trim().length > 0,
                  ].filter(Boolean).length
                  const staffProgress = Math.round((filledItems / 8) * 100)

                  return (
                    <div key={staffKey} className="space-y-2 rounded-xl border border-[#d9e3e5] bg-white p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold text-[#355861]">Mitarbeiter-Profil: {staffProgress}%</div>
                        <label className="inline-flex items-center gap-2 text-xs"><input type="checkbox" checked={meta.isActive} onChange={(event) => setDemoStaffMeta((current) => ({ ...current, [staffKey]: { ...meta, isActive: event.target.checked } }))} /> aktiv</label>
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        <label className="text-xs font-semibold text-[#5e747b]">Name<input className="field-input mt-1" value={staff.displayName} onChange={(event) => updateDraft((draft) => ({ ...draft, staff: draft.staff.map((item, i) => i === index ? { ...item, displayName: event.target.value } : item) }))} /></label>
                        <label className="text-xs font-semibold text-[#5e747b]">Rolle / должность<input className="field-input mt-1" value={meta.jobTitle} onChange={(event) => setDemoStaffMeta((current) => ({ ...current, [staffKey]: { ...meta, jobTitle: event.target.value } }))} /></label>
                        <label className="text-xs font-semibold text-[#5e747b]">Spezialisierung<input className="field-input mt-1" value={staff.specialization ?? ''} onChange={(event) => updateDraft((draft) => ({ ...draft, staff: draft.staff.map((item, i) => i === index ? { ...item, specialization: event.target.value } : item) }))} /></label>
                        <label className="text-xs font-semibold text-[#5e747b]">Sprachen (kommagetrennt)<input className="field-input mt-1" value={meta.languages.join(', ')} onChange={(event) => setDemoStaffMeta((current) => ({ ...current, [staffKey]: { ...meta, languages: parseCsvInput(event.target.value) } }))} /></label>
                        <label className="text-xs font-semibold text-[#5e747b] md:col-span-2">Beschreibung<textarea className="field-input mt-1 min-h-16" value={staff.biography ?? ''} onChange={(event) => updateDraft((draft) => ({ ...draft, staff: draft.staff.map((item, i) => i === index ? { ...item, biography: event.target.value } : item) }))} /></label>
                        <label className="text-xs font-semibold text-[#5e747b]">Foto URL<input className="field-input mt-1" value={staff.avatarUrl ?? ''} onChange={(event) => updateDraft((draft) => ({ ...draft, staff: draft.staff.map((item, i) => i === index ? { ...item, avatarUrl: event.target.value } : item) }))} /></label>
                      </div>

                      <div>
                        <div className="text-xs font-semibold text-[#5e747b]">Leistungen</div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {editorDraft.services.map((service, serviceIndex) => {
                            const serviceKey = getEntityKey(service.id, serviceIndex, 'service')
                            const checked = staff.serviceIds.includes(serviceKey)
                            return (
                              <label key={`${staffKey}-${serviceKey}`} className="inline-flex items-center gap-1 rounded-full bg-[#f2f7f7] px-2 py-1 text-xs">
                                <input type="checkbox" checked={checked} onChange={(event) => updateDraft((draft) => ({
                                  ...draft,
                                  staff: draft.staff.map((item, i) => i === index
                                    ? {
                                        ...item,
                                        serviceIds: event.target.checked
                                          ? [...item.serviceIds, serviceKey]
                                          : item.serviceIds.filter((id) => id !== serviceKey),
                                      }
                                    : item),
                                }))} />
                                {service.name || 'Neue Leistung'}
                              </label>
                            )
                          })}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-semibold text-[#5e747b]">Arbeitszeiten</div>
                        <div className="mt-1 space-y-1">
                          {staff.schedules.map((schedule, scheduleIndex) => (
                            <div key={`${staffKey}-${schedule.dayOfWeek}-${scheduleIndex}`} className="grid gap-2 md:grid-cols-[80px_1fr_1fr_auto_auto]">
                              <span className="flex items-center text-xs">{DAY_LABELS[schedule.dayOfWeek]}</span>
                              <input type="time" className="field-input" value={schedule.shiftStart} onChange={(event) => updateDraft((draft) => ({
                                ...draft,
                                staff: draft.staff.map((item, i) => i === index
                                  ? { ...item, schedules: item.schedules.map((row, rowIdx) => rowIdx === scheduleIndex ? { ...row, shiftStart: event.target.value } : row) }
                                  : item),
                              }))} />
                              <input type="time" className="field-input" value={schedule.shiftEnd} onChange={(event) => updateDraft((draft) => ({
                                ...draft,
                                staff: draft.staff.map((item, i) => i === index
                                  ? { ...item, schedules: item.schedules.map((row, rowIdx) => rowIdx === scheduleIndex ? { ...row, shiftEnd: event.target.value } : row) }
                                  : item),
                              }))} />
                              <label className="inline-flex items-center gap-1 text-xs"><input type="checkbox" checked={schedule.isDayOff ?? false} onChange={(event) => updateDraft((draft) => ({
                                ...draft,
                                staff: draft.staff.map((item, i) => i === index
                                  ? { ...item, schedules: item.schedules.map((row, rowIdx) => rowIdx === scheduleIndex ? { ...row, isDayOff: event.target.checked } : row) }
                                  : item),
                              }))} /> Frei</label>
                              <label className="inline-flex items-center gap-1 text-xs"><input type="checkbox" checked={staff.acceptsHomeVisits ?? false} onChange={(event) => updateDraft((draft) => ({ ...draft, staff: draft.staff.map((item, i) => i === index ? { ...item, acceptsHomeVisits: event.target.checked } : item) }))} /> Hausbesuch</label>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button type="button" className="text-sm font-semibold text-[#8a3f35]" onClick={() => {
                          updateDraft((draft) => ({ ...draft, staff: draft.staff.filter((_, i) => i !== index) }))
                          setDemoStaffMeta((current) => {
                            const next = { ...current }
                            delete next[staffKey]
                            return next
                          })
                        }}>Mitarbeiter entfernen</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : null}

            {demoWizardStep === 'VERFUEGBARKEITEN' ? (
              <div className="space-y-2 rounded-xl border border-[#d9e3e5] bg-white p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5e747b]">Demo Simulation (beeinflusst keine echten Buchungen)</div>
                <div className="grid gap-2 md:grid-cols-2">
                  <label className="text-xs font-semibold text-[#5e747b]">Mitarbeiter als beschäftigt simulieren
                    <select className="field-input mt-1" onChange={(event) => {
                      const id = event.target.value
                      if (!id) return
                      setDemoSimulation((current) => current.busyStaffIds.includes(id)
                        ? current
                        : { ...current, busyStaffIds: [...current.busyStaffIds, id] })
                    }} defaultValue="">
                      <option value="">Mitarbeiter wählen</option>
                      {editorDraft.staff.map((staff, index) => {
                        const staffKey = getEntityKey(staff.id, index, 'staff')
                        return <option key={staffKey} value={staffKey}>{staff.displayName || `Mitarbeiter ${index + 1}`}</option>
                      })}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-[#5e747b]">Pause simulieren
                    <select className="field-input mt-1" onChange={(event) => {
                      const id = event.target.value
                      if (!id) return
                      setDemoSimulation((current) => current.pausedStaffIds.includes(id)
                        ? current
                        : { ...current, pausedStaffIds: [...current.pausedStaffIds, id] })
                    }} defaultValue="">
                      <option value="">Mitarbeiter wählen</option>
                      {editorDraft.staff.map((staff, index) => {
                        const staffKey = getEntityKey(staff.id, index, 'staff')
                        return <option key={`pause-${staffKey}`} value={staffKey}>{staff.displayName || `Mitarbeiter ${index + 1}`}</option>
                      })}
                    </select>
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#5e747b]"><input type="checkbox" checked={demoSimulation.simulateNextFree} onChange={(event) => setDemoSimulation((current) => ({ ...current, simulateNextFree: event.target.checked }))} /> Nächsten freien Termin simulieren</label>
                  <label className="text-xs font-semibold text-[#5e747b]">Nächster freier Termin (Uhrzeit)<input type="time" className="field-input mt-1" value={demoSimulation.nextFreeAt} onChange={(event) => setDemoSimulation((current) => ({ ...current, nextFreeAt: event.target.value }))} /></label>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  {demoSimulation.busyStaffIds.map((id) => (
                    <button key={`busy-${id}`} type="button" className="rounded-full bg-[#fce9e5] px-2 py-1 text-[#8a3f35]" onClick={() => setDemoSimulation((current) => ({ ...current, busyStaffIds: current.busyStaffIds.filter((entry) => entry !== id) }))}>Busy: {id} ×</button>
                  ))}
                  {demoSimulation.pausedStaffIds.map((id) => (
                    <button key={`pause-chip-${id}`} type="button" className="rounded-full bg-[#fff0de] px-2 py-1 text-[#8d552c]" onClick={() => setDemoSimulation((current) => ({ ...current, pausedStaffIds: current.pausedStaffIds.filter((entry) => entry !== id) }))}>Pause: {id} ×</button>
                  ))}
                </div>
              </div>
            ) : null}

            {demoWizardStep === 'ZAHLUNGSARTEN' ? (
              <div className="flex flex-wrap gap-2">
                {EDITOR_PAYMENT_OPTIONS.map((option) => (
                  <label key={option.id} className="inline-flex items-center gap-2 rounded-full border border-[#d6e3e5] bg-white px-3 py-1 text-xs text-[#28444a]">
                    <input type="checkbox" checked={editorDraft.overview.paymentMethods.includes(option.id)} onChange={() => toggleEditorPaymentMethod(option.id)} />
                    {option.label}
                  </label>
                ))}
              </div>
            ) : null}

            {demoWizardStep === 'SPRACHEN_AUSSTATTUNG' ? (
              <div className="grid gap-2 md:grid-cols-2">
                <label className="text-xs font-semibold text-[#5e747b]">Sprachen (kommagetrennt)<input className="field-input mt-1" value={editorDraft.overview.languages.join(', ')} onChange={(event) => updateDraft((draft) => ({ ...draft, overview: { ...draft.overview, languages: parseCsvInput(event.target.value) } }))} /></label>
                <label className="text-xs font-semibold text-[#5e747b]">Ausstattung (kommagetrennt)<input className="field-input mt-1" value={editorDraft.overview.amenities.join(', ')} onChange={(event) => updateDraft((draft) => ({ ...draft, overview: { ...draft.overview, amenities: parseCsvInput(event.target.value) } }))} /></label>
              </div>
            ) : null}

            {demoWizardStep === 'VORSCHAU' ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={`btn-secondary ${demoPreviewView === 'KATALOG' ? 'ring-2 ring-[#17666D]' : ''}`} onClick={() => setDemoPreviewView('KATALOG')}>Katalogansicht</button>
                  <button type="button" className={`btn-secondary ${demoPreviewView === 'SALONSEITE' ? 'ring-2 ring-[#17666D]' : ''}`} onClick={() => setDemoPreviewView('SALONSEITE')}>Salonseite</button>
                  <button type="button" className={`btn-secondary ${demoPreviewViewport === 'MOBILE' ? 'ring-2 ring-[#17666D]' : ''}`} onClick={() => setDemoPreviewViewport('MOBILE')}>Mobile 390 px</button>
                  <button type="button" className={`btn-secondary ${demoPreviewViewport === 'DESKTOP' ? 'ring-2 ring-[#17666D]' : ''}`} onClick={() => setDemoPreviewViewport('DESKTOP')}>Desktop</button>
                </div>
                <div className="rounded-xl bg-[#eef5f6] px-3 py-2 text-xs text-[#355861]">So sieht Ihr Salon für Kundinnen und Kunden aus.</div>
              </div>
            ) : null}

            {demoCompleteness.tips.length > 0 ? (
              <div className="rounded-xl border border-[#e8cfbf] bg-[#fff5ee] px-3 py-2 text-xs text-[#6f4f3d]">
                {demoCompleteness.tips.join(' · ')}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-3 overflow-hidden rounded-[26px] border border-[#d7e3e5] bg-[#edf3f3]">
          {activeCoverUrl ? (
            <img data-testid="salon-cover-image" src={activeCoverUrl} alt={displayOverview?.name || effectiveSalon.name} className="h-56 w-full object-cover sm:h-72" />
          ) : null}
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div
            className={`space-y-3 rounded-2xl ${isEditMode ? 'cursor-pointer border border-dashed border-[#cde1e4] p-3' : ''}`}
            onClick={() => {
              if (isEditMode) setActiveEditorSection('hero')
            }}
          >
            <div className="inline-flex items-center rounded-full bg-[#eaf1f1] px-3 py-1 text-xs font-semibold text-[#184754]">
              {isDemoConstructorMode ? 'Demo-Profil' : 'PickMe Partner'}
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold text-[#112e35]">{displayOverview?.name || effectiveSalon.name}</h1>
                <div className="mt-1 text-sm font-medium text-[#46616a]">{publicBusinessType}</div>
                {salonProfileFlags.labels.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {salonProfileFlags.labels.map((label) => (
                      <span key={label} className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${salonProfileFlags.isDemoProfile ? 'bg-[#fff0de] text-[#8d552c]' : 'bg-[#eef3f4] text-[#4d6970]'}`}>
                        {label}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              {isEditMode ? <span className="rounded-full bg-[#eef5f6] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#547278]">Block bearbeiten</span> : null}
            </div>

            {isDemoConstructorMode ? (
              <div className="rounded-xl border border-[#d9e5e7] bg-[#f8fbfb] px-3 py-2 text-xs text-[#46616a]">
                Dieses Demo-Profil startet bewusst fast leer. Öffnen Sie "Demo bearbeiten" und füllen Sie die Inhalte Schritt für Schritt aus.
              </div>
            ) : null}
            {isDemoConstructorMode ? (
              <div className="rounded-xl border border-[#dce8ea] bg-white px-3 py-2 text-xs text-[#355861]">
                <div className="font-semibold">Profilvollständigkeit: {demoCompleteness.percent}%</div>
                <div className="mt-1">Je vollständiger Sie Ihr Profil ausfüllen, desto professioneller erscheint Ihre PickMe-Vitrine.</div>
              </div>
            ) : null}

            {isEditMode && activeEditorSection === 'hero' && editorDraft ? (
              <div className="grid gap-2 rounded-2xl border border-[#dbe6e8] bg-[#f8fbfb] p-3 md:grid-cols-2">
                <label className="block text-xs font-semibold text-[#5e747b]">Name<input value={editorDraft.overview.name} onChange={(event) => updateDraft((draft) => ({ ...draft, overview: { ...draft.overview, name: event.target.value } }))} className="field-input mt-1" /></label>
                <label className="block text-xs font-semibold text-[#5e747b]">Typ<input value={editorDraft.overview.businessType} onChange={(event) => updateDraft((draft) => ({ ...draft, overview: { ...draft.overview, businessType: event.target.value } }))} className="field-input mt-1" /></label>
                <label className="block text-xs font-semibold text-[#5e747b] md:col-span-2">Kurzpositionierung<input value={editorDraft.overview.tagline} onChange={(event) => updateDraft((draft) => ({ ...draft, overview: { ...draft.overview, tagline: event.target.value } }))} className="field-input mt-1" /></label>
                <label className="block text-xs font-semibold text-[#5e747b] md:col-span-2">Beschreibung<textarea value={editorDraft.overview.description} onChange={(event) => updateDraft((draft) => ({ ...draft, overview: { ...draft.overview, description: event.target.value } }))} className="field-input mt-1 min-h-20" /></label>
                <label className="block text-xs font-semibold text-[#5e747b]">Telefon<input value={editorDraft.overview.phone} onChange={(event) => updateDraft((draft) => ({ ...draft, overview: { ...draft.overview, phone: event.target.value } }))} className="field-input mt-1" /></label>
                <label className="block text-xs font-semibold text-[#5e747b]">E-Mail<input value={editorDraft.overview.email} onChange={(event) => updateDraft((draft) => ({ ...draft, overview: { ...draft.overview, email: event.target.value } }))} className="field-input mt-1" /></label>
                <label className="block text-xs font-semibold text-[#5e747b]">Website<input value={editorDraft.overview.website} onChange={(event) => updateDraft((draft) => ({ ...draft, overview: { ...draft.overview, website: event.target.value } }))} className="field-input mt-1" /></label>
                <label className="block text-xs font-semibold text-[#5e747b]">Seit<input value={editorDraft.overview.foundedYear ?? ''} onChange={(event) => updateDraft((draft) => ({ ...draft, overview: { ...draft.overview, foundedYear: event.target.value ? Number(event.target.value) : null } }))} className="field-input mt-1" /></label>
                <label className="block text-xs font-semibold text-[#5e747b] md:col-span-2">Adresse<input value={editorDraft.overview.addressLine} onChange={(event) => updateDraft((draft) => ({ ...draft, overview: { ...draft.overview, addressLine: event.target.value } }))} className="field-input mt-1" /></label>
                <label className="block text-xs font-semibold text-[#5e747b]">Stadt<input value={editorDraft.overview.city} onChange={(event) => updateDraft((draft) => ({ ...draft, overview: { ...draft.overview, city: event.target.value } }))} className="field-input mt-1" /></label>
                <label className="block text-xs font-semibold text-[#5e747b]">PLZ<input value={editorDraft.overview.postalCode} onChange={(event) => updateDraft((draft) => ({ ...draft, overview: { ...draft.overview, postalCode: event.target.value } }))} className="field-input mt-1" /></label>
                <label className="block text-xs font-semibold text-[#5e747b] md:col-span-2">Öffnungszeiten<input value={editorDraft.overview.openingHoursText} onChange={(event) => updateDraft((draft) => ({ ...draft, overview: { ...draft.overview, openingHoursText: event.target.value } }))} className="field-input mt-1" /></label>
                <label className="block text-xs font-semibold text-[#5e747b]">Sprachen<input value={editorDraft.overview.languages.join(', ')} onChange={(event) => updateDraft((draft) => ({ ...draft, overview: { ...draft.overview, languages: parseCsvInput(event.target.value) } }))} className="field-input mt-1" /></label>
                <label className="block text-xs font-semibold text-[#5e747b]">Amenities<input value={editorDraft.overview.amenities.join(', ')} onChange={(event) => updateDraft((draft) => ({ ...draft, overview: { ...draft.overview, amenities: parseCsvInput(event.target.value) } }))} className="field-input mt-1" /></label>
                <label className="block text-xs font-semibold text-[#5e747b]">Parken<input value={editorDraft.overview.parking} onChange={(event) => updateDraft((draft) => ({ ...draft, overview: { ...draft.overview, parking: event.target.value } }))} className="field-input mt-1" /></label>
                <label className="block text-xs font-semibold text-[#5e747b]">Barrierefreiheit<input value={editorDraft.overview.accessibility} onChange={(event) => updateDraft((draft) => ({ ...draft, overview: { ...draft.overview, accessibility: event.target.value } }))} className="field-input mt-1" /></label>
                <div className="md:col-span-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5e747b]">Zahlungsarten</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {EDITOR_PAYMENT_OPTIONS.map((option) => (
                      <label key={option.id} className="inline-flex items-center gap-2 rounded-full border border-[#d6e3e5] bg-white px-3 py-1 text-xs text-[#28444a]">
                        <input type="checkbox" checked={editorDraft.overview.paymentMethods.includes(option.id)} onChange={() => toggleEditorPaymentMethod(option.id)} />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </div>
                <label className="block text-xs font-semibold text-[#5e747b] md:col-span-2">Terminbestätigung
                  <select
                    value={editorDraft.overview.bookingConfirmationMode ?? 'AUTO'}
                    onChange={(event) =>
                      updateDraft((draft) => ({
                        ...draft,
                        overview: {
                          ...draft.overview,
                          bookingConfirmationMode: event.target.value === 'REQUEST' ? 'REQUEST' : 'AUTO',
                        },
                      }))
                    }
                    className="field-input mt-1"
                  >
                    <option value="AUTO">Automatisch bestätigen</option>
                    <option value="REQUEST">Manuell bestätigen (Anfrage)</option>
                  </select>
                </label>
              </div>
            ) : (
              <p className="text-sm text-[#5c6f74]">{publicHeroTagline}</p>
            )}

            {isPreviewMode ? (
              <div className="rounded-xl border border-[#cde1e4] bg-[#eff6f7] px-3 py-2 text-xs font-semibold text-[#265058]">
                Vorschau-Modus aktiv. Entwurf wird nur intern angezeigt, bis Sie veröffentlichen.
              </div>
            ) : null}

            <div className="grid gap-2 text-sm text-[#2c4046] sm:grid-cols-2">
              <span className="inline-flex items-center gap-1"><MapPin size={14} /> {publicAddressLine}</span>
              <span>Telefon: {publicPhone}</span>
              <span>Öffnungszeiten: {publicOpeningHoursText}</span>
              <span>
                {isDemoConstructorMode
                  ? 'PickMe Bewertung: noch keine verifizierten Bewertungen'
                  : `PickMe Bewertung: ${effectiveSalon.ratingAverage?.toFixed(1) ?? '0.0'} (${effectiveSalon.reviewCount ?? 0})`}
              </span>
              <span>
                Terminmodus: {(displayOverview?.bookingConfirmationMode ?? 'AUTO') === 'REQUEST' ? 'Anfrage mit manueller Bestätigung' : 'Direkte Bestätigung'}
              </span>
            </div>

            {displayOverview?.paymentMethods?.length ? (
              <div className="flex flex-wrap gap-2 text-xs text-[#4a646a]">
                {displayOverview.paymentMethods.map((method) => (
                  <span key={method} className="rounded-full bg-[#f1f6f6] px-3 py-1">{formatPaymentMethodLabel(method)}</span>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 text-xs">
              {displayOverview?.phone || effectiveSalon.phone ? (
                <a href={`tel:${(displayOverview?.phone || effectiveSalon.phone || '').replace(/\s+/g, '')}`} className="btn-secondary inline-flex items-center gap-1" aria-label="Anrufen">
                  <Phone size={14} /> Anrufen
                </a>
              ) : null}
              {displayOverview?.phone || effectiveSalon.phone ? (
                <a
                  href={PRESENTATION_MODE ? `https://wa.me/${(displayOverview?.phone || effectiveSalon.phone || '').replace(/[^\d+]/g, '').replace('+', '')}` : `sms:${(displayOverview?.phone || effectiveSalon.phone || '').replace(/\s+/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary inline-flex items-center gap-1"
                  aria-label={PRESENTATION_MODE ? 'WhatsApp' : 'Nachricht senden'}
                >
                  <MessageCircle size={14} /> WhatsApp
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => navigator.share?.({ title: effectiveSalon.name, url: window.location.href })}
                className="btn-secondary"
              >
                Teilen
              </button>
              <a
                href="#mehr-erfahren"
                className="btn-secondary"
              >
                Mehr erfahren
              </a>
              {!isExternalSalon ? (
                demoCanEdit ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditMode(true)
                      setIsPreviewMode(false)
                      setActiveEditorSection('hero')
                    }}
                    className="btn-primary"
                  >
                    Demo bearbeiten
                  </button>
                ) : (
                  <a href="#jetzt-buchen" className="btn-primary">Jetzt buchen</a>
                )
              ) : null}
            </div>
          </div>

          <div
            className={`grid ${displayPhotos.length > 0 ? 'grid-cols-3' : 'grid-cols-1'} gap-2 rounded-2xl ${isEditMode ? 'cursor-pointer border border-dashed border-[#cde1e4] p-3' : ''}`}
            onClick={() => {
              if (isEditMode) setActiveEditorSection('gallery')
            }}
          >
            {displayPhotos.length > 0 ? (
              displayPhotos.slice(0, 3).map((photo) => (
                <img
                  key={photo.id ?? photo.imageUrl}
                  src={photo.imageUrl}
                  alt={displayOverview?.name || effectiveSalon.name}
                  className="h-28 w-full rounded-2xl object-cover lg:h-full"
                />
              ))
            ) : (
              <div className="rounded-2xl border border-[#d6e3e5] bg-[#f8fbfc] p-4 text-sm text-[#60777d]">
                Galerie wird aktualisiert.
              </div>
            )}

            {isEditMode && activeEditorSection === 'gallery' && editorDraft ? (
              <div className={`${displayPhotos.length > 0 ? 'col-span-3' : ''} space-y-2 rounded-2xl border border-[#dbe6e8] bg-[#f8fbfb] p-3`}>
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5e747b]">Galerie und Cover</div>
                  <button onClick={addDraftPhoto} type="button" className="btn-secondary">Foto hinzufügen</button>
                </div>
                {demoCanEdit ? (
                  <label className="flex items-center gap-2 rounded-xl border border-[#d6e3e5] bg-white px-3 py-2 text-xs font-semibold text-[#36555d]">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="max-w-[210px] text-[11px]"
                      onChange={(event) => {
                        void handleDemoPhotoUpload(event.target.files)
                        event.currentTarget.value = ''
                      }}
                    />
                    Foto hochladen
                  </label>
                ) : null}
                {editorDraft.photos.length === 0 ? <div className="text-xs text-[#5f7378]">Fügen Sie mindestens ein Foto hinzu, um das Profil zu veröffentlichen.</div> : null}
                {editorDraft.googleCoverUrl ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[#eef4f5] px-3 py-2 text-xs text-[#36555d]">
                    <span>Google-Cover verfügbar</span>
                    <button type="button" className="btn-secondary" onClick={restoreGoogleCover}>Google cover verwenden</button>
                  </div>
                ) : null}
                {pendingCoverPhotoId ? (
                  <div className="rounded-xl border border-[#e8cfbf] bg-[#fff5ee] p-3 text-sm text-[#6f4f3d]">
                    <p>Das aktuelle Titelbild hilft Kundinnen und Kunden, den Standort wiederzuerkennen. Möchten Sie wirklich ein eigenes Titelbild verwenden?</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" className="btn-secondary" onClick={() => setPendingCoverPhotoId(null)}>Behalten</button>
                      <button type="button" className="btn-primary" onClick={() => {
                        const nextCover = pendingCoverPhotoId
                        setPendingCoverPhotoId(null)
                        if (!nextCover) return
                        updateDraft((draft) => ({ ...draft, coverPhotoId: nextCover }))
                      }}>Eigenes Titelbild verwenden</button>
                    </div>
                  </div>
                ) : null}
                {editorDraft.photos.map((photo, index) => (
                  <div key={`${photo.id ?? 'new'}-${index}`} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
                    <input value={photo.imageUrl} onChange={(event) => updateDraft((draft) => ({ ...draft, photos: draft.photos.map((item, itemIndex) => itemIndex === index ? { ...item, imageUrl: event.target.value } : item) }))} className="field-input" placeholder="https://..." />
                    <button type="button" className="btn-secondary" onClick={() => selectCoverPhoto(photo.id ?? photo.imageUrl)}>{editorDraft.coverPhotoId === (photo.id ?? photo.imageUrl) ? 'Aktuelle Cover' : 'Als Cover'}</button>
                    <button type="button" className="btn-secondary" onClick={() => updateDraft((draft) => ({ ...draft, photos: draft.photos.filter((_, itemIndex) => itemIndex !== index) }))}>Entfernen</button>
                    <button type="button" className="btn-secondary" onClick={() => updateDraft((draft) => {
                      if (index === 0) return draft
                      const photos = [...draft.photos]
                      const current = photos[index]
                      photos[index] = photos[index - 1]
                      photos[index - 1] = current
                      return { ...draft, photos }
                    })}>Nach oben</button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {isExternalSalon ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Dieser Salon ist extern gelistet. PickMe zeigt nur verifizierte Basisdaten, ohne externe Bewertungsblöcke.
        </section>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <section id="jetzt-buchen" className="rounded-3xl border border-[#d8e3e4] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#14353e]">Jetzt buchen</h2>
              {contentServices.length > SERVICE_SEARCH_THRESHOLD ? (
                <input
                  value={serviceSearch}
                  onChange={(event) => setServiceSearch(event.target.value)}
                  placeholder="Leistung suchen"
                  className="field-input max-w-44"
                />
              ) : null}
            </div>

            <p className="mt-2 text-sm text-[#5f7378]">Alle Leistungen, Varianten und Preise werden in diesem einen Booking Flow verwaltet.</p>

            {isEditMode && activeEditorSection === 'services' && editorDraft ? (
              <div className="mt-3 space-y-3 rounded-2xl border border-[#dbe6e8] bg-[#f8fbfb] p-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5e747b]">Leistungen, Preise und Dauer</div>
                  <button onClick={addDraftService} type="button" className="btn-secondary">Leistung hinzufügen</button>
                </div>
                {editorDraft.services.map((service, index) => (
                  <div key={`${service.id ?? 'new'}-${index}`} className="grid gap-2 rounded-2xl border border-[#d9e3e5] bg-white p-3 md:grid-cols-2">
                    <label className="block text-xs font-semibold text-[#5e747b]">Name<input value={service.name} onChange={(event) => updateDraft((draft) => ({ ...draft, services: draft.services.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) }))} className="field-input mt-1" /></label>
                    <label className="block text-xs font-semibold text-[#5e747b]">Kategorie<input value={service.category} onChange={(event) => updateDraft((draft) => ({ ...draft, services: draft.services.map((item, itemIndex) => itemIndex === index ? { ...item, category: event.target.value } : item) }))} className="field-input mt-1" /></label>
                    <label className="block text-xs font-semibold text-[#5e747b]">Preis<input type="number" value={service.basePrice} onChange={(event) => updateDraft((draft) => ({ ...draft, services: draft.services.map((item, itemIndex) => itemIndex === index ? { ...item, basePrice: Number(event.target.value) } : item) }))} className="field-input mt-1" /></label>
                    <label className="block text-xs font-semibold text-[#5e747b]">Dauer<input type="number" value={service.durationMinutes} onChange={(event) => updateDraft((draft) => ({ ...draft, services: draft.services.map((item, itemIndex) => itemIndex === index ? { ...item, durationMinutes: Number(event.target.value) } : item) }))} className="field-input mt-1" /></label>
                    <label className="block text-xs font-semibold text-[#5e747b] md:col-span-2">Beschreibung<textarea value={service.description ?? ''} onChange={(event) => updateDraft((draft) => ({ ...draft, services: draft.services.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item) }))} className="field-input mt-1 min-h-16" /></label>
                    <div className="md:col-span-2 flex flex-wrap gap-3 text-xs text-[#36555d]">
                      <label className="inline-flex items-center gap-2"><input type="checkbox" checked={service.availableInSalon ?? true} onChange={(event) => updateDraft((draft) => ({ ...draft, services: draft.services.map((item, itemIndex) => itemIndex === index ? { ...item, availableInSalon: event.target.checked } : item) }))} /> Im Salon</label>
                      <label className="inline-flex items-center gap-2"><input type="checkbox" checked={service.availableAtHome ?? false} onChange={(event) => updateDraft((draft) => ({ ...draft, services: draft.services.map((item, itemIndex) => itemIndex === index ? { ...item, availableAtHome: event.target.checked } : item) }))} /> Hausbesuch</label>
                      <button type="button" className="text-[#8a3f35]" onClick={() => updateDraft((draft) => ({ ...draft, services: draft.services.filter((_, itemIndex) => itemIndex !== index) }))}>Entfernen</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-3 space-y-2">
              {groupedContentServices.map((group) => {
                const isOpen = openedCategory === group.category
                return (
                  <div key={group.category} className={`rounded-2xl border border-[#dbe6e8] ${isEditMode ? 'cursor-pointer' : ''}`} onClick={() => { if (isEditMode) setActiveEditorSection('services') }}>
                    <button
                      type="button"
                      onClick={() => setOpenedCategory(isOpen ? null : group.category)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left"
                    >
                      <span className="font-semibold text-[#1d3941]">{group.category}</span>
                      {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>

                    {isOpen ? (
                      <div className="space-y-1 border-t border-[#e5edef] px-2 py-2">
                        {group.services.map((service) => {
                          const selected = service.id ? selectedItems.some((item) => item.serviceId === service.id) : false
                          const bookingDisabled = isPreviewMode || !service.id
                          return (
                            <div key={service.id} className="grid grid-cols-[minmax(0,1fr)_80px_66px_auto] items-center gap-2 rounded-xl px-2 py-2 hover:bg-[#f8fbfb]">
                              <div>
                                <div className="font-medium text-[#1f353b]">{service.name}</div>
                              </div>
                              <div className="text-sm text-[#556c72]">{service.durationMinutes} Min.</div>
                              <div className="text-sm font-semibold text-[#1e3a42]">{formatCurrency(service.basePrice)}</div>
                              <button
                                type="button"
                                disabled={selected || bookingDisabled}
                                onClick={() => {
                                  if (!service.id) return
                                  setSelectedItems([...selectedItems, { serviceId: service.id, quantity: 1, modifierOptionIds: [] }])
                                  setActiveServiceForAddons(service.id)
                                }}
                                className={`rounded-lg px-2 py-1 text-xs font-semibold ${selected ? 'bg-[#dce9eb] text-[#325860]' : 'bg-[#ebf3f3] text-[#153941]'}`}
                              >
                                {bookingDisabled ? 'Nach Veröffentlichung' : selected ? 'Ausgewählt' : 'Hinzufügen'}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </section>

          <section className="rounded-3xl border border-[#d8e3e4] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#14353e]">Heute verfügbar</h2>
              <span className="text-xs font-semibold text-[#547278]">Automatisch aus Zeitplan berechnet</span>
            </div>
            {demoCanEdit ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-xl bg-[#f2f7f7] px-3 py-2 text-xs text-[#355861]">Heute im Einsatz: <span className="font-semibold">{demoLiveSummary.heuteImEinsatz}</span></div>
                <div className="rounded-xl bg-[#edf6f1] px-3 py-2 text-xs text-[#2f8b5d]">Jetzt verfügbar: <span className="font-semibold">{demoLiveSummary.jetztVerfuegbar}</span></div>
                <div className="rounded-xl bg-[#fff5e8] px-3 py-2 text-xs text-[#8d552c]">In Kürze verfügbar: <span className="font-semibold">{demoLiveSummary.inKuerzeVerfuegbar}</span></div>
                <div className="rounded-xl bg-[#fdeeee] px-3 py-2 text-xs text-[#8a3f35]">Ausgebucht: <span className="font-semibold">{demoLiveSummary.ausgebucht}</span></div>
                <div className="rounded-xl bg-[#f2f7f7] px-3 py-2 text-xs text-[#355861]">Nächster freier Termin: <span className="font-semibold">{demoLiveSummary.naechsterFreierTermin ?? 'Noch nicht berechenbar'}</span></div>
              </div>
            ) : null}
            {demoCanEdit && demoLiveSummary.hasIncompleteData ? (
              <div className="mt-2 rounded-xl border border-[#e8cfbf] bg-[#fff5ee] px-3 py-2 text-xs text-[#6f4f3d]">
                Incomplete state: Für verlässliche Live-Status fügen Sie Leistungen, Mitarbeiter und Arbeitszeiten hinzu.
              </div>
            ) : null}
            {isEditMode && activeEditorSection === 'staff' && editorDraft ? (
              <div className="mt-3 space-y-3 rounded-2xl border border-[#dbe6e8] bg-[#f8fbfb] p-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5e747b]">Mitarbeiter und Zeitplan</div>
                  <button onClick={addDraftStaff} type="button" className="btn-secondary">Mitarbeiter hinzufügen</button>
                </div>
                {editorDraft.staff.map((staff, index) => (
                  <div key={`${staff.id ?? 'new'}-${index}`} className="space-y-3 rounded-2xl border border-[#d9e3e5] bg-white p-3">
                    <div className="grid gap-2 md:grid-cols-2">
                      <label className="block text-xs font-semibold text-[#5e747b]">Name<input value={staff.displayName} onChange={(event) => updateDraft((draft) => ({ ...draft, staff: draft.staff.map((item, itemIndex) => itemIndex === index ? { ...item, displayName: event.target.value } : item) }))} className="field-input mt-1" /></label>
                      <label className="block text-xs font-semibold text-[#5e747b]">Spezialisierung<input value={staff.specialization ?? ''} onChange={(event) => updateDraft((draft) => ({ ...draft, staff: draft.staff.map((item, itemIndex) => itemIndex === index ? { ...item, specialization: event.target.value } : item) }))} className="field-input mt-1" /></label>
                      <label className="block text-xs font-semibold text-[#5e747b]">Avatar URL<input value={staff.avatarUrl ?? ''} onChange={(event) => updateDraft((draft) => ({ ...draft, staff: draft.staff.map((item, itemIndex) => itemIndex === index ? { ...item, avatarUrl: event.target.value } : item) }))} className="field-input mt-1" /></label>
                      <label className="block text-xs font-semibold text-[#5e747b]">Erfahrung<input type="number" value={staff.experienceYears ?? 0} onChange={(event) => updateDraft((draft) => ({ ...draft, staff: draft.staff.map((item, itemIndex) => itemIndex === index ? { ...item, experienceYears: Number(event.target.value) } : item) }))} className="field-input mt-1" /></label>
                      <label className="block text-xs font-semibold text-[#5e747b] md:col-span-2">Biografie<textarea value={staff.biography ?? ''} onChange={(event) => updateDraft((draft) => ({ ...draft, staff: draft.staff.map((item, itemIndex) => itemIndex === index ? { ...item, biography: event.target.value } : item) }))} className="field-input mt-1 min-h-16" /></label>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5e747b]">Leistungen</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {editorDraft.services.map((service) => (
                          <label key={`${staff.id ?? 'staff'}-${service.id ?? service.name}`} className="inline-flex items-center gap-2 rounded-full border border-[#d6e3e5] bg-[#f8fbfb] px-3 py-1 text-xs text-[#28444a]">
                            <input type="checkbox" checked={staff.serviceIds.includes(service.id ?? service.name)} onChange={(event) => updateDraft((draft) => ({
                              ...draft,
                              staff: draft.staff.map((item, itemIndex) => itemIndex === index
                                ? {
                                    ...item,
                                    serviceIds: event.target.checked
                                      ? [...item.serviceIds, service.id ?? service.name]
                                      : item.serviceIds.filter((entry) => entry !== (service.id ?? service.name)),
                                  }
                                : item),
                            }))} />
                            {service.name || 'Neue Leistung'}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5e747b]">Zeitplan</div>
                      {staff.schedules.map((schedule, scheduleIndex) => (
                        <div key={`${staff.id ?? 'new'}-${schedule.dayOfWeek}-${scheduleIndex}`} className="grid gap-2 md:grid-cols-[80px_1fr_1fr_auto]">
                          <div className="flex items-center text-xs font-semibold text-[#46616a]">{DAY_LABELS[schedule.dayOfWeek]}</div>
                          <input type="time" value={schedule.shiftStart} onChange={(event) => updateDraft((draft) => ({
                            ...draft,
                            staff: draft.staff.map((item, itemIndex) => itemIndex === index ? {
                              ...item,
                              schedules: item.schedules.map((row, rowIndex) => rowIndex === scheduleIndex ? { ...row, shiftStart: event.target.value } : row),
                            } : item),
                          }))} className="field-input" />
                          <input type="time" value={schedule.shiftEnd} onChange={(event) => updateDraft((draft) => ({
                            ...draft,
                            staff: draft.staff.map((item, itemIndex) => itemIndex === index ? {
                              ...item,
                              schedules: item.schedules.map((row, rowIndex) => rowIndex === scheduleIndex ? { ...row, shiftEnd: event.target.value } : row),
                            } : item),
                          }))} className="field-input" />
                          <label className="inline-flex items-center gap-2 text-xs text-[#36555d]"><input type="checkbox" checked={schedule.isDayOff ?? false} onChange={(event) => updateDraft((draft) => ({
                            ...draft,
                            staff: draft.staff.map((item, itemIndex) => itemIndex === index ? {
                              ...item,
                              schedules: item.schedules.map((row, rowIndex) => rowIndex === scheduleIndex ? { ...row, isDayOff: event.target.checked } : row),
                            } : item),
                          }))} /> Frei</label>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end">
                      <button type="button" className="text-sm font-semibold text-[#8a3f35]" onClick={() => updateDraft((draft) => ({ ...draft, staff: draft.staff.filter((_, itemIndex) => itemIndex !== index) }))}>Mitarbeiter entfernen</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="mt-3 space-y-2">
              {contentMasters.map((member, memberIndex) => {
                const nextSlot = masterNextSlotById.get(member.id)
                const memberKey = getEntityKey(member.id, memberIndex, 'staff')
                const isBusy = demoBusySet.has(memberKey)
                const isPaused = demoPauseSet.has(memberKey)
                const statusLabel = demoCanEdit
                  ? (isBusy ? 'Ausgebucht' : isPaused ? 'In Kürze verfügbar' : 'Verfügbar')
                  : getMasterStatusLabel(member)
                const statusClass = demoCanEdit
                  ? (isBusy ? 'text-[#C95C4B]' : isPaused ? 'text-[#B97620]' : 'text-[#2F8B5D]')
                  : getMasterStatusClass(member)
                return (
                  <div key={member.id} className={`flex items-center justify-between rounded-2xl border border-[#e0eaec] px-3 py-2 ${isEditMode ? 'cursor-pointer' : ''}`} onClick={() => { if (isEditMode) setActiveEditorSection('staff') }}>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-[#e9f1f2]" />
                      <div>
                        <div className="font-semibold text-[#1b3338]">{member.displayName}</div>
                        <div className="text-xs text-[#5e747a]">{member.specialization || 'Salon-Spezialist'}</div>
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <div className={`font-semibold ${statusClass}`}>{statusLabel}</div>
                      <div className="text-[#5f7378]">{demoCanEdit ? (demoLiveSummary.naechsterFreierTermin ? `Nächster Termin ${demoLiveSummary.naechsterFreierTermin}` : 'Kein Slot heute') : (nextSlot ? `Nächster Termin ${formatSlotDateTime(nextSlot)}` : 'Kein Slot heute')}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {!isExternalSalon ? (
            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="grid grid-cols-6 gap-2 text-[11px] font-semibold text-slate-500">
                {['Service', 'Mitarbeiter', 'Datum', 'Uhrzeit', 'Zahlungsart', 'Bestätigung'].map((label, index) => {
                  const active = step >= index + 1
                  return (
                    <div key={label} className={`rounded-full px-3 py-2 text-center ${active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {index + 1}. {label}
                    </div>
                  )
                })}
              </div>

              {step === 1 ? (
                <div className="mt-4 space-y-3">
                  <h2 className="text-base font-semibold text-slate-900">Service wählen</h2>

                  <div className="rounded-2xl border border-[#dbe8ea] bg-[#f7fbfb] p-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[#60777d]">Ausgewählte Leistungen</div>
                    {selectedItems.length === 0 ? <p className="mt-2 text-sm text-[#5f7378]">Wählen Sie mindestens eine Leistung aus dem Katalog oben.</p> : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedItems.map((item) => {
                        const service = effectiveServices.find((serviceItem) => serviceItem.id === item.serviceId)
                        return (
                          <button
                            key={item.serviceId}
                            type="button"
                            onClick={() => setActiveServiceForAddons(item.serviceId)}
                            className={`rounded-xl border px-3 py-1.5 text-xs ${activeServiceForAddons === item.serviceId ? 'border-[#17666D] bg-[#edf5f5] text-[#10313a]' : 'border-slate-200 bg-white text-slate-700'}`}
                          >
                            {service?.name ?? 'Service'}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {selectedServiceForAddons ? (
                    <div className="rounded-2xl border border-[#dbe8ea] p-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[#60777d]">Beliebte Add-ons</div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {BOOKING_MODIFIER_OPTIONS.map((option) => {
                          const count = getModifierCount(selectedServiceForAddons.modifierOptionIds, option.id)
                          return (
                            <div key={option.id} className="rounded-xl border border-slate-200 px-3 py-2">
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <div className="text-sm font-semibold text-[#19363d]">{option.label}</div>
                                  <div className="text-xs text-[#5c7278]">+{formatCurrency(option.extraPrice)} {option.extraDurationMinutes > 0 ? `· +${option.extraDurationMinutes} Min.` : ''}</div>
                                </div>
                                {option.repeatable ? (
                                  <div className="flex items-center gap-1">
                                    <button type="button" onClick={() => updateModifierCount(option.id, count - 1)} className="rounded-lg border border-slate-300 px-2 py-1 text-xs">-</button>
                                    <span className="min-w-14 text-center text-xs font-semibold">{count} {option.unit}</span>
                                    <button type="button" onClick={() => updateModifierCount(option.id, count + 1)} className="rounded-lg border border-slate-300 px-2 py-1 text-xs">+</button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => updateModifierCount(option.id, count > 0 ? 0 : 1)}
                                    className={`rounded-lg px-2 py-1 text-xs font-semibold ${count > 0 ? 'bg-[#deecee] text-[#14424a]' : 'bg-[#edf3f4] text-[#4a646a]'}`}
                                  >
                                    {count > 0 ? 'Ausgewählt' : 'Hinzufügen'}
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}

                  <label className="block">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#60777d]">Zusätzlicher Wunsch (optional)</span>
                    <textarea
                      value={additionalWish}
                      onChange={(event) => setAdditionalWish(event.target.value.slice(0, 280))}
                      className="field-input mt-1 min-h-16"
                      placeholder="z. B. besondere Wünsche"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      if (selectedItems.length === 0) return
                      setSelectedMasterId(ANY_MASTER_VALUE)
                      setSelectedSlot(null)
                      setStep(2)
                    }}
                    disabled={selectedItems.length === 0}
                    className="btn-primary disabled:opacity-50"
                  >
                    Weiter zu Mitarbeiter
                  </button>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-base font-semibold text-slate-900">Mitarbeiter wählen</h2>
                    <button onClick={() => setStep(1)} className="text-sm font-semibold text-slate-600">Zurück</button>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedMasterId(ANY_MASTER_VALUE)
                      setSelectedSlot(null)
                      setStep(3)
                    }}
                    className="w-full rounded-2xl border border-brand-200 bg-brand-50 p-3 text-left"
                  >
                    <div className="font-semibold text-brand-800">Beliebiger verfügbarer Mitarbeiter</div>
                    <div className="text-xs text-brand-700">PickMe wählt den ersten verfügbaren Profi für die gewählte Dauer.</div>
                  </button>

                  {effectiveMasters.map((master) => (
                    <button
                      key={master.id}
                      onClick={() => {
                        setSelectedMasterId(master.id)
                        setSelectedSlot(null)
                        setStep(3)
                      }}
                      className="w-full rounded-2xl border border-slate-200 p-3 text-left"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-semibold text-slate-900">{master.displayName}</div>
                          <div className="text-xs text-slate-500">{master.specialization || 'Salon-Meister'}</div>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{getMasterStatusLabel(master)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}

              {step === 3 ? (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-base font-semibold text-slate-900">Datum wählen</h2>
                    <button onClick={() => setStep(2)} className="text-sm font-semibold text-slate-600">Zurück</button>
                  </div>

                  <label className="block rounded-2xl border border-slate-200 p-3">
                    <span className="mb-1 inline-flex items-center gap-2 text-sm font-semibold text-slate-800"><CalendarDays size={14} /> Termindatum</span>
                    <input
                      type="date"
                      min={getTodayDateInput()}
                      value={selectedDate}
                      onChange={(event) => {
                        setSelectedDate(event.target.value)
                        setSelectedSlot(null)
                      }}
                      className="field-input"
                    />
                  </label>

                  <button onClick={() => setStep(4)} className="btn-primary">Verfügbare Zeiten anzeigen</button>
                </div>
              ) : null}

              {step === 4 ? (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-base font-semibold text-slate-900">Uhrzeit wählen</h2>
                    <button onClick={() => setStep(3)} className="text-sm font-semibold text-slate-600">Zurück</button>
                  </div>

                  {slotsQuery.isPending ? <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">Zeitfenster werden geladen...</div> : null}
                  {slotsError ? <div className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">{slotsError.message || 'Zeitfenster konnten nicht geladen werden.'}</div> : null}

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {slots.map((slot) => (
                      <button
                        key={slot.startsAt}
                        onClick={() => {
                          setSelectedSlot(slot.startsAt)
                          setStep(5)
                        }}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-left text-sm font-semibold text-slate-800"
                      >
                        <div className="inline-flex items-center gap-1"><Clock3 size={14} /> {formatSlotDateTime(slot.startsAt)}</div>
                        <div className="mt-1 text-[11px] font-medium text-slate-500">{slot.availableMasterIds.length} verfügbar</div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {step === 5 ? (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-base font-semibold text-slate-900">Zahlungsart wählen</h2>
                    <button onClick={() => setStep(4)} className="text-sm font-semibold text-slate-600">Zurück</button>
                  </div>

                  <div className="grid gap-2">
                    {availablePaymentMethods.map((paymentOption) => (
                      <button
                        key={paymentOption}
                        onClick={() => setPaymentMethod(paymentOption as PaymentMethod)}
                        className={`w-full rounded-2xl border px-3 py-2 text-left text-sm font-semibold ${
                          paymentMethod === paymentOption ? 'border-[#17666D] bg-[#ebf3f3] text-[#10313a]' : 'border-slate-200 text-slate-700'
                        }`}
                        type="button"
                      >
                        <span className="inline-flex items-center gap-2"><CreditCard size={14} /> {formatPaymentMethodLabel(paymentOption)}</span>
                      </button>
                    ))}
                  </div>

                  {!paymentMethod ? (
                    <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">Bitte wählen Sie eine Zahlungsart, um fortzufahren.</div>
                  ) : null}

                  <button onClick={() => setStep(6)} disabled={!paymentMethod} className="btn-primary disabled:opacity-50">Weiter</button>
                </div>
              ) : null}

              {step === 6 ? (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-base font-semibold text-slate-900">Bestätigung</h2>
                    <button onClick={() => setStep(5)} className="text-sm font-semibold text-slate-600">Zurück</button>
                  </div>

                  <div className="space-y-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Termin</div>
                      <div className="mt-1 inline-flex items-center gap-2"><UserRound size={14} /> Mitarbeiter: {selectedMaster?.displayName ?? 'Beliebiger verfügbarer Mitarbeiter'}</div>
                      <div className="inline-flex items-center gap-2"><CalendarDays size={14} /> Datum: {selectedDate}</div>
                      <div className="inline-flex items-center gap-2"><Clock3 size={14} /> Zeit: {bookingDateTimeLabel}</div>
                      <div>Dauer: {totalDurationMinutes || '-'} Min.</div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Kosten</div>
                      <div>Zwischensumme: {formatCurrency(baseServicesPrice + optionalExtrasPrice)}</div>
                      <div>PickMe-Servicegebühr: {formatCurrency(serviceFee)}</div>
                      <div>Heute online: {formatCurrency(amountOnline)}</div>
                      <div>Vor Ort zu zahlen: {formatCurrency(amountAtSalon)}</div>
                      <div className="font-semibold">Gesamt: {formatCurrency(totalPrice)}</div>
                      <div className="text-xs text-[#5f7378]">PickMe-Service: Im Partner-Abo enthalten</div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Zahlung</div>
                      <div>{paymentMethodLabel}</div>
                    </div>

                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Kommentar</span>
                      <textarea
                        value={clientComment}
                        onChange={(event) => setClientComment(event.target.value)}
                        className="field-input min-h-20"
                        placeholder="Wünsche zum Termin"
                      />
                    </label>

                    <div className="inline-flex items-center gap-2 text-xs text-[#5f7378]"><ShieldCheck size={14} /> Änderungen und Stornierungen werden dokumentiert.</div>
                  </div>

                  {createBookingError ? (
                    <div className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">
                      {createBookingError.code === 'BOOKING_SLOT_CONFLICT'
                        ? 'Zeitfenster bereits belegt. Bitte wählen Sie eine andere Uhrzeit.'
                        : createBookingError.message || 'Termin konnte nicht erstellt werden.'}
                    </div>
                  ) : null}

                  <button
                    onClick={() => {
                      void handleConfirmBooking()
                    }}
                    disabled={!effectiveSelectedServiceId || !selectedSlot || !paymentMethod || createBookingMutation.isPending}
                    className="btn-primary w-full disabled:opacity-60"
                  >
                    {createBookingMutation.isPending ? 'Termin wird erstellt...' : 'Termin bestätigen'}
                  </button>
                </div>
              ) : null}

              {step === 7 ? (
                <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-emerald-800">
                  <div className="inline-flex items-center gap-2 text-base font-semibold"><CheckCircle2 size={18} /> {confirmedBookingStatus === 'confirmed' ? 'Ihr Termin ist bestätigt.' : 'Ihre Terminanfrage wurde gesendet und wartet auf Bestätigung.'}</div>
                  <div className="mt-2 space-y-1 text-sm">
                    <p>Buchungscode: {bookingNumber || buildPresentationBookingNumber()}</p>
                    <p>Salon: {effectiveSalon.name}</p>
                    <p>Adresse: {effectiveSalon.addressLine || `${effectiveSalon.city}, ${effectiveSalon.postalCode}`}</p>
                    <p>Datum und Uhrzeit: {bookingDateTimeLabel}</p>
                    <p>Mitarbeiter: {selectedMaster?.displayName ?? 'Beliebiger verfügbarer Mitarbeiter'}</p>
                    <p>Leistungen: {quoteQuery.data?.items.map((item) => item.serviceName).join(', ') || '-'}</p>
                    <p>Dauer: {totalDurationMinutes || '-'} Min.</p>
                    <p>Gesamtpreis: {formatCurrency(totalPrice)}</p>
                    <p>Zahlungsart: {paymentMethodLabel}</p>
                    <p>Stornierungsregeln: Änderungen bis 24h vorher möglich, danach gemäß Salonrichtlinie.</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Termin bei ${effectiveSalon.name}`)}&details=${encodeURIComponent(`Buchung ${bookingNumber ?? ''}`)}`} target="_blank" rel="noreferrer" className="btn-secondary">Zum Kalender hinzufügen</a>
                    <button onClick={() => setStep(3)} className="btn-secondary" type="button">Termin ändern</button>
                    <button onClick={() => setStep(1)} className="btn-secondary" type="button">Termin stornieren</button>
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(effectiveSalon.addressLine || `${effectiveSalon.city} ${effectiveSalon.postalCode}`)}`} target="_blank" rel="noreferrer" className="btn-secondary">Route anzeigen</a>
                    {effectiveSalon.phone ? <a href={`tel:${effectiveSalon.phone.replace(/\s+/g, '')}`} className="btn-secondary">Salon anrufen</a> : null}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          <section id="mehr-erfahren" className="rounded-3xl border border-[#dce6e8] bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-[#14353e]">Mehr erfahren</h2>
            {isEditMode && activeEditorSection === 'moreInfo' && editorDraft ? (
              <div className="mt-3 grid gap-2 rounded-2xl border border-[#dbe6e8] bg-[#f8fbfb] p-3">
                <label className="block text-xs font-semibold text-[#5e747b]">Über uns<textarea value={editorDraft.moreInfo.about} onChange={(event) => updateDraft((draft) => ({ ...draft, moreInfo: { ...draft.moreInfo, about: event.target.value } }))} className="field-input mt-1 min-h-20" /></label>
                <label className="block text-xs font-semibold text-[#5e747b]">Geschichte<textarea value={editorDraft.moreInfo.history} onChange={(event) => updateDraft((draft) => ({ ...draft, moreInfo: { ...draft.moreInfo, history: event.target.value } }))} className="field-input mt-1 min-h-20" /></label>
                <label className="block text-xs font-semibold text-[#5e747b]">Leistungsrichtungen<input value={editorDraft.moreInfo.serviceDirections.join(', ')} onChange={(event) => updateDraft((draft) => ({ ...draft, moreInfo: { ...draft.moreInfo, serviceDirections: parseCsvInput(event.target.value) } }))} className="field-input mt-1" /></label>
                <label className="block text-xs font-semibold text-[#5e747b]">Regeln<input value={editorDraft.moreInfo.rules.join(', ')} onChange={(event) => updateDraft((draft) => ({ ...draft, moreInfo: { ...draft.moreInfo, rules: parseCsvInput(event.target.value) } }))} className="field-input mt-1" /></label>
                <label className="block text-xs font-semibold text-[#5e747b]">Team-Hinweis<textarea value={editorDraft.moreInfo.teamNote} onChange={(event) => updateDraft((draft) => ({ ...draft, moreInfo: { ...draft.moreInfo, teamNote: event.target.value } }))} className="field-input mt-1 min-h-16" /></label>
              </div>
            ) : null}
            <div className={`mt-3 grid gap-2 text-sm md:grid-cols-2 ${isEditMode ? 'cursor-pointer' : ''}`} onClick={() => { if (isEditMode) setActiveEditorSection('moreInfo') }}>
              <div className="rounded-xl bg-[#f8fbfb] px-3 py-2">Über uns: {displayMoreInfo?.about || publicHeroTagline}</div>
              <div className="rounded-xl bg-[#f8fbfb] px-3 py-2">Seit: {displayOverview?.foundedYear || 2019}</div>
              <div className="rounded-xl bg-[#f8fbfb] px-3 py-2">Sprachen: {displayOverview?.languages?.join(', ') || 'Nicht angegeben'}</div>
              <div className="rounded-xl bg-[#f8fbfb] px-3 py-2">Zahlung: {displayOverview?.paymentMethods?.map(formatPaymentMethodLabel).join(', ') || 'Vor Ort bezahlen'}</div>
              <div className="rounded-xl bg-[#f8fbfb] px-3 py-2">Parken: {displayOverview?.parking || 'Nach Verfügbarkeit'}</div>
              <div className="rounded-xl bg-[#f8fbfb] px-3 py-2">Barrierefreiheit: {displayOverview?.accessibility || 'Nicht angegeben'}</div>
              <div className="rounded-xl bg-[#f8fbfb] px-3 py-2">Leistungsrichtungen: {displayMoreInfo?.serviceDirections?.join(', ') || 'Nicht angegeben'}</div>
              <div className="rounded-xl bg-[#f8fbfb] px-3 py-2">Regeln: {displayMoreInfo?.rules?.join(', ') || 'Keine zusätzlichen Regeln'}</div>
            </div>

            <div className="mt-4 rounded-2xl border border-[#dce8ea] bg-[#f8fbfc] p-3 text-sm text-[#37525a]">
              {effectiveSalon.reviewCount && effectiveSalon.reviewCount > 0
                ? `PickMe Bewertung: ${effectiveSalon.ratingAverage?.toFixed(1) ?? '0.0'} · ${effectiveSalon.reviewCount} verifizierte Bewertungen`
                : 'Noch keine verifizierten PickMe-Bewertungen'}
            </div>
          </section>

          <section className="rounded-3xl border border-[#dce6e8] bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-[#14353e]">PickMe Vertrauen</h2>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <article className="rounded-xl border border-[#dce8ea] bg-[#f8fbfc] p-3">
                <div className="font-semibold text-[#163740]">Verifizierte PickMe-Bewertungen</div>
                <p className="mt-1 text-xs text-[#5f7378]">Nur Kundinnen und Kunden mit abgeschlossenem Termin können bewerten.</p>
              </article>
              <article className="rounded-xl border border-[#dce8ea] bg-[#f8fbfc] p-3">
                <div className="font-semibold text-[#163740]">Transparente Terminbestätigung</div>
                <p className="mt-1 text-xs text-[#5f7378]">Sie sehen sofort, ob Ihr Termin bestätigt oder angefragt ist.</p>
              </article>
              <article className="rounded-xl border border-[#dce8ea] bg-[#f8fbfc] p-3">
                <div className="font-semibold text-[#163740]">Sichere Buchungsverwaltung</div>
                <p className="mt-1 text-xs text-[#5f7378]">Änderungen und Stornierungen werden für beide Seiten dokumentiert.</p>
              </article>
            </div>
          </section>
        </div>

        <aside className="xl:sticky xl:top-4 xl:h-fit">
          <section className="rounded-3xl border border-[#d6e3e5] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#173a42]">Auswahl</h3>
              <span className="rounded-full bg-[#eaf3f3] px-2 py-0.5 text-xs font-semibold text-[#1a525a]">{selectedItems.length} Leistungen</span>
            </div>

            {selectedItems.length === 0 ? <p className="mt-2 text-xs text-[#5f7378]">Noch keine Leistungen gewählt.</p> : null}
            <div className="mt-2 space-y-1.5">
              {selectedItems.map((item) => {
                const service = effectiveServices.find((serviceItem) => serviceItem.id === item.serviceId)
                const extraCount = item.modifierOptionIds.length
                return (
                  <div key={item.serviceId} className="rounded-lg bg-[#f7fbfb] px-2 py-2 text-xs text-[#2f464d]">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold">{service?.name ?? 'Service'}</div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedItems(selectedItems.filter((entry) => entry.serviceId !== item.serviceId))
                          if (activeServiceForAddons === item.serviceId) {
                            setActiveServiceForAddons(selectedItems.find((entry) => entry.serviceId !== item.serviceId)?.serviceId ?? null)
                          }
                        }}
                        className="text-[11px] font-semibold text-[#8a3f35]"
                      >
                        Entfernen
                      </button>
                    </div>
                    {extraCount > 0 ? <div>Add-ons: {extraCount}</div> : null}
                  </div>
                )
              })}
            </div>

            <div className="mt-3 rounded-xl bg-[#f7fbfb] px-3 py-2 text-xs text-[#2f464d]">
              <div className="flex justify-between"><span>Dauer gesamt</span><span>{totalDurationMinutes} Min.</span></div>
              <div className="flex justify-between"><span>Zwischensumme</span><span>{formatCurrency(baseServicesPrice + optionalExtrasPrice)}</span></div>
              <div className="flex justify-between"><span>PickMe-Servicegebühr</span><span>{formatCurrency(serviceFee)}</span></div>
              <div className="flex justify-between"><span>Heute online</span><span>{formatCurrency(amountOnline)}</span></div>
              <div className="flex justify-between"><span>Vor Ort zu zahlen</span><span>{formatCurrency(amountAtSalon)}</span></div>
              <div className="mt-1 flex justify-between font-semibold"><span>Gesamtpreis</span><span>{formatCurrency(totalPrice)}</span></div>
              <div className="mt-1 text-[11px] text-[#5f7378]">PickMe-Service: Im Partner-Abo enthalten</div>
            </div>
            {quoteQuery.isFetching ? <div className="mt-2 text-xs text-[#5f7378]">Preis wird aktualisiert...</div> : null}
          </section>
        </aside>
      </div>

      {demoCanEdit && isPreviewMode && demoPreviewView === 'KATALOG' ? (
        <section className="rounded-3xl border border-[#dce6e8] bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-[#14353e]">Vorschau als Kunde: Katalogansicht</h2>
          <p className="mt-1 text-xs text-[#5f7378]">So erscheint Ihr Eintrag zwischen anderen Salons.</p>
          <div className="mt-3 flex justify-center">
            <div className={`${demoPreviewViewport === 'MOBILE' ? 'w-[390px]' : 'w-full max-w-[980px]'}`}>
              <article className="overflow-hidden rounded-[22px] border border-[#d9e3e5] bg-white shadow-[0_10px_22px_rgba(9,37,41,0.08)]">
                <div className="grid gap-0 md:grid-cols-[200px_minmax(0,1fr)]">
                  <div className="h-44 bg-[#e7ecec] md:h-full">
                    {activeCoverUrl ? (
                      <img src={activeCoverUrl} alt={displayOverview?.name || effectiveSalon.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-[#5f7378]">Kein Cover</div>
                    )}
                  </div>
                  <div className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-[16px] font-semibold text-[#132a31]">{displayOverview?.name || effectiveSalon.name}</h3>
                        <p className="text-xs text-[#5a7075]">{publicAddressLine}</p>
                      </div>
                      <span className="rounded-full bg-[#124753] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#f8f6f0]">PickMe Partner</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#2d4850]">
                      <span>Mitarbeiter: {editorDraft?.staff.length ?? 0}</span>
                      <span>Jetzt verfügbar: {demoLiveSummary.jetztVerfuegbar}</span>
                      <span>Nächster freier Termin: {demoLiveSummary.naechsterFreierTermin ?? 'Noch nicht berechenbar'}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px] text-[#3d5960]">
                      {(editorDraft?.staff ?? []).slice(0, 3).map((staff, index) => (
                        <span key={`catalog-staff-${index}`} className="rounded-full bg-[#f2f7f7] px-2 py-1">{staff.displayName || `Mitarbeiter ${index + 1}`}</span>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn-secondary text-xs">Mehr erfahren</button>
                      <button type="button" className="btn-primary text-xs">Jetzt buchen</button>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>
      ) : null}

      {(demoCanEdit || realCanEdit) ? (
        <section className="rounded-3xl border border-[#d3e0e2] bg-white p-4 shadow-sm">
          <div className="mb-2 inline-flex items-center rounded-full bg-[#eaf1f1] px-3 py-1 text-xs font-semibold text-[#184754]">
            PickMe Partner
          </div>
          <h2 className="text-base font-semibold text-[#14353e]">Salonbestellungen</h2>
          <p className="mt-1 text-xs text-[#5f7378]">Die Kundentelefonnummer ist nur für den Saloninhaber sichtbar.</p>

          {partnerOrders.length === 0 ? (
            <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">Noch keine bestätigten Bestellungen im Demo-Modus.</div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-xs text-slate-700">
                <thead className="text-[11px] uppercase tracking-[0.08em] text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Nummer</th>
                    <th className="px-2 py-2">Kunde</th>
                    <th className="px-2 py-2">Kundentelefon</th>
                    <th className="px-2 py-2">Leistung</th>
                    <th className="px-2 py-2">Mitarbeiter</th>
                    <th className="px-2 py-2">Datum</th>
                    <th className="px-2 py-2">Uhrzeit</th>
                    <th className="px-2 py-2">Preis</th>
                    <th className="px-2 py-2">Zahlung</th>
                  </tr>
                </thead>
                <tbody>
                  {partnerOrders.map((order) => (
                    <tr key={order.bookingNumber} className="border-t border-slate-200">
                      <td className="px-2 py-2 font-semibold">{order.bookingNumber}</td>
                      <td className="px-2 py-2">{order.customerName}</td>
                      <td className="px-2 py-2">{order.customerPhone}</td>
                      <td className="px-2 py-2">{order.serviceName}</td>
                      <td className="px-2 py-2">{order.masterName}</td>
                      <td className="px-2 py-2">{order.date}</td>
                      <td className="px-2 py-2">{order.time}</td>
                      <td className="px-2 py-2">{formatCurrency(order.totalPrice)}</td>
                      <td className="px-2 py-2">{order.paymentStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      <AuthPromptModal
        isOpen={isAuthPromptOpen}
        onClose={() => setIsAuthPromptOpen(false)}
        returnTo={`${location.pathname}${location.search}`}
      />
    </div>
  )
}
