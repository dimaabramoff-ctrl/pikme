import type { NearbyCatalogItem } from '@pickme/api-types'
import type { MasterSummary, SalonSummary, ServiceSummary } from '../api/types'

const presentationModeEnv = import.meta.env.VITE_PRESENTATION_MODE
export const PRESENTATION_MODE = presentationModeEnv != null
  ? presentationModeEnv === 'true'
  : true

export const PRESENTATION_DEFAULT_LOCATION = {
  latitude: 53.3254,
  longitude: 11.4964,
  label: 'Schlossstrasse 14, 19288 Ludwigslust',
}

export const PRESENTATION_CUSTOMER = {
  fullName: 'Dmitri Abramov',
  phone: '+49 176 555 01 240',
}

export interface PresentationHomeAddress {
  id: string
  label: string
  latitude: number
  longitude: number
}

const presentationHomeAddresses: PresentationHomeAddress[] = [
  {
    id: 'demo-home-address-1',
    label: 'Musterstrasse 12, 19288 Ludwigslust',
    latitude: 53.3321,
    longitude: 11.5042,
  },
  {
    id: 'demo-home-address-2',
    label: 'Schweriner Strasse 24, 19288 Ludwigslust',
    latitude: 53.3178,
    longitude: 11.488,
  },
  {
    id: 'demo-home-address-3',
    label: 'Am Schlosspark 7, 19288 Ludwigslust',
    latitude: 53.3262,
    longitude: 11.4973,
  },
]

export interface PresentationSalonService {
  id: string
  name: string
  durationMinutes: number
  priceLabel: string
  basePrice: number
}

export interface PresentationSalonStaff {
  id: string
  masterId: string
  name: string
  specialization: string
  services: string[]
  status: 'AVAILABLE' | 'BUSY' | 'SOON'
  nextWindow: string
  phone: string
}

export interface PresentationSalonProfile {
  id: string
  name: string
  district: string
  address: string
  city: string
  postalCode: string
  phone: string
  workHours: string
  description: string
  rating: number
  reviewCount: number
  distanceKm: number
  latitude: number
  longitude: number
  ownerId: string
  editableByUserIds: string[]
  photos: string[]
  services: PresentationSalonService[]
  staff: PresentationSalonStaff[]
}

export interface PresentationHomeVisitService {
  id: string
  name: string
  durationMinutes: number
  servicePrice: number
}

export interface PresentationMasterProfile {
  id: string
  displayName: string
  role: string
  biography: string
  district: string
  addressHint: string
  phone: string
  experienceYears: number
  rating: number
  reviewCount: number
  distanceKm: number
  latitude: number
  longitude: number
  visitFee: number
  acceptsHomeVisits: boolean
  availabilityStatus: string
  nextWindow: string
  avatar: string
  services: PresentationHomeVisitService[]
  todaySchedule: Array<{ time: string; state: 'busy' | 'free' }>
}

