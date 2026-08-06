import { ExternalLink, MapPin, MessageCircle, Navigation, Phone, Share2, ShieldCheck } from 'lucide-react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ClaimBusinessButton } from '../features/business-claims/ClaimBusinessButton'
import { ClaimBusinessModal, loadPendingClaim, type ClaimBusinessModalStep } from '../features/business-claims/ClaimBusinessModal'
import { useAuthStore } from '../features/auth/authStore'
import { SuperAdminModePanel } from '../shared/components/SuperAdminModePanel'
import { useAdminModeStore } from '../shared/store/adminModeStore'

interface ExternalSalonState {
  name?: string
  address?: string
  distanceKm?: string
  externalUrl?: string
  googlePlaceId?: string
  openNow?: string
  phone?: string
  website?: string
  category?: string
}

function formatDistance(value?: string | null) {
  if (!value) return 'In der Nähe'
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return 'In der Nähe'
  if (numeric < 1) return 'Weniger als 1 km'
  return `${numeric.toFixed(1)} km`
}

export function ExternalSalonDetailPage() {
  const { externalId } = useParams()
  const location = useLocation()
  const currentUser = useAuthStore((state) => state.currentUser)
  const adminModeEnabled = useAdminModeStore((state) => state.enabled)
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN'
  const isSuperAdminMode = currentUser?.role === 'SUPER_ADMIN' && adminModeEnabled
  const [searchParams] = useSearchParams()
  const [showClaimModal, setShowClaimModal] = useState(false)
  const [claimId, setClaimId] = useState<string | undefined>(undefined)
  const [resumeStep, setResumeStep] = useState<ClaimBusinessModalStep>('options')

  const state = (location.state as ExternalSalonState | null) ?? null
  const name = state?.name ?? searchParams.get('name') ?? 'Salon aus dem externen Verzeichnis'
  const address = state?.address ?? searchParams.get('address') ?? 'Adresse wird ergänzt'
  const distanceKm = state?.distanceKm ?? searchParams.get('distanceKm')
  const externalUrl = state?.externalUrl ?? state?.website ?? searchParams.get('externalUrl')
  const openNow = state?.openNow ?? searchParams.get('openNow')
  const googlePlaceId = state?.googlePlaceId ?? searchParams.get('googlePlaceId') ?? externalId
  const phone = state?.phone ?? searchParams.get('phone')
  const category = state?.category ?? searchParams.get('category') ?? 'Salon'
  const isTestbetrieb = (googlePlaceId ?? '').toLowerCase() === 'pickme-testbetrieb-berlin-001'

  const shareProfile = async () => {
    if (!navigator.share) return
    await navigator.share({
      title: name,
      text: `${name} auf PickMe`,
      url: window.location.href,
    })
  }

  const claimCard = (mobile = false) => (
    <section
      className={`rounded-[28px] border border-[#e8cfbf] bg-[#fff5ee] p-4 shadow-[0_16px_28px_rgba(145,88,44,0.08)] ${mobile ? 'lg:hidden' : 'hidden h-fit lg:block'}`}
      aria-label="Claim business"
    >
      <div className="inline-flex items-center rounded-full bg-[#fff1e6] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#935b38]">
        PickMe Claim
      </div>
      <h2 className="mt-3 text-lg font-semibold text-[#163740]">Ist das Ihr Unternehmen?</h2>
      <p className="mt-2 text-sm leading-6 text-[#6f4f3d]">
        Übernehmen Sie dieses Profil, verwalten Sie Termine und testen Sie PickMe 30 Tage kostenlos.
      </p>
      <div className="mt-4 space-y-2">
        <button
          type="button"
          onClick={() => {
            if (isSuperAdmin) return
            setShowClaimModal(true)
          }}
          className="w-full rounded-xl bg-[#17666D] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0f4d52]"
          disabled={isSuperAdmin}
        >
          30 Tage kostenlos testen
        </button>
        <ClaimBusinessButton
          googlePlaceId={googlePlaceId ?? undefined}
          salonName={name}
          isPickmePartner={false}
          onClaimClick={() => {
            if (isSuperAdmin) return
            setShowClaimModal(true)
          }}
          className="w-full justify-center"
          label="Profil übernehmen"
          variant="secondary"
        />
      </div>
      <p className="mt-3 text-xs text-[#8a5a39]">Die Übernahme ist erst nach Verifizierung möglich.</p>
    </section>
  )

  useEffect(() => {
    const pending = loadPendingClaim()
    if (!pending) return
    if (pending.googlePlaceId && pending.googlePlaceId !== googlePlaceId) return

    setClaimId(pending.claimId)
    setResumeStep(pending.pendingStep)
    setShowClaimModal(true)
  }, [googlePlaceId])

  return (
    <div className="space-y-4">
      {isSuperAdminMode && externalId ? (
        <SuperAdminModePanel
          entityType="Salon"
          entityId={externalId}
          title={`Admin actions for external profile ${name}`}
          canOpenOwnerEditor={false}
          canManageTrial={false}
          canResetDemo={isTestbetrieb}
          resetScope={isTestbetrieb ? 'TESTBETRIEB' : undefined}
          disableProfileActions
          onRefresh={async () => {
            window.location.reload()
          }}
          isActive
          isLocked={false}
        />
      ) : null}

      <section className="rounded-[30px] border border-[#cad6d9] bg-white p-4 shadow-[0_20px_34px_rgba(9,37,41,0.1)]">
        <Link to="/" className="text-sm font-semibold text-[#5e747a]">← Zurück</Link>
        <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <div className="inline-flex items-center rounded-full bg-[#eef2f3] px-3 py-1 text-xs font-semibold text-[#516a70]">
              Externes Unternehmensprofil
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-[#112e35]">{name}</h1>
              <p className="mt-1 text-sm text-[#5c6f74]">{category} auf PickMe mit verifizierten Fakten und klarer Übernahme-Option.</p>
            </div>

            <div className="grid gap-2 text-sm text-[#2c4046] sm:grid-cols-2">
              <span className="inline-flex items-center gap-1"><MapPin size={14} /> {address}</span>
              <span>{openNow ? (openNow === 'true' ? 'Aktuell geöffnet' : 'Aktuell geschlossen') : 'Öffnungsstatus nicht verfügbar'}</span>
              <span>Typ: {category}</span>
              <span>{phone ? `Telefon: ${phone}` : `Distanz: ${formatDistance(distanceKm)}`}</span>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              {phone ? (
                <a href={`tel:${phone.replace(/\s+/g, '')}`} className="btn-secondary inline-flex items-center gap-1" aria-label="Anrufen">
                  <Phone size={14} /> Anrufen
                </a>
              ) : null}
              {phone ? (
                <a
                  href={`https://wa.me/${phone.replace(/[^\d+]/g, '').replace('+', '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary inline-flex items-center gap-1"
                  aria-label="WhatsApp"
                >
                  <MessageCircle size={14} /> WhatsApp
                </a>
              ) : null}
              <button type="button" onClick={() => void shareProfile()} className="btn-secondary inline-flex items-center gap-1">
                <Share2 size={14} /> Teilen
              </button>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary inline-flex items-center gap-1"
              >
                <Navigation size={14} /> Route
              </a>
            </div>

            <div className="flex flex-wrap gap-2">
              <a href="#mehr-erfahren" className="btn-secondary">Mehr erfahren</a>
              {!isSuperAdmin ? <button type="button" onClick={() => setShowClaimModal(true)} className="btn-primary">Profil übernehmen</button> : null}
            </div>
          </div>

          {claimCard(false)}
        </div>
      </section>

      {claimCard(true)}

      <section className="rounded-[24px] border border-[#e4d3c8] bg-[#fff7f1] p-4 text-sm text-[#8a5a39]">
        Dieser Salon ist noch nicht mit PickMe verbunden. Online-Buchungen und Live-Verfügbarkeit sind daher noch nicht aktiv.
      </section>

      <section id="mehr-erfahren" className="rounded-[24px] border border-[#dce6e8] bg-white p-4 shadow-[0_10px_20px_rgba(9,37,41,0.05)]">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#516a70]">Mehr erfahren</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <article className="rounded-2xl bg-[#f7fbfb] p-3">
            <h3 className="text-sm font-semibold text-[#163740]">Über uns</h3>
            <p className="mt-1 text-sm text-[#52686f]">Dieser Eintrag basiert auf extern verfügbaren Fakten. Detaillierte Leistungen, Teamdaten und Online-Buchung werden nach einer PickMe-Verifizierung ergänzt.</p>
          </article>

          <article className="rounded-2xl bg-[#f7fbfb] p-3">
            <h3 className="text-sm font-semibold text-[#163740]">Adresse und Anfahrt</h3>
            <p className="mt-1 text-sm text-[#52686f]">{address}</p>
            <p className="mt-1 text-xs text-[#5f7378]">Entfernung: {formatDistance(distanceKm)}</p>
          </article>

          <article className="rounded-2xl bg-[#f7fbfb] p-3">
            <h3 className="text-sm font-semibold text-[#163740]">PickMe Bewertung</h3>
            <p className="mt-1 text-sm text-[#52686f]">
              Noch keine verifizierten PickMe-Bewertungen. Nur Kundinnen und Kunden mit einem abgeschlossenen PickMe-Termin können eine Bewertung abgeben.
            </p>
          </article>

          <article className="rounded-2xl bg-[#f7fbfb] p-3">
            <h3 className="text-sm font-semibold text-[#163740]">Status und Hinweise</h3>
            <p className="mt-1 text-sm text-[#52686f]">Für nicht verbundene Betriebe sind keine PickMe-Services, Preise, Teampläne oder Online-Slots sichtbar. Google-Daten werden nur als Faktenquelle verwendet.</p>
          </article>
        </div>
      </section>

      <section className="rounded-3xl border border-[#dce6e8] bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-[#14353e]">PickMe Vertrauen</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <article className="rounded-xl border border-[#dce8ea] bg-[#f8fbfc] p-3">
            <div className="inline-flex items-center gap-2 font-semibold text-[#163740]"><ShieldCheck size={16} /> Verifizierte Fakten</div>
            <p className="mt-1 text-xs text-[#5f7378]">Name, Adresse und Öffnungsstatus werden als sachliche Informationen angezeigt.</p>
          </article>
          <article className="rounded-xl border border-[#dce8ea] bg-[#f8fbfc] p-3">
            <div className="font-semibold text-[#163740]">Bewertungen erst nach Besuch</div>
            <p className="mt-1 text-xs text-[#5f7378]">PickMe verwendet keine externen Sterne als eigene Bewertung.</p>
          </article>
          <article className="rounded-xl border border-[#dce8ea] bg-[#f8fbfc] p-3">
            <div className="font-semibold text-[#163740]">Übernahme nur nach Verifizierung</div>
            <p className="mt-1 text-xs text-[#5f7378]">Ein Trial startet erst nach erfolgreicher Prüfung und Freigabe durch PickMe.</p>
          </article>
        </div>

        {externalUrl ? (
          <div className="mt-4">
            <a href={externalUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary inline-flex items-center gap-1">
              <ExternalLink size={14} /> Externe Quelle öffnen
            </a>
          </div>
        ) : null}
      </section>

      {!externalUrl && externalId ? (
        <div className="text-xs text-slate-500">Externe Salon-ID: {externalId}</div>
      ) : null}

      <ClaimBusinessModal
        isOpen={showClaimModal}
        onClose={() => setShowClaimModal(false)}
        googlePlaceId={googlePlaceId ?? undefined}
        salonName={name}
        address={address}
        claimId={claimId}
        initialStep={resumeStep}
        onClaimCreated={(id) => setClaimId(id)}
      />
    </div>
  )
}
