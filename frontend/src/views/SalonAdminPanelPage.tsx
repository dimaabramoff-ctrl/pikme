import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { bookingApi } from '../features/bookings/api/bookingApi'
import { useCurrentUser } from '../features/auth/hooks/useCurrentUser'
import { adminBookingsApi } from '../features/bookings/api/adminBookingsApi'

function formatBookingStatus(status: string) {
  switch (status) {
    case 'pending':
      return 'Angefragt'
    case 'confirmed':
      return 'Bestätigt'
    case 'cancelled':
      return 'Storniert'
    case 'completed':
      return 'Abgeschlossen'
    case 'noShow':
      return 'No-show'
    case 'rejected':
      return 'Abgelehnt'
    default:
      return status
  }
}

const BUSINESS_TYPES = [
  'Friseursalon',
  'Barbershop',
  'mobiler Friseur',
  'Friseur zu Hause',
  'Nagelstudio',
  'Friseur + Nagelstudio',
]

const CLIENT_TYPES = ['Damen', 'Herren', 'Kinder', 'alle']

const HAIR_SERVICES = [
  'Beratung',
  'Waschen',
  'Schneiden',
  'Föhnen',
  'Styling',
  'Ansatzfarbe',
  'Komplettfärbung',
  'Tönung',
  'Blondierung',
  'Strähnen',
  'Balayage',
  'Dauerwelle',
  'Bart',
  'Augenbrauen',
  'Hochsteckfrisur',
  'Haarverlängerung',
  'Pflegebehandlung',
]

const NAIL_SERVICES = [
  'Maniküre',
  'Pediküre',
  'Gel',
  'Acryl',
  'Shellac',
  'Naturnagelverstärkung',
  'Verlängerung',
  'Auffüllen',
  'French',
  'Nail Art',
  'Reparatur',
  'Entfernen',
]

const BUSINESS_FEATURES = [
  'Parkplatz',
  'Barrierefrei',
  'Kartenzahlung',
  'WLAN',
  'Haustiere erlaubt',
  'Klimaanlage',
  'Privater Raum',
  'Hausbesuch',
  'Markenprodukte',
  'Beratung',
  'Mehrsprachig',
]