const presentationSalons: Record<string, PresentationSalonProfile> = {
  'demo-atelier-royal': {
    id: 'demo-atelier-royal',
    name: 'PickMe Atelier Royal',
    district: 'Ludwigslust Zentrum',
    address: 'Schlossstrasse 14, 19288 Ludwigslust',
    city: 'Ludwigslust',
    postalCode: '19288',
    phone: '+49 3874 555 120',
    workHours: 'Mo-Sa 09:00 - 20:00',
    description: 'Premium-Salon für Schnitt, Farbe und Styling im Zentrum von Ludwigslust.',
    rating: 4.9,
    reviewCount: 128,
    distanceKm: 0.6,
    latitude: 53.3254,
    longitude: 11.4964,
    ownerId: 'demo-owner-atelier',
    editableByUserIds: ['demo-admin-atelier', 'demo-manager-atelier'],
    photos: [
      'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=960&q=80',
      'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=960&q=80',
      'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&w=960&q=80',
    ],
    services: [
      { id: 'atelier-men-cut', name: 'Herrenhaarschnitt', durationMinutes: 30, priceLabel: '25 €', basePrice: 25 },
      { id: 'atelier-women-cut', name: 'Damenhaarschnitt', durationMinutes: 45, priceLabel: '39 €', basePrice: 39 },
      { id: 'atelier-cut-beard', name: 'Schnitt und Bart', durationMinutes: 45, priceLabel: '35 €', basePrice: 35 },
      { id: 'atelier-color', name: 'Coloration', durationMinutes: 120, priceLabel: 'ab 79 €', basePrice: 79 },
      { id: 'atelier-styling', name: 'Styling', durationMinutes: 40, priceLabel: '30 €', basePrice: 30 },
      { id: 'atelier-balayage', name: 'Balayage', durationMinutes: 180, priceLabel: 'ab 129 €', basePrice: 129 },
    ],
    staff: [
      {
        id: 'atelier-staff-anna',
        masterId: 'demo-anna',
        name: 'Anna Kovalenko',
        specialization: 'Damenhaarschnitte, Coloration, Balayage',
        services: ['atelier-women-cut', 'atelier-color', 'atelier-balayage', 'atelier-styling'],
        status: 'AVAILABLE',
        nextWindow: 'Jetzt frei',
        phone: '+49 3874 555 311',
      },
      {
        id: 'atelier-staff-maria',
        masterId: 'demo-maria',
        name: 'Maria Wolf',
        specialization: 'Styling und Brautfrisuren',
        services: ['atelier-styling', 'atelier-women-cut'],
        status: 'BUSY',
        nextWindow: 'In 20 Minuten frei',
        phone: '+49 3874 555 318',
      },
      {
        id: 'atelier-staff-alex',
        masterId: 'demo-alex',
        name: 'Alex Braun',
        specialization: 'Herrenhaarschnitte und Bartpflege',
        services: ['atelier-men-cut', 'atelier-cut-beard'],
        status: 'SOON',
        nextWindow: 'Nächstes Fenster in 1 Stunde',
        phone: '+49 3874 555 319',
      },
    ],
  },
  'demo-nordic-cut': {
    id: 'demo-nordic-cut',
    name: 'PickMe Nordic Cut House',
    district: 'Ludwigslust Nord',
    address: 'Bahnhofstrasse 6, 19288 Ludwigslust',
    city: 'Ludwigslust',
    postalCode: '19288',
    phone: '+49 3874 555 240',
    workHours: 'Mo-So 10:00 - 21:00',
    description: 'Moderner Barbershop und Family-Cut-Spot nahe dem Bahnhof.',
    rating: 4.8,
    reviewCount: 94,
    distanceKm: 1.2,
    latitude: 53.3267,
    longitude: 11.5006,
    ownerId: 'demo-owner-nordic',
    editableByUserIds: ['demo-admin-nordic'],
    photos: [
      'https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?auto=format&fit=crop&w=960&q=80',
      'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=960&q=80',
      'https://images.unsplash.com/photo-1559599101-f09722fb4948?auto=format&fit=crop&w=960&q=80',
    ],
    services: [
      { id: 'nordic-men-cut', name: 'Herrenhaarschnitt', durationMinutes: 30, priceLabel: '27 €', basePrice: 27 },
      { id: 'nordic-women-cut', name: 'Damenhaarschnitt', durationMinutes: 45, priceLabel: '41 €', basePrice: 41 },
      { id: 'nordic-cut-beard', name: 'Schnitt und Bart', durationMinutes: 45, priceLabel: '37 €', basePrice: 37 },
      { id: 'nordic-color', name: 'Coloration', durationMinutes: 120, priceLabel: 'ab 82 €', basePrice: 82 },
      { id: 'nordic-styling', name: 'Styling', durationMinutes: 40, priceLabel: '32 €', basePrice: 32 },
      { id: 'nordic-balayage', name: 'Balayage', durationMinutes: 180, priceLabel: 'ab 134 €', basePrice: 134 },
    ],
    staff: [
      {
        id: 'nordic-staff-lena',
        masterId: 'demo-lena',
        name: 'Lena Ritter',
        specialization: 'Kurze Damenhaarschnitte und Styling',
        services: ['nordic-women-cut', 'nordic-styling'],
        status: 'AVAILABLE',
        nextWindow: 'Jetzt frei',
        phone: '+49 3874 555 351',
      },
      {
        id: 'nordic-staff-tom',
        masterId: 'demo-tom',
        name: 'Thomas Hagen',
        specialization: 'Fade, Bart und Herrenpflege',
        services: ['nordic-men-cut', 'nordic-cut-beard'],
        status: 'BUSY',
        nextWindow: 'In 35 Minuten frei',
        phone: '+49 3874 555 352',
      },
      {
        id: 'nordic-staff-sofia',
        masterId: 'demo-sofia',
        name: 'Sofia Lehmann',
        specialization: 'Coloration und Balayage',
        services: ['nordic-color', 'nordic-balayage'],
        status: 'SOON',
        nextWindow: 'Nächstes Fenster in 50 Minuten',
        phone: '+49 3874 555 353',
      },
    ],
  },
}

