import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

const adminContactEmail = import.meta.env.VITE_ADMIN_CONTACT_EMAIL as string | undefined
const adminWhatsappNumber = import.meta.env.VITE_ADMIN_WHATSAPP_NUMBER as string | undefined
import { Link } from 'react-router-dom'
import { adminBookingsApi } from '../features/bookings/api/adminBookingsApi'
import { masterAdminApi } from '../features/bookings/api/masterAdminApi'
import { notificationsApi } from '../features/notifications/api/notificationsApi'
import { voucherApi, type AdminVoucherType } from '../features/bookings/api/voucherApi'
import { businessClaimsApi, type BusinessClaimSummary } from '../features/business-claims/api'
import { apiClient } from '../shared/api/client'

export function MasterAdminPage() {
  const [type, setType] = useState<AdminVoucherType>('PARTNER_MONTH')
  const [durationDays, setDurationDays] = useState(14)
  const [comment, setComment] = useState('')
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [claimNoteMap, setClaimNoteMap] = useState<Record<string, string>>({})

  const vouchersQuery = useQuery({
    queryKey: ['master-admin', 'vouchers'],
    queryFn: voucherApi.list,
  })

  const createMutation = useMutation({
    mutationFn: voucherApi.createOne,
    onSuccess: (result) => {
      setCopiedCode(result.fullCode)
      void vouchersQuery.refetch()
    },
  })

  const revokeMutation = useMutation({
    mutationFn: voucherApi.revoke,
    onSuccess: () => {
      void vouchersQuery.refetch()
    },
  })

  const requestsQuery = useQuery({
    queryKey: ['master-admin', 'partner-requests'],
    queryFn: masterAdminApi.listRequests,
  })

  const requestStatusMutation = useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: string; reason?: string }) => masterAdminApi.updateRequestStatus(id, status, reason),
    onSuccess: () => {
      void requestsQuery.refetch()
    },
  })

  const accessCodeMutation = useMutation({
    mutationFn: (id: string) => masterAdminApi.createAccessCode(id),
    onSuccess: () => {
      void requestsQuery.refetch()
    },
  })

  const usersQuery = useQuery({
    queryKey: ['master-admin', 'users'],
    queryFn: masterAdminApi.listUsers,
  })

  const moderationMutation = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: string; reason?: string }) => masterAdminApi.moderateUser(id, action, reason),
    onSuccess: () => {
      void usersQuery.refetch()
    },
  })

  const roleMutation = useMutation({
    mutationFn: ({ id, role, reason }: { id: string; role: string; reason?: string }) => masterAdminApi.changeRole(id, role, reason),
    onSuccess: () => {
      void usersQuery.refetch()
    },
  })

  const bookingsQuery = useQuery({
    queryKey: ['master-admin', 'bookings'],
    queryFn: adminBookingsApi.list,
  })

  const bookingMutation = useMutation({
    mutationFn: async ({ bookingId, action, reason }: { bookingId: string; action: 'confirm' | 'cancel' | 'complete' | 'noShow' | 'reschedule'; reason?: string }) => {
      if (action === 'confirm') return adminBookingsApi.confirm(bookingId)
      if (action === 'cancel') return adminBookingsApi.cancel(bookingId, reason)
      if (action === 'complete') return adminBookingsApi.complete(bookingId)
      if (action === 'noShow') return adminBookingsApi.noShow(bookingId)
      const startsAt = window.prompt('Neue Startzeit im ISO-Format oder локal: 2026-08-06T15:40:00.000Z')
      if (!startsAt) return null
      return adminBookingsApi.reschedule(bookingId, startsAt, reason)
    },
    onSuccess: () => {
      void bookingsQuery.refetch()
    },
  })

  const notificationsQuery = useQuery({
    queryKey: ['master-admin', 'notifications'],
    queryFn: notificationsApi.list,
  })

  const unreadCountQuery = useQuery({
    queryKey: ['master-admin', 'notifications-unread'],
    queryFn: notificationsApi.unreadCount,
  })

  const notificationMutation = useMutation({
    mutationFn: (notificationId: string) => notificationsApi.markRead(notificationId),
    onSuccess: () => {
      void notificationsQuery.refetch()
      void unreadCountQuery.refetch()
    },
  })

  const resetMutation = useMutation({
    mutationFn: (reason?: string) => apiClient.request('/admin/test-data/reset', {
      method: 'POST',
      body: JSON.stringify({ confirm: true, reason }),
    }),
    onSuccess: async () => {
      await Promise.all([
        bookingsQuery.refetch(),
        claimsQuery.refetch(),
        requestsQuery.refetch(),
        usersQuery.refetch(),
        notificationsQuery.refetch(),
        unreadCountQuery.refetch(),
      ])
    },
  })

  const claimsQuery = useQuery({
    queryKey: ['master-admin', 'business-claims'],
    queryFn: businessClaimsApi.getAllClaimsAdmin,
  })

  const approveClaimMutation = useMutation({
    mutationFn: (claimId: string) =>
      apiClient.request(`/business-claims/${claimId}/approve`, { method: 'PATCH' }),
    onSuccess: () => { void claimsQuery.refetch() },
  })

  const rejectClaimMutation = useMutation({
    mutationFn: ({ claimId, reason }: { claimId: string; reason?: string }) =>
      apiClient.request(`/business-claims/${claimId}/reject`, { method: 'PATCH', body: JSON.stringify({ reason }) }),
    onSuccess: () => { void claimsQuery.refetch() },
  })

  const effectiveDuration = useMemo(() => {
    if (type === 'PARTNER_DAY') return 1
    if (type === 'PARTNER_MONTH') return 30
    if (type === 'PARTNER_YEAR') return 365
    return durationDays
  }, [durationDays, type])

  function claimStatusBadge(status: string) {
    const colors: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      APPROVED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
      REVOKED: 'bg-gray-100 text-gray-600',
      ACTIVE_TRIAL: 'bg-blue-100 text-blue-800',
      CODE_ISSUED: 'bg-purple-100 text-purple-700',
      VERIFICATION_REQUIRED: 'bg-orange-100 text-orange-800',
    }
    return `inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${colors[status] ?? 'bg-slate-100 text-slate-600'}`
  }

  function getContactMeta(claim: BusinessClaimSummary) {
    const m = claim.metadata as Record<string, unknown> | null | undefined
    if (!m) return null
    return {
      contactName: String(m.contactName ?? ''),
      contactEmail: String(m.contactEmail ?? ''),
      contactPhone: String(m.contactPhone ?? ''),
      contactRole: String(m.contactRole ?? ''),
      preferredContactMethod: String(m.preferredContactMethod ?? ''),
      verificationMethod: String(m.verificationMethod ?? ''),
      message: String(m.message ?? ''),
    }
  }

  return (
    <section className="space-y-4 rounded-[30px] border border-[#ccdcde] bg-white p-5 shadow-[0_24px_42px_rgba(9,37,41,0.11)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b8086]">PickMe Master Admin</p>
      <h1 className="text-2xl font-semibold text-[#0f2f37]">Plattformverwaltung</h1>

      <div className="grid gap-3 rounded-2xl border border-[#d7e3e6] bg-[#f8fbfc] p-3 md:grid-cols-3">
        <Link to="/partner/register" className="btn-secondary">Demo-Inhaber registrieren</Link>
        <Link to="/redeem" className="btn-secondary">Code aktivieren</Link>
        <Link to="/" className="btn-secondary">Startseite als Kunde öffnen</Link>
        <Link to="/master-admin/business-access-codes" className="btn-primary">Business-Zugangscodes →</Link>
      </div>

      <article className="space-y-3 rounded-2xl border border-[#d7e3e6] p-4">
        <h2 className="text-lg font-semibold text-[#193c45]">Gutscheincode-Generator</h2>
        <div className="grid gap-2 md:grid-cols-2">
          <label className="text-sm text-[#2d4a50]">
            Zugangstyp
            <select className="field-input mt-1" value={type} onChange={(e) => setType(e.target.value as AdminVoucherType)}>
              <option value="PARTNER_DAY">Zugang für 1 Tag</option>
              <option value="PARTNER_MONTH">Zugang für 1 Monat</option>
              <option value="PARTNER_YEAR">Zugang für 1 Jahr</option>
              <option value="PROMO_TRIAL">Demo Trial</option>
            </select>
          </label>

          {type === 'PROMO_TRIAL' ? (
            <label className="text-sm text-[#2d4a50]">
              Laufzeit (Tage)
              <input
                type="number"
                min={1}
                max={365}
                className="field-input mt-1"
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value) || 14)}
              />
            </label>
          ) : null}

          <label className="text-sm text-[#2d4a50] md:col-span-2">
            Admin-Kommentar
            <input className="field-input mt-1" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Zum Beispiel: Demo-Onboarding-Batch" />
          </label>
        </div>

        <button
          className="btn-primary"
          type="button"
          onClick={() => {
            void createMutation.mutateAsync({
              type,
              durationDays: effectiveDuration,
              maxRedemptions: 1,
              comment: comment || undefined,
            })
          }}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? 'Wird erstellt...' : 'Code erstellen'}
        </button>

        {createMutation.data ? (
          <div className="rounded-xl border border-[#d5e4e8] bg-[#f4fafc] p-3 text-sm text-[#1b3f48]">
            <p className="font-semibold">Code erstellt:</p>
            <p>{createMutation.data.fullCode}</p>
            <button
              type="button"
              className="btn-secondary mt-2"
              onClick={async () => {
                await navigator.clipboard.writeText(createMutation.data.fullCode)
                setCopiedCode(createMutation.data.fullCode)
              }}
            >
              Code kopieren
            </button>
            {copiedCode === createMutation.data.fullCode ? <p className="mt-1 text-xs">Kopiert</p> : null}
          </div>
        ) : null}
      </article>

      <article className="space-y-3 rounded-2xl border border-[#d7e3e6] p-4">
        <h2 className="text-lg font-semibold text-[#193c45]">Partnerzugangs-Anfragen</h2>
        {requestsQuery.isPending ? <p className="text-sm text-[#60777d]">Anfragen werden geladen...</p> : null}
        {requestsQuery.error ? <p className="text-sm text-[#9a3f2d]">Anfragen konnten nicht geladen werden.</p> : null}
        <div className="space-y-2">
          {(requestsQuery.data ?? []).map((request) => (
            <div key={request.id} className="rounded-xl border border-[#e0eaed] bg-[#fbfdfe] p-3 text-sm">
              <p className="font-semibold text-[#1f3f47]">{request.salonName} · {request.contactName}</p>
              <p className="text-[#5c7278]">{request.email} · {request.city} · {request.requestedDuration}</p>
              <p className="text-[#5c7278]">Status: {request.status}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="btn-secondary" type="button" onClick={() => void requestStatusMutation.mutateAsync({ id: request.id, status: 'CONTACTED', reason: 'Contacted via master admin' })}>Als CONTACTED markieren</button>
                <button className="btn-secondary" type="button" onClick={() => void requestStatusMutation.mutateAsync({ id: request.id, status: 'APPROVED', reason: 'Approved via master admin' })}>Genehmigen</button>
                <button className="btn-secondary" type="button" onClick={() => void requestStatusMutation.mutateAsync({ id: request.id, status: 'REJECTED', reason: 'Rejected via master admin' })}>Ablehnen</button>
                <button className="btn-secondary" type="button" onClick={() => window.open(`mailto:${adminContactEmail}?subject=${encodeURIComponent('PickMe Partner Access Request')}&body=${encodeURIComponent(`Hallo,\n\nich möchte meinen Salon mit PickMe verbinden.\n\nName: ${request.contactName}\nSalon: ${request.salonName}\nStadt: ${request.city}\nTelefon: ${request.phone}\nEmail: ${request.email}\nGewünschte Laufzeit: ${request.requestedDuration}\nKommentar: ${request.message ?? ''}`)}`)}>Email</button>
                <button className="btn-secondary" type="button" onClick={() => { if (adminWhatsappNumber) window.open(`https://wa.me/${adminWhatsappNumber}?text=${encodeURIComponent(`Hallo,\n\nich möchte meinen Salon mit PickMe verbinden.\n\nName: ${request.contactName}\nSalon: ${request.salonName}\nStadt: ${request.city}\nTelefon: ${request.phone}\nEmail: ${request.email}\nGewünschte Laufzeit: ${request.requestedDuration}\nKommentar: ${request.message ?? ''}`)}`) }}>WhatsApp</button>
                <button className="btn-secondary" type="button" onClick={() => void accessCodeMutation.mutateAsync(request.id)}>Code erstellen</button>
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className="space-y-3 rounded-2xl border border-[#d7e3e6] p-4">
        <h2 className="text-lg font-semibold text-[#193c45]">Unternehmensanfragen</h2>
        {claimsQuery.isPending ? <p className="text-sm text-[#60777d]">Anfragen werden geladen…</p> : null}
        {claimsQuery.isError ? <p className="text-sm text-[#9a3f2d]">Anfragen konnten nicht geladen werden.</p> : null}
        {claimsQuery.data?.length === 0 ? <p className="text-sm text-[#60777d]">Keine Anfragen vorhanden.</p> : null}
        <div className="space-y-3">
          {(claimsQuery.data ?? []).map((claim) => {
            const meta = getContactMeta(claim)
            return (
              <div key={claim.id} className="rounded-xl border border-[#e0eaed] bg-[#fbfdfe] p-3 text-sm space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-[#1f3f47]">{claim.salon?.name ?? 'Unbekanntes Unternehmen'}</span>
                  <span className={claimStatusBadge(claim.status)}>{claim.status}</span>
                </div>
                {claim.salon ? <p className="text-[#5c7278] text-xs">{claim.salon.addressLine} · {claim.salon.city}</p> : null}
                {claim.googlePlaceId ? <p className="text-[#5c7278] text-xs">Google Place ID: {claim.googlePlaceId}</p> : null}
                {meta ? (
                  <div className="rounded-xl bg-[#f6fafb] px-2 py-2 text-xs space-y-0.5">
                    {meta.contactName ? <p><span className="font-semibold">Antragsteller:</span> {meta.contactName} {meta.contactRole ? `(${meta.contactRole})` : ''}</p> : null}
                    {meta.contactEmail ? <p><span className="font-semibold">E-Mail:</span> {meta.contactEmail}</p> : null}
                    {meta.contactPhone ? <p><span className="font-semibold">Telefon:</span> {meta.contactPhone}</p> : null}
                    {meta.preferredContactMethod ? <p><span className="font-semibold">Bevorzugter Kontakt:</span> {meta.preferredContactMethod}</p> : null}
                    {meta.verificationMethod ? <p><span className="font-semibold">Bestätigungsweg:</span> {meta.verificationMethod}</p> : null}
                    {meta.message ? <p><span className="font-semibold">Nachricht:</span> {meta.message}</p> : null}
                  </div>
                ) : null}
                <p className="text-[#8a9fa5] text-[11px]">Eingegangen: {new Date(claim.createdAt).toLocaleDateString('de-DE')}</p>

                <div className="flex flex-wrap gap-2 pt-1">
                  {meta?.contactEmail ? (
                    <a
                      href={`mailto:${meta.contactEmail}?subject=${encodeURIComponent(`PickMe Unternehmensanfrage: ${claim.salon?.name ?? ''}`)}`}
                      className="btn-secondary text-xs"
                    >
                      Kontakt aufnehmen
                    </a>
                  ) : adminContactEmail ? (
                    <a href={`mailto:${adminContactEmail}`} className="btn-secondary text-xs">E-Mail an Admin</a>
                  ) : null}
                  {adminWhatsappNumber && meta?.contactPhone ? (
                    <a
                      href={`https://wa.me/${adminWhatsappNumber}?text=${encodeURIComponent(`Hallo ${meta.contactName ?? ''}, Ihre PickMe-Anfrage zu ${claim.salon?.name ?? ''} …`)}`}
                      className="btn-secondary text-xs"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      WhatsApp
                    </a>
                  ) : null}
                  {claim.status === 'PENDING' || claim.status === 'VERIFICATION_REQUIRED' ? (
                    <button
                      type="button"
                      className="btn-primary text-xs"
                      disabled={approveClaimMutation.isPending}
                      onClick={() => void approveClaimMutation.mutateAsync(claim.id)}
                    >
                      Genehmigen
                    </button>
                  ) : null}
                  {claim.status !== 'REJECTED' && claim.status !== 'REVOKED' ? (
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      disabled={rejectClaimMutation.isPending}
                      onClick={() => {
                        const reason = window.prompt('Ablehnungsgrund (optional):')
                        void rejectClaimMutation.mutateAsync({ claimId: claim.id, reason: reason ?? undefined })
                      }}
                    >
                      Ablehnen
                    </button>
                  ) : null}
                  <label className="flex items-center gap-1 text-xs text-[#5c7278]">
                    <input
                      className="field-input w-40 py-1 text-xs"
                      placeholder="Notiz (lokal)"
                      value={claimNoteMap[claim.id] ?? ''}
                      onChange={(e) => setClaimNoteMap((prev) => ({ ...prev, [claim.id]: e.target.value }))}
                    />
                  </label>
                </div>
              </div>
            )
          })}
        </div>
      </article>

      <article className="space-y-3 rounded-2xl border border-[#d7e3e6] p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[#193c45]">Buchungen</h2>
          <span className="text-xs font-semibold text-[#627980]">Ungelesen: {unreadCountQuery.data ?? 0}</span>
        </div>
        {bookingsQuery.isPending ? <p className="text-sm text-[#60777d]">Buchungen werden geladen...</p> : null}
        <div className="space-y-2">
          {(bookingsQuery.data ?? []).map((booking) => (
            <div key={booking.id} className="rounded-xl border border-[#e0eaed] bg-[#fbfdfe] p-3 text-sm">
              <p className="font-semibold text-[#1f3f47]">{booking.bookingNumber} · {booking.customerName}</p>
              <p className="text-[#5c7278]">{booking.serviceName} · {booking.masterName} · {booking.salonName ?? 'Ohne Salon'}</p>
              <p className="text-[#5c7278]">{new Date(booking.startsAt).toLocaleString('de-DE')} · {booking.status} · {booking.totalPrice} {booking.currency}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="btn-secondary" type="button" onClick={() => void bookingMutation.mutateAsync({ bookingId: booking.id, action: 'confirm' })}>Confirm</button>
                <button className="btn-secondary" type="button" onClick={() => {
                  const reason = window.prompt('Stornierungsgrund (optional):')
                  void bookingMutation.mutateAsync({ bookingId: booking.id, action: 'cancel', reason: reason ?? undefined })
                }}>Cancel</button>
                <button className="btn-secondary" type="button" onClick={() => void bookingMutation.mutateAsync({ bookingId: booking.id, action: 'complete' })}>Complete</button>
                <button className="btn-secondary" type="button" onClick={() => void bookingMutation.mutateAsync({ bookingId: booking.id, action: 'noShow' })}>No-show</button>
                <button className="btn-primary" type="button" onClick={() => void bookingMutation.mutateAsync({ bookingId: booking.id, action: 'reschedule' })}>Reschedule</button>
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className="space-y-3 rounded-2xl border border-[#d7e3e6] p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[#193c45]">Benachrichtigungen</h2>
          <button type="button" className="btn-secondary" onClick={() => void notificationsApi.markAllRead().then(() => { void notificationsQuery.refetch(); void unreadCountQuery.refetch(); })}>Alle gelesen</button>
        </div>
        <div className="space-y-2">
          {(notificationsQuery.data ?? []).map((notification) => (
            <div key={notification.id} className={`rounded-xl border p-3 text-sm ${notification.isRead ? 'border-[#e0eaed] bg-white' : 'border-[#b7d7dd] bg-[#f2fbfc]'}`}>
              <p className="font-semibold text-[#1f3f47]">{notification.title}</p>
              <p className="text-[#5c7278]">{notification.message}</p>
              <p className="text-[11px] text-[#809399]">{new Date(notification.createdAt).toLocaleString('de-DE')} · {notification.type}</p>
              {!notification.isRead ? <button type="button" className="btn-secondary mt-2" onClick={() => void notificationMutation.mutateAsync(notification.id)}>Als gelesen markieren</button> : null}
            </div>
          ))}
        </div>
      </article>

      <article className="space-y-3 rounded-2xl border border-[#d7e3e6] p-4">
        <h2 className="text-lg font-semibold text-[#193c45]">Testdaten zurücksetzen</h2>
        <p className="text-sm text-[#60777d]">Entfernt Test-Buchungen, Services, Mitarbeiter, Zeitpläne, Reviews und verknüpfte Business-Daten.</p>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            const reason = window.prompt('Reset-Grund (optional):')
            void resetMutation.mutateAsync(reason ?? undefined)
          }}
        >
          Testdaten zurücksetzen
        </button>
      </article>

      <article className="space-y-3 rounded-2xl border border-[#d7e3e6] p-4">
        <h2 className="text-lg font-semibold text-[#193c45]">Benutzermoderation</h2>
        {usersQuery.isPending ? <p className="text-sm text-[#60777d]">Benutzer werden geladen...</p> : null}
        {usersQuery.error ? <p className="text-sm text-[#9a3f2d]">Benutzer konnten nicht geladen werden.</p> : null}
        <div className="space-y-2">
          {(usersQuery.data ?? []).map((user) => (
            <div key={user.id} className="rounded-xl border border-[#e0eaed] bg-[#fbfdfe] p-3 text-sm">
              <p className="font-semibold text-[#1f3f47]">{user.email} · {user.role}</p>
              <p className="text-[#5c7278]">Status: {user.accountStatus} · Aktiv: {user.isActive ? 'ja' : 'nein'}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="btn-secondary" type="button" onClick={() => void moderationMutation.mutateAsync({ id: user.id, action: 'suspend', reason: 'Suspended by master admin' })}>Suspend</button>
                <button className="btn-secondary" type="button" onClick={() => void moderationMutation.mutateAsync({ id: user.id, action: 'reactivate', reason: 'Reactivated by master admin' })}>Reactivate</button>
                <button className="btn-secondary" type="button" onClick={() => void moderationMutation.mutateAsync({ id: user.id, action: 'revoke-sessions', reason: 'Sessions revoked' })}>Revoke sessions</button>
                <button className="btn-secondary" type="button" onClick={() => void moderationMutation.mutateAsync({ id: user.id, action: 'remove-salon-membership', reason: 'Membership removed' })}>Remove salon membership</button>
                <button className="btn-secondary" type="button" onClick={() => void roleMutation.mutateAsync({ id: user.id, role: 'SALON_ADMIN', reason: 'Role changed by admin' })}>Set salon admin</button>
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className="space-y-3 rounded-2xl border border-[#d7e3e6] p-4">
        <h2 className="text-lg font-semibold text-[#193c45]">Codes und Aktivierungen</h2>

        {vouchersQuery.isPending ? <p className="text-sm text-[#60777d]">Laden...</p> : null}
        {vouchersQuery.error ? <p className="text-sm text-[#9a3f2d]">Codeliste konnte nicht geladen werden.</p> : null}

        <div className="space-y-2">
          {(vouchersQuery.data ?? []).map((voucher) => (
            <div key={voucher.id} className="rounded-xl border border-[#e0eaed] bg-[#fbfdfe] p-3 text-sm">
              <p className="font-semibold text-[#1f3f47]">{voucher.codePreview}</p>
              <p className="text-[#5c7278]">Typ: {voucher.type} · Status: {voucher.status}</p>
              <p className="text-[#5c7278]">Nutzungen: {voucher.redemptionCount}/{voucher.maxRedemptions}</p>
              <button
                type="button"
                className="btn-secondary mt-2"
                disabled={voucher.status !== 'ACTIVE' || revokeMutation.isPending}
                onClick={() => {
                  void revokeMutation.mutateAsync(voucher.id)
                }}
              >
                Widerrufen
              </button>
            </div>
          ))}
        </div>
      </article>
    </section>
  )
}
