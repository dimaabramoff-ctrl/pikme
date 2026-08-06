import { useQuery } from '@tanstack/react-query'
import { CalendarDays, CheckCircle2, Clock3, CreditCard, Home, MapPin, MessageCircle, Phone, Scissors, ShieldCheck, UserRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { AuthPromptModal } from '../features/auth/components/AuthPromptModal'
import { adminModeApi } from '../features/admin/api/adminModeApi'
import { useAuthStore } from '../features/auth/authStore'
import { SuperAdminModePanel } from '../shared/components/SuperAdminModePanel'
import { masterApi } from '../features/masters/api/masterApi'
import {
  buildPresentationBookingNumber,
  calculatePresentationTravelFee,
  getPresentationDefaultHomeAddressId,
  getPresentationHomeAddressOptions,
  getPresentationHomeSlots,
  getPresentationMasterById,
  PRESENTATION_CUSTOMER,
  PRESENTATION_MODE,
} from '../shared/demo/presentationData'
import { masterKeys } from '../shared/query/queryKeys'
import { useAdminModeStore } from '../shared/store/adminModeStore'

type HomeStep = 1 | 2 | 3 | 4 | 5 | 6 | 7

type PaymentMethod = 'IN_SALON' | 'CARD'

interface HomeDraft {
  serviceId?: string
  addressId?: string
  address?: string
  date?: string
  slot?: string
  paymentMethod?: PaymentMethod
  cardHolder?: string
  cardLast4?: string
  cardExpiry?: string
  clientComment?: string
  step?: HomeStep
}

type AvailabilityState = 'FREE' | 'BUSY' | 'PAUSE' | 'OFF_DUTY'

interface PublicScheduleRow {
  dayOfWeek: number
  shiftStart: string
  shiftEnd: string
  isDayOff?: boolean
  acceptsBookings?: boolean
  supportsHomeVisits?: boolean
  breaks?: Array<{ startTime: string; endTime: string; reason?: string }>
}

interface PublicBookingInterval {
  startsAt: string
  endsAt: string
  status?: string
  isHomeVisit?: boolean
}

interface AvailabilityInterval {
  start: string
  end: string
  state: AvailabilityState
}

interface AvailabilityDay {
  date: string
  dayLabel: string
  shiftLabel: string
  isWorkingDay: boolean
  supportsHomeVisits: boolean
  intervals: AvailabilityInterval[]
}

function getTodayDateInput() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function formatCurrency(value: number | string) {
  const amount = Number(value)
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount) + ' €'
}

function formatDistanceKm(value: number) {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value) + ' km'
}

function formatSlotDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Auf Anfrage'
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function readDraft(storageKey: string): HomeDraft {
  try {
    const raw = sessionStorage.getItem(storageKey)
    if (!raw) return {}
    return JSON.parse(raw) as HomeDraft
  } catch {
    sessionStorage.removeItem(storageKey)
    return {}
  }
}

function toMinutes(value: string) {
  const [h, m] = value.split(':').map(Number)
  return h * 60 + m
}

function fromMinutes(value: number) {
  const clamped = Math.max(0, Math.min(value, 24 * 60 - 1))
  const h = String(Math.floor(clamped / 60)).padStart(2, '0')
  const m = String(clamped % 60).padStart(2, '0')
  return `${h}:${m}`
}

function dayLabel(date: Date) {
  return new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }).format(date)
}

function mergeBusyIntervals(intervals: Array<{ start: number; end: number }>) {
  if (intervals.length === 0) return []
  const sorted = [...intervals].sort((a, b) => a.start - b.start)
  const merged: Array<{ start: number; end: number }> = [sorted[0]]
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = merged[merged.length - 1]
    const current = sorted[i]
    if (current.start <= prev.end) {
      prev.end = Math.max(prev.end, current.end)
    } else {
      merged.push(current)
    }
  }
  return merged
}