export const presentationMasters: Record<string, PresentationMasterProfile> = {
  'demo-zuhause': {
    id: 'demo-zuhause',
    displayName: 'PickMe Demo Zuhause',
    role: 'Haarschnitt zuhause · Styling · Beratung',
    biography: 'Demo-Profil für Zuhause-Bookings. Dieses Profil ist für die Präsentation und E2E-Tests vorgesehen.',
    district: 'Ludwigslust Zentrum',
    addressHint: 'Musterstrasse 12, 19288 Ludwigslust',
    phone: '+49 3874 555 399',
    experienceYears: 8,
    rating: 4.9,
    reviewCount: 92,
    distanceKm: 0.7,
    latitude: 53.3251,
    longitude: 11.4938,
    visitFee: 8,
    acceptsHomeVisits: true,
    availabilityStatus: 'Jetzt frei',
    nextWindow: 'Nächstes Fenster in 10 Minuten',
    avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80',
    services: [
      { id: 'home-demo-cut', name: 'Haarschnitt zuhause', durationMinutes: 60, servicePrice: 46 },
      { id: 'home-demo-styling', name: 'Styling', durationMinutes: 45, servicePrice: 38 },
      { id: 'home-demo-nails', name: 'Nägel', durationMinutes: 70, servicePrice: 49 },
      { id: 'home-demo-visit', name: 'Hausbesuch', durationMinutes: 20, servicePrice: 20 },
      { id: 'home-demo-consulting', name: 'Beratung', durationMinutes: 30, servicePrice: 25 },
    ],
    todaySchedule: [
      { time: '12:30', state: 'free' },
      { time: '14:00', state: 'busy' },
      { time: '16:30', state: 'free' },
    ],
  },
  'demo-anna': {
    id: 'demo-anna',
    displayName: 'Anna Kovalenko',
    role: 'Damenhaarschnitte · Coloration · Balayage',
    biography: 'Arbeitet im PickMe Atelier Royal und kommt auch direkt zu Ihnen nach Hause.',
    district: 'Ludwigslust Zentrum',
    addressHint: 'Musterstrasse 12, 19288 Ludwigslust',
    phone: '+49 3874 555 311',
    experienceYears: 9,
    rating: 4.9,
    reviewCount: 87,
    distanceKm: 0.9,
    latitude: 53.3259,
    longitude: 11.4948,
    visitFee: 8,
    acceptsHomeVisits: true,
    availabilityStatus: 'Jetzt frei',
    nextWindow: 'Nächstes Fenster in 10 Minuten',
    avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&q=80',
    services: [
      { id: 'home-women-cut', name: 'Damenhaarschnitt', durationMinutes: 45, servicePrice: 45 },
      { id: 'home-color', name: 'Coloration', durationMinutes: 120, servicePrice: 89 },
      { id: 'home-balayage', name: 'Balayage', durationMinutes: 180, servicePrice: 139 },
    ],
    todaySchedule: [
      { time: '13:30', state: 'free' },
      { time: '15:00', state: 'busy' },
      { time: '17:10', state: 'free' },
    ],
  },
  'demo-maria': {
    id: 'demo-maria',
    displayName: 'Maria Wolf',
    role: 'Styling · Brautfrisuren',
    biography: 'Spezialistin für Event-Styling und Abendlooks.',
    district: 'Ludwigslust Nord',
    addressHint: 'Musterstrasse 12, 19288 Ludwigslust',
    phone: '+49 3874 555 318',
    experienceYears: 7,
    rating: 4.8,
    reviewCount: 58,
    distanceKm: 1.4,
    latitude: 53.3278,
    longitude: 11.5011,
    visitFee: 8,
    acceptsHomeVisits: true,
    availabilityStatus: 'Besetzt, in 20 Minuten frei',
    nextWindow: 'Nächstes Fenster um 14:40 Uhr',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80',
    services: [
      { id: 'home-styling', name: 'Styling', durationMinutes: 40, servicePrice: 30 },
      { id: 'home-women-cut', name: 'Damenhaarschnitt', durationMinutes: 45, servicePrice: 45 },
    ],
    todaySchedule: [
      { time: '14:40', state: 'free' },
      { time: '16:00', state: 'busy' },
      { time: '18:20', state: 'free' },
    ],
  },
  'demo-alex': {
    id: 'demo-alex',
    displayName: 'Alex Braun',
    role: 'Herrenhaarschnitte · Bart',
    biography: 'Barber mit Fokus auf Fade und Bartpflege.',
    district: 'Ludwigslust Sud',
    addressHint: 'Musterstrasse 12, 19288 Ludwigslust',
    phone: '+49 3874 555 319',
    experienceYears: 11,
    rating: 4.7,
    reviewCount: 44,
    distanceKm: 2.1,
    latitude: 53.3194,
    longitude: 11.4842,
    visitFee: 8,
    acceptsHomeVisits: true,
    availabilityStatus: 'Nächstes Fenster in 1 Stunde',
    nextWindow: 'Frei ab 16:05 Uhr',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=900&q=80',
    services: [
      { id: 'home-men-cut', name: 'Herrenhaarschnitt', durationMinutes: 30, servicePrice: 29 },
      { id: 'home-cut-beard', name: 'Schnitt und Bart', durationMinutes: 45, servicePrice: 39 },
    ],
    todaySchedule: [
      { time: '16:05', state: 'free' },
      { time: '17:30', state: 'busy' },
      { time: '19:00', state: 'free' },
    ],
  },
  'demo-lena': {
    id: 'demo-lena',
    displayName: 'Lena Ritter',
    role: 'Kurze Haarschnitte · Styling',
    biography: 'Arbeitet im Nordic Cut House.',
    district: 'Ludwigslust Nord',
    addressHint: 'Musterstrasse 12, 19288 Ludwigslust',
    phone: '+49 3874 555 351',
    experienceYears: 6,
    rating: 4.8,
    reviewCount: 36,
    distanceKm: 1.1,
    latitude: 53.3293,
    longitude: 11.5034,
    visitFee: 8,
    acceptsHomeVisits: true,
    availabilityStatus: 'Jetzt frei',
    nextWindow: 'Jetzt frei',
    avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80',
    services: [
      { id: 'home-women-cut', name: 'Damenhaarschnitt', durationMinutes: 45, servicePrice: 46 },
      { id: 'home-styling', name: 'Styling', durationMinutes: 40, servicePrice: 31 },
    ],
    todaySchedule: [
      { time: '12:40', state: 'free' },
      { time: '14:30', state: 'busy' },
      { time: '18:10', state: 'free' },
    ],
  },
  'demo-tom': {
    id: 'demo-tom',
    displayName: 'Thomas Hagen',
    role: 'Barber · Fade · Bart',
    biography: 'Barber-Pro im Nordic Cut House.',
    district: 'Ludwigslust Nord',
    addressHint: 'Musterstrasse 12, 19288 Ludwigslust',
    phone: '+49 3874 555 352',
    experienceYears: 8,
    rating: 4.8,
    reviewCount: 49,
    distanceKm: 1.5,
    latitude: 53.3312,
    longitude: 11.5078,
    visitFee: 9,
    acceptsHomeVisits: true,
    availabilityStatus: 'Besetzt, in 35 Minuten frei',
    nextWindow: 'Fenster um 15:10 Uhr',
    avatar: 'https://images.unsplash.com/photo-1552058544-f2b08422138a?auto=format&fit=crop&w=900&q=80',
    services: [
      { id: 'home-men-cut', name: 'Herrenhaarschnitt', durationMinutes: 30, servicePrice: 31 },
      { id: 'home-cut-beard', name: 'Schnitt und Bart', durationMinutes: 45, servicePrice: 41 },
    ],
    todaySchedule: [
      { time: '15:10', state: 'free' },
      { time: '16:40', state: 'busy' },
      { time: '19:20', state: 'free' },
    ],
  },
  'demo-sofia': {
    id: 'demo-sofia',
    displayName: 'Sofia Lehmann',
    role: 'Colorist · Balayage',
    biography: 'Color-Spezialistin im Nordic Cut House.',
    district: 'Ludwigslust Ost',
    addressHint: 'Musterstrasse 12, 19288 Ludwigslust',
    phone: '+49 3874 555 353',
    experienceYears: 10,
    rating: 4.9,
    reviewCount: 63,
    distanceKm: 2.2,
    latitude: 53.3145,
    longitude: 11.4805,
    visitFee: 9,
    acceptsHomeVisits: true,
    availabilityStatus: 'Nächstes Fenster in 50 Minuten',
    nextWindow: 'Frei ab 16:20 Uhr',
    avatar: 'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=900&q=80',
    services: [
      { id: 'home-color', name: 'Coloration', durationMinutes: 120, servicePrice: 92 },
      { id: 'home-balayage', name: 'Balayage', durationMinutes: 180, servicePrice: 142 },
    ],
    todaySchedule: [
      { time: '16:20', state: 'free' },
      { time: '17:50', state: 'busy' },
      { time: '20:00', state: 'free' },
    ],
  },
}