export function SalonAdminPanelPage() {
  const queryClient = useQueryClient()
  const [step, setStep] = useState(1)
  const { data: currentUser } = useCurrentUser()
  const salonId = currentUser?.salonAdminProfile?.[0]?.salon?.id
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['bookings', 'salon', salonId],
    queryFn: () => (salonId ? bookingApi.getSalonOrders(salonId) : Promise.resolve([])),
    enabled: Boolean(salonId),
  })
  const confirmMutation = useMutation({
    mutationFn: (bookingId: string) => adminBookingsApi.confirm(bookingId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bookings', 'salon', salonId] }),
  })
  const cancelMutation = useMutation({
    mutationFn: ({ bookingId, reason }: { bookingId: string; reason?: string }) => adminBookingsApi.cancel(bookingId, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bookings', 'salon', salonId] }),
  })
  const rejectMutation = useMutation({
    mutationFn: ({ bookingId, reason }: { bookingId: string; reason?: string }) => adminBookingsApi.reject(bookingId, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bookings', 'salon', salonId] }),
  })
  const completeMutation = useMutation({
    mutationFn: (bookingId: string) => adminBookingsApi.complete(bookingId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bookings', 'salon', salonId] }),
  })
  const noShowMutation = useMutation({
    mutationFn: (bookingId: string) => adminBookingsApi.noShow(bookingId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bookings', 'salon', salonId] }),
  })
  const [name, setName] = useState('Mein PickMe Salon')
  const [description, setDescription] = useState('Professioneller Service für Haar und Beauty.')
  const [businessType, setBusinessType] = useState(BUSINESS_TYPES[0])
  const [clientGroups, setClientGroups] = useState<string[]>(['Damen', 'Herren'])
  const [hairServices, setHairServices] = useState<string[]>(['Schneiden', 'Föhnen'])
  const [nailServices, setNailServices] = useState<string[]>([])
  const [features, setFeatures] = useState<string[]>(['Kartenzahlung', 'WLAN'])

  const previewBadges = useMemo(() => {
    const lines = [businessType, ...clientGroups, ...features]
    return lines.slice(0, 3)
  }, [businessType, clientGroups, features])

  const toggle = (value: string, current: string[], setCurrent: (next: string[]) => void) => {
    if (current.includes(value)) {
      setCurrent(current.filter((item) => item !== value))
      return
    }
    setCurrent([...current, value])
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="rounded-[26px] border border-[#d6e2e4] bg-white p-4 shadow-[0_12px_24px_rgba(9,37,41,0.08)]">
        <div className="rounded-2xl border border-[#d6e2e4] bg-[#f7fbfb] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[#12343c]">Buchungen für meinen Salon</h2>
              <p className="text-sm text-[#566d73]">Kurzsichtiger Owner-Workflow für lokale Tests: sofort sichtbare Buchungen mit Basis-Aktionen.</p>
            </div>
            <span className="rounded-full bg-[#17666D] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-white">
              {bookings.length} offen
            </span>
          </div>

          {isLoading ? (
            <p className="mt-3 text-sm text-[#566d73]">Buchungen werden geladen…</p>
          ) : bookings.length === 0 ? (
            <p className="mt-3 text-sm text-[#566d73]">Noch keine Buchungen für diesen Salon.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {bookings.map((booking) => (
                <div key={booking.id} className="rounded-2xl border border-[#d6e2e4] bg-white p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-[#12343c]">{booking.customerName}</p>
                      <p className="text-[#566d73]">{booking.serviceName} · {booking.masterName}</p>
                      <p className="text-[#566d73]">{new Date(booking.startsAt).toLocaleString('de-DE')}</p>
                      <p className="text-[#566d73]">{booking.totalPrice} {booking.currency}</p>
                    </div>
                    <span className="rounded-full bg-[#edf5f5] px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#17666D]">
                      {formatBookingStatus(booking.status)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className="rounded-xl bg-[#17666D] px-3 py-2 text-sm font-semibold text-white" onClick={() => confirmMutation.mutate(booking.id)}>
                      Bestätigen
                    </button>
                    <button type="button" className="rounded-xl border border-[#d6e2e4] px-3 py-2 text-sm font-semibold text-[#12343c]" onClick={() => rejectMutation.mutate({ bookingId: booking.id, reason: 'Anfrage abgelehnt' })}>
                      Ablehnen
                    </button>
                    <button type="button" className="rounded-xl border border-[#d6e2e4] px-3 py-2 text-sm font-semibold text-[#12343c]" onClick={() => cancelMutation.mutate({ bookingId: booking.id, reason: 'Test-Flow' })}>
                      Absagen
                    </button>
                    <button type="button" className="rounded-xl border border-[#d6e2e4] px-3 py-2 text-sm font-semibold text-[#12343c]" onClick={() => completeMutation.mutate(booking.id)}>
                      Abschließen
                    </button>
                    <button type="button" className="rounded-xl border border-[#d6e2e4] px-3 py-2 text-sm font-semibold text-[#12343c]" onClick={() => noShowMutation.mutate(booking.id)}>
                      No-Show
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <h1 className="text-xl font-semibold text-[#12343c]">PickMe Profil-Editor</h1>
        <p className="mt-1 text-sm text-[#566d73]">Strukturierter Wizard mit Live-Vorschau. Die Standardkarte bleibt immer im PickMe-Format.</p>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {[1, 2, 3, 4, 5, 6, 7].map((index) => (
            <button
              key={index}
              type="button"
              onClick={() => setStep(index)}
              className={`rounded-full px-3 py-1.5 font-semibold ${step === index ? 'bg-[#17666D] text-white' : 'border border-[#d6e2e4] text-[#4f666c]'}`}
            >
              Schritt {index}
            </button>
          ))}
        </div>

        {step === 1 ? (
          <div className="mt-4 space-y-2">
            <h2 className="text-sm font-semibold text-[#173a42]">1. Typ des Betriebs</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {BUSINESS_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setBusinessType(type)}
                  className={`rounded-xl border px-3 py-2 text-left text-sm ${businessType === type ? 'border-[#17666D] bg-[#edf5f5]' : 'border-[#d9e3e5]'}`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="mt-4 space-y-2">
            <h2 className="text-sm font-semibold text-[#173a42]">2. Zielgruppe</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {CLIENT_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggle(type, clientGroups, setClientGroups)}
                  className={`rounded-xl border px-3 py-2 text-left text-sm ${clientGroups.includes(type) ? 'border-[#17666D] bg-[#edf5f5]' : 'border-[#d9e3e5]'}`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <h2 className="text-sm font-semibold text-[#173a42]">3. Hair Services</h2>
              <div className="mt-2 grid gap-2">
                {HAIR_SERVICES.map((service) => (
                  <button
                    key={service}
                    type="button"
                    onClick={() => toggle(service, hairServices, setHairServices)}
                    className={`rounded-xl border px-3 py-2 text-left text-sm ${hairServices.includes(service) ? 'border-[#17666D] bg-[#edf5f5]' : 'border-[#d9e3e5]'}`}
                  >
                    {service}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-[#173a42]">Nail Services</h2>
              <div className="mt-2 grid gap-2">
                {NAIL_SERVICES.map((service) => (
                  <button
                    key={service}
                    type="button"
                    onClick={() => toggle(service, nailServices, setNailServices)}
                    className={`rounded-xl border px-3 py-2 text-left text-sm ${nailServices.includes(service) ? 'border-[#17666D] bg-[#edf5f5]' : 'border-[#d9e3e5]'}`}
                  >
                    {service}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="mt-4 space-y-2">
            <h2 className="text-sm font-semibold text-[#173a42]">4. Varianten und Optionen</h2>
            <p className="text-sm text-[#5f7378]">Standardisierte Optionen werden automatisch pro Servicegruppe aktiviert (Haarlänge, Farben, Material, Zusatzdesign).</p>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="mt-4 space-y-2">
            <h2 className="text-sm font-semibold text-[#173a42]">5. Preise und Dauer</h2>
            <p className="text-sm text-[#5f7378]">Für jede gewählte Leistung werden fixe Preise oder „ab“-Preise sowie Dauer in Minuten gepflegt.</p>
          </div>
        ) : null}

        {step === 6 ? (
          <div className="mt-4 space-y-2">
            <h2 className="text-sm font-semibold text-[#173a42]">6. Team</h2>
            <p className="text-sm text-[#5f7378]">Mitarbeiter werden als Karten mit Spezialisierung, Sprachen und Arbeitstagen gepflegt.</p>
          </div>
        ) : null}

        {step === 7 ? (
          <div className="mt-4 space-y-2">
            <h2 className="text-sm font-semibold text-[#173a42]">7. Business-Informationen</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {BUSINESS_FEATURES.map((feature) => (
                <button
                  key={feature}
                  type="button"
                  onClick={() => toggle(feature, features, setFeatures)}
                  className={`rounded-xl border px-3 py-2 text-left text-sm ${features.includes(feature) ? 'border-[#17666D] bg-[#edf5f5]' : 'border-[#d9e3e5]'}`}
                >
                  {feature}
                </button>
              ))}
            </div>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#60777d]">Salonname</span>
              <input value={name} onChange={(event) => setName(event.target.value)} className="field-input mt-1" />
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#60777d]">Kurze Beschreibung</span>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} className="field-input mt-1 min-h-20" />
            </label>
          </div>
        ) : null}
      </div>

      <aside className="rounded-[26px] border border-[#d6e2e4] bg-white p-4 shadow-[0_12px_24px_rgba(9,37,41,0.08)]">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#60777d]">Live Preview</h2>

        <article className="mt-3 overflow-hidden rounded-[22px] border border-[#d9e3e5] bg-white shadow-[0_10px_22px_rgba(9,37,41,0.08)]">
          <div className="grid gap-0">
            <div className="h-36 bg-gradient-to-br from-[#dde9ea] via-[#f2f6f6] to-[#e7efe8]" />
            <div className="space-y-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="line-clamp-1 text-[16px] font-semibold text-[#132a31]">{name}</h3>
                  <p className="text-xs text-[#5a7075]">{businessType}</p>
                </div>
                <span className="rounded-full bg-[#124753] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#f8f6f0]">
                  PickMe Partner
                </span>
              </div>
              <p className="line-clamp-2 text-xs text-[#546a70]">{description}</p>
              <div className="flex flex-wrap gap-1.5">
                {previewBadges.map((badge) => (
                  <span key={badge} className="rounded-full bg-[#f2f7f7] px-2 py-1 text-[11px] text-[#3d5960]">
                    {badge}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </article>

        <p className="mt-3 text-xs text-[#5f7378]">Preview folgt immer dem PickMe Standard und verhindert Layout-Änderungen außerhalb des Systems.</p>
      </aside>
    </section>
  )
}