function buildAvailabilityWeek(input: {
  schedules: PublicScheduleRow[]
  bookings: PublicBookingInterval[]
  selectedDurationMinutes: number
  requiresHomeVisit: boolean
}) {
  const now = new Date()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  const activeBookings = input.bookings
    .filter((booking) => ['pending', 'confirmed', 'inProgress'].includes(String(booking.status ?? '')))
    .map((booking) => ({
      start: new Date(booking.startsAt),
      end: new Date(booking.endsAt),
      isHomeVisit: Boolean(booking.isHomeVisit),
    }))
    .filter((booking) => Number.isFinite(booking.start.getTime()) && Number.isFinite(booking.end.getTime()))

  const days: AvailabilityDay[] = []

  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(today)
    date.setDate(today.getDate() + offset)
    const dow = date.getDay()

    const schedule = input.schedules.find((row) => row.dayOfWeek === dow) ?? null
    if (!schedule || schedule.isDayOff || schedule.acceptsBookings === false) {
      days.push({
        date: date.toISOString().slice(0, 10),
        dayLabel: dayLabel(date),
        shiftLabel: 'Nicht im Dienst',
        isWorkingDay: false,
        supportsHomeVisits: false,
        intervals: [],
      })
      continue
    }

    const shiftStart = toMinutes(schedule.shiftStart)
    const shiftEnd = toMinutes(schedule.shiftEnd)
    const supportsHomeVisits = Boolean(schedule.supportsHomeVisits)
    const breaks = (schedule.breaks ?? []).map((row) => ({
      start: toMinutes(row.startTime),
      end: toMinutes(row.endTime),
    })).filter((row) => row.end > row.start)

    const busy = activeBookings
      .filter((booking) => booking.start.toISOString().slice(0, 10) === date.toISOString().slice(0, 10))
      .map((booking) => ({
        start: booking.start.getHours() * 60 + booking.start.getMinutes(),
        end: booking.end.getHours() * 60 + booking.end.getMinutes(),
      }))

    const mergedBusy = mergeBusyIntervals(busy)
    const mergedBreaks = mergeBusyIntervals(breaks)
    const intervals: AvailabilityInterval[] = []

    for (let cursor = shiftStart; cursor < shiftEnd; cursor += 15) {
      const end = Math.min(cursor + 15, shiftEnd)

      const inBreak = mergedBreaks.some((row) => cursor < row.end && end > row.start)
      if (inBreak) {
        intervals.push({ start: fromMinutes(cursor), end: fromMinutes(end), state: 'PAUSE' })
        continue
      }

      const inBusy = mergedBusy.some((row) => cursor < row.end && end > row.start)
      if (inBusy) {
        intervals.push({ start: fromMinutes(cursor), end: fromMinutes(end), state: 'BUSY' })
        continue
      }

      const slotWouldEnd = cursor + input.selectedDurationMinutes
      if (slotWouldEnd > shiftEnd) {
        intervals.push({ start: fromMinutes(cursor), end: fromMinutes(end), state: 'OFF_DUTY' })
        continue
      }

      const overlapsBreakForDuration = mergedBreaks.some((row) => cursor < row.end && slotWouldEnd > row.start)
      const overlapsBusyForDuration = mergedBusy.some((row) => cursor < row.end && slotWouldEnd > row.start)
      const failsHomeVisit = input.requiresHomeVisit && !supportsHomeVisits

      if (overlapsBreakForDuration || overlapsBusyForDuration || failsHomeVisit) {
        intervals.push({ start: fromMinutes(cursor), end: fromMinutes(end), state: 'OFF_DUTY' })
      } else {
        intervals.push({ start: fromMinutes(cursor), end: fromMinutes(end), state: 'FREE' })
      }
    }

    days.push({
      date: date.toISOString().slice(0, 10),
      dayLabel: dayLabel(date),
      shiftLabel: `${schedule.shiftStart} - ${schedule.shiftEnd}`,
      isWorkingDay: true,
      supportsHomeVisits,
      intervals,
    })
  }

  return days
}