function mergeUniqueById(items: NearbyCatalogItem[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

function toNearbySalon(profile: PresentationSalonProfile): NearbyCatalogItem {
  const availableCount = profile.staff.filter((item) => item.status === 'AVAILABLE').length
  const busyCount = profile.staff.filter((item) => item.status === 'BUSY').length

  return {
    id: `pickme-salon:${profile.id}`,
    source: 'PICKME',
    name: profile.name,
    category: 'hair_salon',
    address: profile.address,
    latitude: profile.latitude,
    longitude: profile.longitude,
    distanceKm: profile.distanceKm,
    rating: profile.rating,
    reviewCount: profile.reviewCount,
    openNow: true,
    photoUrl: profile.photos[0] ?? null,
    externalUrl: null,
    phone: profile.phone,
    isPickmeConnected: true,
    isBookable: true,
    isVerified: true,
    mastersOnShift: profile.staff.length,
    availableMasters: availableCount,
    busyMasters: busyCount,
    nextAvailableSlot: new Date(Date.now() + 20 * 60_000).toISOString(),
    minPrice: Math.min(...profile.services.map((service) => service.basePrice)),
    onlineBookingAvailable: true,
  }
}

function toNearbyMaster(profile: PresentationMasterProfile): NearbyCatalogItem {
  const isDemo = profile.id === 'demo-zuhause' || profile.id === 'demo-anna' || profile.id === 'demo-maria' || profile.id === 'demo-alex'

  return {
    id: `pickme-master:${profile.id}`,
    source: 'PICKME',
    name: profile.displayName,
    category: profile.role,
    address: profile.district,
    latitude: PRESENTATION_DEFAULT_LOCATION.latitude,
    longitude: PRESENTATION_DEFAULT_LOCATION.longitude,
    distanceKm: profile.distanceKm,
    rating: profile.rating,
    reviewCount: profile.reviewCount,
    openNow: true,
    photoUrl: profile.avatar,
    externalUrl: null,
    phone: profile.phone,
    isPickmeConnected: true,
    isBookable: true,
    isVerified: true,
    mastersOnShift: null,
    availableMasters: null,
    busyMasters: null,
    nextAvailableSlot: new Date(Date.now() + 15 * 60_000).toISOString(),
    minPrice: Math.min(...profile.services.map((service) => service.servicePrice)),
    onlineBookingAvailable: true,
    profileFlags: {
      isDemoProfile: isDemo,
      labels: isDemo ? ['Demo-Profil'] : [],
      isIndependentProvider: true,
    },
  }
}

export const nearbyPresentationSalons = Object.values(presentationSalons).map(toNearbySalon)
export const nearbyPresentationMasters = Object.values(presentationMasters)
  .filter((master) => ['demo-zuhause', 'demo-anna', 'demo-maria', 'demo-alex'].includes(master.id))
  .map(toNearbyMaster)

export function withPresentationNearbyData(
  sourceItems: NearbyCatalogItem[],
  entityFilter: 'SALON' | 'MASTER' | 'ALL',
) {
  if (!PRESENTATION_MODE) return sourceItems

  if (entityFilter === 'MASTER') {
    return mergeUniqueById([...nearbyPresentationMasters, ...sourceItems])
  }

  return mergeUniqueById([...nearbyPresentationSalons, ...sourceItems])
}

export function getPresentationSalonById(salonId: string) {
  return presentationSalons[salonId]
}

export function getPresentationMasterById(masterId: string) {
  return presentationMasters[masterId]
}

export function getPresentationSalonSummary(salonId: string): SalonSummary | null {
  const salon = presentationSalons[salonId]
  if (!salon) return null

  return {
    id: salon.id,
    name: salon.name,
    description: salon.description,
    sourceType: 'PICKME',
    addressLine: salon.address,
    city: salon.city,
    postalCode: salon.postalCode,
    ratingAverage: salon.rating,
    reviewCount: salon.reviewCount,
    homeVisitEnabled: false,
    phone: salon.phone,
    latitude: salon.latitude,
    longitude: salon.longitude,
    isVerified: true,
    photos: salon.photos.map((imageUrl, index) => ({
      id: `${salon.id}-photo-${index}`,
      imageUrl,
      sortOrder: index,
    })),
  }
}

export function getPresentationSalonServices(salonId: string): ServiceSummary[] {
  const salon = presentationSalons[salonId]
  if (!salon) return []

  return salon.services.map((item) => ({
    id: item.id,
    name: item.name,
    description: `${item.durationMinutes} Min.`,
    category: 'hair',
    basePrice: item.basePrice,
    durationMinutes: item.durationMinutes,
    availableInSalon: true,
    availableAtHome: false,
    isActive: true,
  }))
}

export function getPresentationSalonMasters(salonId: string, serviceId?: string): MasterSummary[] {
  const salon = presentationSalons[salonId]
  if (!salon) return []

  const filteredStaff = serviceId
    ? salon.staff.filter((staff) => staff.services.includes(serviceId))
    : salon.staff

  return filteredStaff.map((staff) => ({
    id: staff.masterId,
    displayName: staff.name,
    currentStatus:
      staff.status === 'AVAILABLE'
        ? 'AVAILABLE'
        : staff.status === 'BUSY'
          ? 'BUSY'
          : 'SOON_AVAILABLE',
    availableAt: null,
    minutesUntilAvailable: null,
    specialization: staff.specialization,
    biography: `Arbeitet im ${salon.name}`,
    experienceYears: 7,
    ratingAverage: salon.rating,
    reviewCount: salon.reviewCount,
    acceptsHomeVisits: true,
    salon: {
      id: salon.id,
      name: salon.name,
    },
  }))
}

function timeFromSlot(date: string, hhmm: string) {
  const [hours, minutes] = hhmm.split(':').map(Number)
  const value = new Date(`${date}T00:00:00`)
  value.setHours(hours, minutes, 0, 0)
  return value.toISOString()
}

export function getPresentationSalonSlots(params: {
  salonId: string
  serviceId: string
  date: string
  masterId?: string
}) {
  const masters = getPresentationSalonMasters(params.salonId, params.serviceId)
  if (!masters.length) return []

  const baseSlots = ['10:00', '11:15', '13:30', '15:00', '17:15', '18:30']

  if (params.masterId) {
    return baseSlots.map((slot) => ({
      startsAt: timeFromSlot(params.date, slot),
      availableMasterIds: [params.masterId as string],
    }))
  }

  return baseSlots.map((slot, index) => ({
    startsAt: timeFromSlot(params.date, slot),
    availableMasterIds: [masters[index % masters.length].id],
  }))
}

export function getPresentationHomeSlots(date: string) {
  const slots = ['09:30', '11:00', '13:15', '15:40', '18:10']
  return slots.map((slot) => timeFromSlot(date, slot))
}

const presentationDistanceByMasterAndAddress: Record<string, Record<string, number>> = {
  'demo-anna': {
    'demo-home-address-1': 8,
    'demo-home-address-2': 3,
    'demo-home-address-3': 15,
  },
  'demo-maria': {
    'demo-home-address-1': 6,
    'demo-home-address-2': 8,
    'demo-home-address-3': 4,
  },
  'demo-alex': {
    'demo-home-address-1': 10,
    'demo-home-address-2': 5,
    'demo-home-address-3': 12,
  },
  'demo-lena': {
    'demo-home-address-1': 7,
    'demo-home-address-2': 4,
    'demo-home-address-3': 9,
  },
  'demo-tom': {
    'demo-home-address-1': 11,
    'demo-home-address-2': 6,
    'demo-home-address-3': 10,
  },
  'demo-sofia': {
    'demo-home-address-1': 14,
    'demo-home-address-2': 8,
    'demo-home-address-3': 13,
  },
}

export function getPresentationHomeAddressOptions(masterId: string) {
  return presentationHomeAddresses.map((address) => ({
    ...address,
    demoDistanceKm:
      presentationDistanceByMasterAndAddress[masterId]?.[address.id] ??
      presentationDistanceByMasterAndAddress['demo-anna']['demo-home-address-1'],
  }))
}

export function getPresentationDefaultHomeAddressId() {
  return presentationHomeAddresses[0]?.id ?? 'demo-home-address-1'
}

export function calculatePresentationTravelFee(distanceKm: number) {
  const roundedDistanceKm = Math.max(0, Number(distanceKm.toFixed(2)))
  const calculated = roundedDistanceKm * 2 * 0.5
  return Number(Math.max(5, calculated).toFixed(2))
}

export function buildPresentationBookingNumber() {
  const random = Math.floor(10_000 + Math.random() * 89_999)
  return `PM-2026-${random}`
}
