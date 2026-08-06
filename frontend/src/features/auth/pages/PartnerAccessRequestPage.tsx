import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../../../shared/api/client'

export function PartnerAccessRequestPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    contactName: '',
    salonName: '',
    city: '',
    phone: '',
    email: '',
    message: '',
    requestedDuration: 'MONTH',
    googlePlaceId: '',
    existingUserId: '',
    existingSalonId: '',
  })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage(null)

    try {
      const payload = {
        ...form,
        googlePlaceId: form.googlePlaceId || undefined,
        existingUserId: form.existingUserId || undefined,
        existingSalonId: form.existingSalonId || undefined,
      }

      await apiClient.request('/partner-access-requests', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setMessage('Anfrage gesendet. Wir melden uns in Kürze bei Ihnen.')
      setTimeout(() => navigate('/login/partner'), 1200)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Anfrage konnte nicht gesendet werden'
      setMessage(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-4 rounded-[30px] border border-[#ccdcde] bg-white p-6 shadow-[0_24px_42px_rgba(9,37,41,0.11)]">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b8086]">Partner Access</p>
        <h1 className="text-2xl font-semibold text-[#0f2f37]">Partnerzugang anfragen</h1>
      </div>
      <form className="grid gap-3" onSubmit={submit}>
        <input className="field-input" placeholder="Ihr Name" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} required />
        <input className="field-input" placeholder="Salonname" value={form.salonName} onChange={(e) => setForm({ ...form, salonName: e.target.value })} required />
        <input className="field-input" placeholder="Stadt" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
        <input className="field-input" placeholder="Telefon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
        <input className="field-input" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <textarea className="field-input min-h-[100px]" placeholder="Kurze Beschreibung Ihrer Anfrage" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
        <input className="field-input" placeholder="Google Place ID (optional)" value={form.googlePlaceId} onChange={(e) => setForm({ ...form, googlePlaceId: e.target.value })} />
        <input className="field-input" placeholder="ID des bestehenden Nutzers (optional)" value={form.existingUserId} onChange={(e) => setForm({ ...form, existingUserId: e.target.value })} />
        <input className="field-input" placeholder="ID des bestehenden Salons (optional)" value={form.existingSalonId} onChange={(e) => setForm({ ...form, existingSalonId: e.target.value })} />
        <select className="field-input" value={form.requestedDuration} onChange={(e) => setForm({ ...form, requestedDuration: e.target.value })}>
          <option value="MONTH">1 Monat</option>
          <option value="THREE_MONTHS">3 Monate</option>
          <option value="SIX_MONTHS">6 Monate</option>
          <option value="YEAR">1 Jahr</option>
          <option value="TRIAL">Trial</option>
        </select>
        <button className="btn-primary" type="submit" disabled={busy}>{busy ? 'Wird gesendet...' : 'Anfrage senden'}</button>
        {message ? <p className="text-sm text-[#30515b]">{message}</p> : null}
      </form>
    </section>
  )
}