export function MasterDetailPage() {
  const { masterId } = useParams()
  const currentUser = useAuthStore((state) => state.currentUser)
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN'
  const adminModeEnabled = useAdminModeStore((state) => state.enabled)
  const isSuperAdminMode = isSuperAdmin && adminModeEnabled
  const location = useLocation()

  const presentationMaster = masterId && PRESENTATION_MODE ? getPresentationMasterById(masterId) : undefined
  const isPresentationMaster = Boolean(presentationMaster)

  const { data: master, isPending, isError } = useQuery({
    queryKey: masterKeys.detail(masterId ?? 'unknown'),
    queryFn: () => masterApi.getById(masterId ?? ''),
    enabled: Boolean(masterId) && !isPresentationMaster,
  })

  const draftStorageKey = `pickme:home-booking-draft:${masterId}`
  const initialDraft = useMemo(() => readDraft(draftStorageKey), [draftStorageKey])

  const [step, setStep] = useState<HomeStep>(
    initialDraft.step && initialDraft.step >= 1 && initialDraft.step <= 6 ? initialDraft.step : 1,
  )
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(initialDraft.serviceId ?? null)
  const [selectedAddressId, setSelectedAddressId] = useState(initialDraft.addressId ?? getPresentationDefaultHomeAddressId())
  const [address, setAddress] = useState(initialDraft.address ?? 'Musterstrasse 12, 19288 Ludwigslust')
  const [date, setDate] = useState(initialDraft.date ?? getTodayDateInput())
  const [slot, setSlot] = useState<string | null>(initialDraft.slot ?? null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(initialDraft.paymentMethod ?? 'IN_SALON')
  const [cardHolder, setCardHolder] = useState(initialDraft.cardHolder ?? 'Demo Client')
  const [cardLast4, setCardLast4] = useState(initialDraft.cardLast4 ?? '4242')
  const [cardExpiry, setCardExpiry] = useState(initialDraft.cardExpiry ?? '12/29')
  const [clientComment, setClientComment] = useState(initialDraft.clientComment ?? '')
  const [bookingNumber, setBookingNumber] = useState<string | null>(null)
  const [isAuthPromptOpen, setIsAuthPromptOpen] = useState(false)
  const [isMasterAdminEditOpen, setIsMasterAdminEditOpen] = useState(false)
  const [isMasterAdminSaving, setIsMasterAdminSaving] = useState(false)
  const [adminStatusMessage, setAdminStatusMessage] = useState<string | null>(null)
  const [adminDraft, setAdminDraft] = useState<{
    displayName: string
    specialization: string
    biography: string
    acceptsHomeVisits: boolean
    homeVisitRadiusKm: number
    currentStatus: 'AVAILABLE' | 'SOON_AVAILABLE' | 'BUSY' | 'OFFLINE'
  } | null>(null)

  useEffect(() => {
    if (step === 7) return
    const draft: HomeDraft = {
      serviceId: selectedServiceId ?? undefined,
      addressId: selectedAddressId,
      address,
      date,
      slot: slot ?? undefined,
      paymentMethod,
      cardHolder,
      cardLast4,
      cardExpiry,
      clientComment,
      step,
    }
    sessionStorage.setItem(draftStorageKey, JSON.stringify(draft))
  }, [address, cardExpiry, cardHolder, cardLast4, clientComment, date, draftStorageKey, paymentMethod, selectedAddressId, selectedServiceId, slot, step])

  if (!isPresentationMaster && isPending) return <div className="rounded-3xl bg-white p-4">Laden...</div>

  const profile = presentationMaster
    ? {
      id: presentationMaster.id,
      displayName: presentationMaster.displayName,
      specialization: presentationMaster.role,
      biography: presentationMaster.biography,
      experienceYears: presentationMaster.experienceYears,
      ratingAverage: presentationMaster.rating,
      acceptsHomeVisits: true,
      district: presentationMaster.district,
      phone: presentationMaster.phone,
      visitFee: presentationMaster.visitFee,
      todaySchedule: presentationMaster.todaySchedule,
      services: presentationMaster.services,
      availabilityStatus: presentationMaster.availabilityStatus,
      nextWindow: presentationMaster.nextWindow,
      avatar: presentationMaster.avatar,
    }
    : master

  if (!profile || (isError && !isPresentationMaster)) return <div className="rounded-3xl bg-white p-4">Das Profil ist derzeit nicht verfügbar.</div>

  const targetMasterUserId = (profile as { userId?: string; user?: { id?: string; isActive?: boolean } }).userId
    ?? (profile as { user?: { id?: string } }).user?.id
    ?? null
  const targetUserActive = Boolean((profile as { user?: { isActive?: boolean } }).user?.isActive ?? true)

  const services = presentationMaster?.services ?? [
    { id: 'home-default-1', name: 'Damenhaarschnitt', durationMinutes: 45, servicePrice: 45 },
    { id: 'home-default-2', name: 'Herrenhaarschnitt', durationMinutes: 30, servicePrice: 30 },
  ]

  const presentationAddressOptions = presentationMaster
    ? getPresentationHomeAddressOptions(presentationMaster.id)
    : []

  const selectedPresentationAddress = presentationAddressOptions.find((item) => item.id === selectedAddressId)
  const selectedService = services.find((item) => item.id === selectedServiceId) ?? services[0]
  const servicePrice = selectedService?.servicePrice ?? 0
  const effectiveAddress = presentationMaster
    ? selectedPresentationAddress?.label ?? address
    : address

  const demoDistanceKm = selectedPresentationAddress?.demoDistanceKm ?? presentationMaster?.distanceKm ?? 0
  const visitFee = presentationMaster ? calculatePresentationTravelFee(demoDistanceKm) : 0
  const optionalExtrasPrice = 0
  const totalPrice = servicePrice + visitFee + optionalExtrasPrice
  const profileSchedules = ((profile as unknown as { schedules?: PublicScheduleRow[] }).schedules ?? [])
  const profileBookings = ((profile as unknown as { bookings?: PublicBookingInterval[] }).bookings ?? [])
  const isIndependentProfile = !presentationMaster && !(profile as { salon?: unknown }).salon && profile.acceptsHomeVisits

  const weekAvailability = isIndependentProfile
    ? buildAvailabilityWeek({
      schedules: profileSchedules,
      bookings: profileBookings,
      selectedDurationMinutes: selectedService?.durationMinutes ?? 30,
      requiresHomeVisit: true,
    })
    : []

  const selectedDayAvailability = weekAvailability.find((entry) => entry.date === date)
  const freeIntervalsForSelectedDay = selectedDayAvailability
    ? selectedDayAvailability.intervals
      .filter((entry) => entry.state === 'FREE')
      .map((entry) => `${selectedDayAvailability.date}T${entry.start}:00.000Z`)
    : []

  const slots = presentationMaster
    ? getPresentationHomeSlots(date)
    : isIndependentProfile
      ? freeIntervalsForSelectedDay
      : getPresentationHomeSlots(date)

  const nextAvailableSlot = weekAvailability
    .flatMap((day) => day.intervals.filter((entry) => entry.state === 'FREE').map((entry) => `${day.date}T${entry.start}:00.000Z`))
    .sort()[0] ?? null

  const todayAvailability = weekAvailability[0]
  const todayFreeWindows = todayAvailability?.intervals.filter((entry) => entry.state === 'FREE').length ?? 0

  const clientName = currentUser?.name || PRESENTATION_CUSTOMER.fullName
  const clientPhone = currentUser?.phone || PRESENTATION_CUSTOMER.phone
  const bookingDateTimeLabel = slot ? formatSlotDateTime(slot) : '-'
  const masterLabels =
    ((profile as unknown as { profileFlags?: { labels?: string[] } }).profileFlags?.labels ?? [])
    .concat(isIndependentProfile ? ['Selbstständiger Anbieter'] : [])
    .filter((value, index, list) => list.indexOf(value) === index)

  const completedAppointments = Number((profile as { completedBookingsCount?: number }).completedBookingsCount ?? 0)
  const verifiedReviewsCount = Number((profile as { reviewCount?: number }).reviewCount ?? 0)
  const ratingValue = Number((profile as { ratingAverage?: number | null }).ratingAverage ?? presentationMaster?.rating ?? 0)
  const pickmeYears = Math.max(1, (profile.experienceYears ?? 1) - 1)
  const profileAvatar = (profile as { avatarUrl?: string | null }).avatarUrl ?? presentationMaster?.avatar ?? null
  const profileCurrentStatus = (profile as { currentStatus?: 'AVAILABLE' | 'SOON_AVAILABLE' | 'BUSY' | 'OFFLINE' }).currentStatus

  const workingDaysLabel = profileSchedules
    .filter((row) => !row.isDayOff && row.acceptsBookings !== false)
    .map((row) => ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][row.dayOfWeek] ?? '')
    .filter(Boolean)
    .join(', ')

  const plannedFreeSlots = weekAvailability
    .flatMap((day) =>
      day.intervals
        .filter((entry) => entry.state === 'FREE')
        .map((entry) => `${day.dayLabel} ${entry.start}`),
    )
    .slice(0, 8)

  const recentReviews = ((profile as unknown as {
    reviews?: Array<{ id?: string; rating?: number; text?: string | null; createdAt?: string }>
  }).reviews ?? []).slice(0, 3)

  const popularServices = [...services]
    .sort((a, b) => Number(b.servicePrice) - Number(a.servicePrice))
    .slice(0, 5)

  const serviceAreaLabel =
    presentationMaster?.district ||
    (profile.biography?.match(/Radius\s+([^\.]+)/i)?.[1] ?? 'Berlin-Mitte, Prenzlauer Berg')

  const statusLabel =
    profileCurrentStatus === 'AVAILABLE'
      ? 'Jetzt verfügbar'
      : profileCurrentStatus === 'BUSY'
        ? 'Belegt'
        : profileCurrentStatus === 'SOON_AVAILABLE'
          ? 'In Kürze verfügbar'
          : 'Nicht im Dienst'

  const paymentMethodLabel =
    paymentMethod === 'IN_SALON'
      ? 'Zahlung vor Ort'
      : paymentMethod === 'CARD'
        ? 'Bankkarte'
        : 'Zahlung vor Ort'

  useEffect(() => {
    if (!isSuperAdminMode) {
      setIsMasterAdminEditOpen(false)
      return
    }
    setAdminDraft({
      displayName: profile.displayName,
      specialization: profile.specialization ?? '',
      biography: profile.biography ?? '',
      acceptsHomeVisits: Boolean(profile.acceptsHomeVisits),
      homeVisitRadiusKm: Number((profile as { homeVisitRadiusKm?: number }).homeVisitRadiusKm ?? 5),
      currentStatus: profileCurrentStatus ?? 'AVAILABLE',
    })
  }, [
    isSuperAdminMode,
    profile.acceptsHomeVisits,
    profile.biography,
    profile.displayName,
    profile.specialization,
    profileCurrentStatus,
    profile,
  ])

  const saveMasterAdminEdit = async () => {
    if (!masterId || !adminDraft) return
    try {
      setIsMasterAdminSaving(true)
      setAdminStatusMessage(null)
      await adminModeApi.editMasterProfile(masterId, {
        displayName: adminDraft.displayName,
        specialization: adminDraft.specialization,
        biography: adminDraft.biography,
        acceptsHomeVisits: adminDraft.acceptsHomeVisits,
        homeVisitRadiusKm: adminDraft.homeVisitRadiusKm,
        currentStatus: adminDraft.currentStatus,
        reason: 'Admin mode quick edit',
      })
      setAdminStatusMessage('Masterprofil gespeichert')
      await window.location.reload()
    } catch (error) {
      const message = typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : 'Fehler beim Speichern'
      setAdminStatusMessage(message)
    } finally {
      setIsMasterAdminSaving(false)
    }
  }

  const handleConfirm = () => {
    if (!currentUser) {
      setIsAuthPromptOpen(true)
      return
    }

    setBookingNumber(buildPresentationBookingNumber())
    sessionStorage.removeItem(draftStorageKey)
    setStep(7)
  }

  return (
    <div className="space-y-4 rounded-[30px] border border-[#cad6d9] bg-white p-4 shadow-[0_20px_34px_rgba(9,37,41,0.1)]">
      {isSuperAdminMode && masterId ? (
        <SuperAdminModePanel
          entityType="MasterProfile"
          entityId={masterId}
          title={`Admin actions for ${profile.displayName}`}
          canOpenOwnerEditor={Boolean((profile as { salon?: { id?: string } | null }).salon?.id)}
          canManageTrial={false}
          canResetDemo={masterLabels.includes('Demo-Profil')}
          resetScope={masterLabels.includes('Demo-Profil') ? 'DEMO_ZUHAUSE' : undefined}
          onOpenEditor={() => {
            const salon = (profile as { salon?: { id?: string } | null }).salon
            if (salon?.id) {
              window.location.href = `/salons/${salon.id}?demoEdit=1`
            }
          }}
          onOpenMasterEdit={() => setIsMasterAdminEditOpen((value) => !value)}
          onRefresh={async () => {
            await window.location.reload()
          }}
          isActive={Boolean((profile as { acceptsBookings?: boolean }).acceptsBookings ?? true)}
          isLocked={!targetUserActive}
          targetUserId={targetMasterUserId}
        />
      ) : null}

      {isSuperAdminMode && isMasterAdminEditOpen && adminDraft ? (
        <section className="rounded-2xl border border-[#d3e3e5] bg-[#f8fcfc] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#51727a]">Master Bearbeiten</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="text-xs font-semibold text-[#4f6d75]">Name<input className="field-input mt-1" value={adminDraft.displayName} onChange={(event) => setAdminDraft({ ...adminDraft, displayName: event.target.value })} /></label>
            <label className="text-xs font-semibold text-[#4f6d75]">Spezialisierung<input className="field-input mt-1" value={adminDraft.specialization} onChange={(event) => setAdminDraft({ ...adminDraft, specialization: event.target.value })} /></label>
            <label className="text-xs font-semibold text-[#4f6d75] sm:col-span-2">Beschreibung<textarea className="field-input mt-1 min-h-20" value={adminDraft.biography} onChange={(event) => setAdminDraft({ ...adminDraft, biography: event.target.value })} /></label>
            <label className="text-xs font-semibold text-[#4f6d75]">Radius (km)<input type="number" className="field-input mt-1" value={adminDraft.homeVisitRadiusKm} onChange={(event) => setAdminDraft({ ...adminDraft, homeVisitRadiusKm: Number(event.target.value) })} /></label>
            <label className="text-xs font-semibold text-[#4f6d75]">Status
              <select className="field-input mt-1" value={adminDraft.currentStatus} onChange={(event) => setAdminDraft({ ...adminDraft, currentStatus: event.target.value as 'AVAILABLE' | 'SOON_AVAILABLE' | 'BUSY' | 'OFFLINE' })}>
                <option value="AVAILABLE">AVAILABLE</option>
                <option value="SOON_AVAILABLE">SOON_AVAILABLE</option>
                <option value="BUSY">BUSY</option>
                <option value="OFFLINE">OFFLINE</option>
              </select>
            </label>
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#36555d] sm:col-span-2">
              <input type="checkbox" checked={adminDraft.acceptsHomeVisits} onChange={(event) => setAdminDraft({ ...adminDraft, acceptsHomeVisits: event.target.checked })} />
              Hausbesuch aktiv
            </label>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="btn-primary text-xs" onClick={() => { void saveMasterAdminEdit() }} disabled={isMasterAdminSaving}>
              {isMasterAdminSaving ? 'Speichert...' : 'Speichern'}
            </button>
            <button type="button" className="btn-secondary text-xs" onClick={() => setIsMasterAdminEditOpen(false)}>
              Schließen
            </button>
          </div>
          {adminStatusMessage ? <p className="mt-2 text-xs font-semibold text-[#2d5961]">{adminStatusMessage}</p> : null}
        </section>
      ) : null}

      <div className="space-y-2">
        {profileAvatar ? (
          <img
            src={profileAvatar}
            alt={profile.displayName}
            className="h-28 w-28 rounded-2xl object-cover ring-1 ring-[#d5e1e3]"
          />
        ) : null}
        <h1 className="text-xl font-semibold text-[#112e35]">{profile.displayName}</h1>
        <p className="text-sm font-medium text-[#42606a]">{presentationMaster?.role ?? profile.specialization}</p>
        {masterLabels.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {masterLabels.map((label) => (
              <span key={label} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${label === 'Demo-Profil' ? 'bg-[#fff0de] text-[#8d552c]' : 'bg-[#edf3f4] text-[#4b6870]'}`}>
                {label}
              </span>
            ))}
          </div>
        ) : null}
        <p className="text-sm text-[#596f75]">{presentationMaster?.biography ?? profile.biography}</p>
        <p className="text-sm text-[#4f666b]">Telefon: {presentationMaster?.phone ?? 'Auf Anfrage'}</p>
        <div className="flex flex-wrap gap-2 text-xs">
          {presentationMaster?.phone ? (
            <a href={`tel:${presentationMaster.phone.replace(/\s+/g, '')}`} className="btn-secondary inline-flex items-center gap-1" aria-label="Anrufen">
              <Phone size={14} /> Anrufen
            </a>
          ) : null}
          {presentationMaster?.phone ? (
            <a
              href={PRESENTATION_MODE ? `https://wa.me/${presentationMaster.phone.replace(/[^\d+]/g, '').replace('+', '')}` : `sms:${presentationMaster.phone.replace(/\s+/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary inline-flex items-center gap-1"
              aria-label={PRESENTATION_MODE ? 'WhatsApp' : 'Nachricht senden'}
            >
              <MessageCircle size={14} /> {PRESENTATION_MODE ? 'WhatsApp' : 'Nachricht senden'}
            </a>
          ) : null}
        </div>
      </div>

      <div className="grid gap-2 text-sm sm:grid-cols-3">
        <div className="rounded-xl bg-[#f2f6f6] px-3 py-2 text-[#2c4046]">Erfahrung: <span className="font-semibold">{profile.experienceYears} Jahre</span></div>
        <div className="rounded-xl bg-[#f2f6f6] px-3 py-2 text-[#2c4046]">Bei PickMe: <span className="font-semibold">{pickmeYears} Jahre</span></div>
        <div className="rounded-xl bg-[#f2f6f6] px-3 py-2 text-[#2c4046]">Abgeschlossene Termine: <span className="font-semibold">{completedAppointments}</span></div>
        <div className="rounded-xl bg-[#f2f6f6] px-3 py-2 text-[#2c4046]">Anfahrt: <span className="font-semibold">{formatCurrency(visitFee)}</span></div>
        <div className="rounded-xl bg-[#f2f6f6] px-3 py-2 text-[#2c4046]">Arbeitsgebiet: <span className="font-semibold">{serviceAreaLabel}</span></div>
        <div className="rounded-xl bg-[#f2f6f6] px-3 py-2 text-[#2c4046]">Status: <span className="font-semibold text-[#2F8B5D]">{presentationMaster?.availabilityStatus ?? statusLabel}</span></div>
        <div className="rounded-xl bg-[#f2f6f6] px-3 py-2 text-[#2c4046]">Nächstes Zeitfenster: <span className="font-semibold">{presentationMaster?.nextWindow ?? (nextAvailableSlot ? formatSlotDateTime(nextAvailableSlot) : 'Auf Anfrage')}</span></div>
        <div className="rounded-xl bg-[#f2f6f6] px-3 py-2 text-[#2c4046]">PickMe Rating: <span className="font-semibold">{ratingValue.toFixed(1)}</span></div>
        <div className="rounded-xl bg-[#f2f6f6] px-3 py-2 text-[#2c4046]">Bestätigte Bewertungen: <span className="font-semibold">{verifiedReviewsCount}</span></div>
        <div className="rounded-xl bg-[#f2f6f6] px-3 py-2 text-[#2c4046]">Hausbesuch: <span className="font-semibold">{profile.acceptsHomeVisits ? 'Verfügbar' : 'Nicht verfügbar'}</span></div>
      </div>

      <section className="rounded-2xl border border-[#d8e0e2] bg-[#fafcfc] p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5e747a]">Beliebte Leistungen</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {popularServices.map((service) => (
            <div key={service.id} className="rounded-xl border border-[#e6edef] bg-white px-3 py-2 text-sm text-[#2c4046]">
              <div className="font-semibold text-[#163740]">{service.name}</div>
              <div className="text-xs text-[#60757b]">{service.durationMinutes} Min.</div>
              <div className="mt-1 text-sm font-semibold text-[#1f4851]">{formatCurrency(service.servicePrice)}</div>
            </div>
          ))}
        </div>
      </section>

      {recentReviews.length > 0 ? (
        <section className="rounded-2xl border border-[#d8e0e2] bg-[#fafcfc] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5e747a]">Bestätigte PickMe Bewertungen</p>
          <div className="mt-2 space-y-2">
            {recentReviews.map((review, index) => (
              <article key={review.id ?? `review-${index}`} className="rounded-xl border border-[#e6edef] bg-white px-3 py-2 text-sm text-[#2c4046]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{Number(review.rating ?? 0).toFixed(1)} / 5</span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#3a6a74]">Verifiziert</span>
                </div>
                <p className="mt-1 text-xs text-[#5b7076]">{review.text || 'Ohne Kommentar'}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {isIndependentProfile ? (
        <section className="rounded-2xl border border-[#d8e0e2] bg-[#fafcfc] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5e747a]">Öffentlicher Kalender (Zuhause)</p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
            <span className="rounded-full bg-[#eef3f4] px-2 py-0.5 text-[#4d6670]">Angaben vom Anbieter</span>
            <span className="rounded-full bg-[#e8f3ed] px-2 py-0.5 text-[#2f7b57]">Identität bestätigt</span>
            <span className="rounded-full bg-[#fff1df] px-2 py-0.5 text-[#8f5a2f]">Qualifikation nicht durch PickMe bestätigt</span>
          </div>
          <div className="mt-2 grid gap-2 text-sm text-[#2c4046] sm:grid-cols-3">
            <div className="rounded-xl bg-white px-3 py-2">Jetzt: <span className="font-semibold">{statusLabel}</span></div>
            <div className="rounded-xl bg-white px-3 py-2">Nächster Termin: <span className="font-semibold">{nextAvailableSlot ? formatSlotDateTime(nextAvailableSlot) : 'Auf Anfrage'}</span></div>
            <div className="rounded-xl bg-white px-3 py-2">Heute freie Zeitfenster: <span className="font-semibold">{todayFreeWindows}</span></div>
            <div className="rounded-xl bg-white px-3 py-2 sm:col-span-3">Arbeitstage: <span className="font-semibold">{workingDaysLabel || 'Wird aktualisiert'}</span></div>
          </div>

          {selectedDayAvailability ? (
            <div className="mt-3 rounded-xl border border-[#e5ecee] bg-white p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5e747a]">Heute: {selectedDayAvailability.shiftLabel}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selectedDayAvailability.intervals.slice(0, 28).map((interval) => {
                  const stateLabel =
                    interval.state === 'FREE'
                      ? 'Frei'
                      : interval.state === 'BUSY'
                        ? 'Belegt'
                        : interval.state === 'PAUSE'
                          ? 'Pause'
                          : 'Nicht im Dienst'
                  const canPick = interval.state === 'FREE'
                  return (
                    <button
                      key={`${selectedDayAvailability.date}-${interval.start}-${interval.state}`}
                      type="button"
                      disabled={!canPick}
                      onClick={() => {
                        const slotValue = `${selectedDayAvailability.date}T${interval.start}:00.000Z`
                        if (!selectedServiceId && selectedService?.id) setSelectedServiceId(selectedService.id)
                        setDate(selectedDayAvailability.date)
                        setSlot(slotValue)
                        setStep(5)
                      }}
                      className={`rounded-full px-2.5 py-1 text-xs ${canPick ? 'bg-[#e5f3ea] text-[#2f8b5d] hover:bg-[#d4eadc]' : interval.state === 'BUSY' ? 'bg-[#f2f4f5] text-[#62767c]' : interval.state === 'PAUSE' ? 'bg-[#fff3df] text-[#95602e]' : 'bg-[#eceff1] text-[#73878d]'}`}
                    >
                      {interval.start} {stateLabel}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          <details className="mt-3 rounded-xl border border-[#e5ecee] bg-white p-3">
            <summary className="cursor-pointer text-sm font-semibold text-[#38545b]">Wochenübersicht (7 Tage)</summary>
            <div className="mt-2 space-y-2">
              {weekAvailability.map((day) => {
                const free = day.intervals.filter((item) => item.state === 'FREE').length
                const busy = day.intervals.filter((item) => item.state === 'BUSY').length
                const pause = day.intervals.filter((item) => item.state === 'PAUSE').length
                return (
                  <div key={day.date} className="rounded-lg border border-[#eef3f4] p-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[#1f3e46]">{day.dayLabel}</span>
                      <span className="text-[#60757b]">{day.shiftLabel}</span>
                    </div>
                    <div className="mt-1 text-xs text-[#60757b]">Frei: {free} · Belegt: {busy} · Pause: {pause}</div>
                    <div className="mt-1 text-xs text-[#60757b]">Hausbesuch: {day.supportsHomeVisits ? 'verfügbar' : 'Hausbesuch nicht verfügbar'}</div>
                  </div>
                )
              })}
            </div>
          </details>

          <div className="mt-3 rounded-xl border border-[#e5ecee] bg-white p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5e747a]">Geplante freie Termine</div>
            {plannedFreeSlots.length === 0 ? (
              <p className="mt-2 text-xs text-[#60757b]">Aktuell keine freien Fenster geplant.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {plannedFreeSlots.map((slotLabel) => (
                  <span key={slotLabel} className="rounded-full bg-[#e8f3ed] px-2.5 py-1 text-xs font-semibold text-[#2f8b5d]">
                    {slotLabel}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : null}

      {presentationMaster?.todaySchedule?.length ? (
        <div className="rounded-2xl border border-[#d8e0e2] bg-[#fafcfc] p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5e747a]">Heutige Verfügbarkeit</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {presentationMaster.todaySchedule.map((entry) => (
              <span
                key={entry.time}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${entry.state === 'free' ? 'bg-[#e5f3ea] text-[#2f8b5d]' : 'bg-[#f0f3f4] text-[#64797f]'}`}
              >
                {entry.time}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-6 gap-2 text-[11px] font-semibold text-slate-500">
          {['Leistung', 'Adresse', 'Datum', 'Zeit', 'Zahlung', 'Bestätigung'].map((label, index) => {
            const active = step >= index + 1
            return (
              <div key={label} className={`rounded-full px-3 py-2 text-center ${active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {label}
              </div>
            )
          })}
        </div>

        {step === 1 ? (
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5e747a]">Leistungen</div>
            <div className="grid gap-2">
              {services.map((service) => (
                <button
                  key={service.id}
                  onClick={() => {
                    setSelectedServiceId(service.id)
                    setStep(2)
                  }}
                  className="w-full rounded-2xl border border-slate-200 p-3 text-left"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{service.name}</div>
                      <div className="mt-1 text-xs text-slate-500">{service.durationMinutes} Min.</div>
                    </div>
                    <div className="text-right text-sm font-semibold text-slate-800">{formatCurrency(service.servicePrice)}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900">Schritt 2. Kundenadresse</h2>
              <button onClick={() => setStep(1)} className="text-sm font-semibold text-slate-600">Zurück</button>
            </div>

            {presentationMaster ? (
              <div className="space-y-2 rounded-2xl border border-slate-200 p-3">
                <div className="text-sm font-semibold text-slate-800">Demo-Adresse wählen</div>
                {presentationAddressOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setSelectedAddressId(option.id)
                      setAddress(option.label)
                    }}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${selectedAddressId === option.id ? 'border-[#17666D] bg-[#ebf3f3] text-[#123942]' : 'border-slate-200 text-slate-700'}`}
                  >
                    <div className="inline-flex items-center gap-2"><MapPin size={14} /> {option.label}</div>
                    <div className="mt-1 text-xs text-slate-500">Entfernung: {formatDistanceKm(option.demoDistanceKm)}</div>
                  </button>
                ))}
              </div>
            ) : (
              <label className="block rounded-2xl border border-slate-200 p-3">
                <span className="mb-1 inline-flex items-center gap-2 text-sm font-semibold text-slate-800"><MapPin size={14} /> Anfahrtsadresse</span>
                <input
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  className="field-input"
                  placeholder="Musterstrasse 12, 19288 Ludwigslust"
                />
              </label>
            )}
            <button onClick={() => setStep(3)} className="btn-primary">Weiter</button>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900">Schritt 3. Datum wählen</h2>
              <button onClick={() => setStep(2)} className="text-sm font-semibold text-slate-600">Zurück</button>
            </div>
            <label className="block rounded-2xl border border-slate-200 p-3">
              <span className="mb-1 inline-flex items-center gap-2 text-sm font-semibold text-slate-800"><CalendarDays size={14} /> Besuchsdatum</span>
              <input
                type="date"
                min={getTodayDateInput()}
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="field-input"
              />
            </label>
            <button onClick={() => setStep(4)} className="btn-primary">Zeiten anzeigen</button>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900">Schritt 4. Zeit wählen</h2>
              <button onClick={() => setStep(3)} className="text-sm font-semibold text-slate-600">Zurück</button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {slots.map((time) => (
                <button
                  key={time}
                  onClick={() => {
                    setSlot(time)
                    setStep(5)
                  }}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-left text-sm font-semibold text-slate-800"
                >
                  <div className="inline-flex items-center gap-1"><Clock3 size={14} /> {formatSlotDateTime(time)}</div>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900">Schritt 5. Zahlungsart</h2>
              <button onClick={() => setStep(4)} className="text-sm font-semibold text-slate-600">Zurück</button>
            </div>

            <div className="grid gap-2">
              {[
                { id: 'IN_SALON', label: 'Zahlung vor Ort' },
                { id: 'CARD', label: 'Bankkarte' },
              ].map((option) => (
                <button
                  key={option.id}
                  onClick={() => setPaymentMethod(option.id as PaymentMethod)}
                  className={`w-full rounded-2xl border px-3 py-2 text-left text-sm font-semibold ${
                    paymentMethod === option.id ? 'border-[#17666D] bg-[#ebf3f3] text-[#10313a]' : 'border-slate-200 text-slate-700'
                  }`}
                  type="button"
                >
                  <span className="inline-flex items-center gap-2"><CreditCard size={14} /> {option.label}</span>
                </button>
              ))}
            </div>

            {paymentMethod === 'CARD' ? (
              <div className="space-y-2 rounded-2xl border border-[#dbe8ea] bg-[#f7fbfb] p-3">
                <input
                  className="field-input"
                  value={cardHolder}
                  onChange={(event) => setCardHolder(event.target.value)}
                  placeholder="Name des Karteninhabers"
                />
                <input
                  className="field-input"
                  value={cardLast4}
                  onChange={(event) => setCardLast4(event.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                  placeholder="Letzte 4 Ziffern"
                />
                <input
                  className="field-input"
                  value={cardExpiry}
                  onChange={(event) => setCardExpiry(event.target.value)}
                  placeholder="Ablauf (MM/JJ)"
                />
              </div>
            ) : null}

            <p className="text-xs text-[#64767b]">Zahlung erfolgt vor Ort im Salon oder beim Termin.</p>
            <button onClick={() => setStep(6)} className="btn-primary">Weiter</button>
          </div>
        ) : null}

        {step === 6 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900">Schritt 6. Anfrage bestätigen</h2>
              <button onClick={() => setStep(5)} className="text-sm font-semibold text-slate-600">Zurück</button>
            </div>

            <div className="space-y-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Kunde</div>
                <div className="mt-1">Name: {clientName}</div>
                <div>Telefon: {clientPhone}</div>
                <div>Kundenadresse: {effectiveAddress}</div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Anbieter</div>
                <div>{profile.displayName}</div>
                <div>Telefon: {presentationMaster?.phone || 'Auf Anfrage'}</div>
                <div>Einzugsgebiet: {presentationMaster?.district || 'Ludwigslust'}</div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Termin</div>
                <div className="inline-flex items-center gap-2"><Scissors size={14} /> Leistung: {selectedService?.name}</div>
                <div className="inline-flex items-center gap-2"><UserRound size={14} /> Meister: {profile.displayName}</div>
                <div className="inline-flex items-center gap-2"><CalendarDays size={14} /> Datum: {date}</div>
                <div className="inline-flex items-center gap-2"><Clock3 size={14} /> Zeit: {bookingDateTimeLabel}</div>
                <div>Dauer: {selectedService?.durationMinutes ?? '-'} Min.</div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Kosten</div>
                <div>Leistung: {selectedService?.name ?? '-'} — {formatCurrency(servicePrice)}</div>
                <div>Zusatzleistungen: {formatCurrency(optionalExtrasPrice)}</div>
                <div>Entfernung: {formatDistanceKm(demoDistanceKm)}</div>
                <div>Anfahrt: {formatCurrency(visitFee)}</div>
                <div className="text-xs text-[#5f7378]">Die Anfahrt wird auf Basis der Strecke berechnet.</div>
                <div className="font-semibold">Gesamt: {formatCurrency(totalPrice)}</div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Zahlung</div>
                <div>Zahlungsart: {paymentMethodLabel}</div>
                <div className="text-xs text-[#5f7378]">Demozahlung – es wird nichts abgebucht.</div>
                {paymentMethod === 'CARD' ? <div>Karte: {cardHolder}, **** {cardLast4}, {cardExpiry}</div> : null}
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Kommentar des Kunden</span>
                <textarea
                  value={clientComment}
                  onChange={(event) => setClientComment(event.target.value)}
                  className="field-input min-h-20"
                  placeholder="Türcode, Wünsche"
                />
              </label>

              <div className="inline-flex items-center gap-2 text-xs text-[#5f7378]"><ShieldCheck size={14} /> Stornierung ist jederzeit unter „Meine Termine“ möglich.</div>
            </div>

            <button onClick={handleConfirm} className="btn-primary w-full" disabled={!selectedService || !slot}>
              Anfrage bestätigen
            </button>
          </div>
        ) : null}

        {step === 7 ? (
          <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-800">
            <div className="inline-flex items-center gap-2 text-base font-semibold"><CheckCircle2 size={18} /> Termin erfolgreich erstellt</div>
            <div className="mt-2 space-y-1 text-sm">
              <p>Buchungsnummer: {bookingNumber || buildPresentationBookingNumber()}</p>
              <p>Kundenname: {clientName}</p>
              <p>Kundentelefon: {clientPhone}</p>
              <p>Meister: {profile.displayName}</p>
              <p>Telefon des Profis: {presentationMaster?.phone || 'Auf Anfrage'}</p>
              <p>Leistung: {selectedService?.name ?? '-'}</p>
              <p>Adresse: {effectiveAddress}</p>
              <p>Datum und Uhrzeit: {bookingDateTimeLabel}</p>
              <p>Entfernung: {formatDistanceKm(demoDistanceKm)}</p>
              <p>Anfahrt: {formatCurrency(visitFee)}</p>
              <p>Gesamtpreis: {formatCurrency(totalPrice)}</p>
              <p>Zahlungsart: {paymentMethodLabel}</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link to="/profile" className="btn-secondary">Meine Termine</Link>
              {presentationMaster?.phone ? (
                <a href={`tel:${presentationMaster.phone.replace(/\s+/g, '')}`} className="btn-secondary inline-flex items-center gap-1">
                  <Phone size={14} /> Anrufen
                </a>
              ) : null}
              <Link to="/" className="btn-primary">Zur Startseite</Link>
            </div>
          </div>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-2">
        <Link to="/masters" className="btn-secondary"><Home size={14} /> Alle Meister</Link>
      </div>

      <AuthPromptModal
        isOpen={isAuthPromptOpen}
        onClose={() => setIsAuthPromptOpen(false)}
        returnTo={`${location.pathname}${location.search}`}
      />
    </div>
  )
}
