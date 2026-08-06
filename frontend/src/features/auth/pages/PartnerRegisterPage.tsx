import { useMutation } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../api/authApi'
import type { RegisterPartnerPayload, RegisterPartnerStaffPayload } from '../authTypes'
import { PikmeLogo } from '../../../shared/components/PikmeLogo'

const demoPhotoOptions = [
  'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1552058544-f2b08422138a?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=900&q=80',
]

function buildDefaultStaff(): RegisterPartnerStaffPayload[] {
  return [
    {
      name: 'Anna Keller',
      specialization: 'Senior Stylist',
      experienceYears: 8,
      photoUrl: demoPhotoOptions[0],
      services: [
        { name: 'Damenhaarschnitt', category: 'hair_salon', durationMinutes: 45, price: 45 },
        { name: 'Coloration', category: 'hair_salon', durationMinutes: 120, price: 89 },
      ],
    },
    {
      name: 'Maria Schulz',
      specialization: 'Colorist',
      experienceYears: 7,
      photoUrl: demoPhotoOptions[1],
      services: [
        { name: 'Coloration', category: 'hair_salon', durationMinutes: 120, price: 95 },
      ],
    },
    {
      name: 'Alexej Braun',
      specialization: 'Barber',
      experienceYears: 9,
      photoUrl: demoPhotoOptions[2],
      services: [
        { name: 'Herrenhaarschnitt', category: 'barber_shop', durationMinutes: 30, price: 31 },
        { name: 'Schnitt und Bart', category: 'barber_shop', durationMinutes: 45, price: 41 },
      ],
    },
    {
      name: 'Lena Fischer',
      specialization: 'Stylist',
      experienceYears: 6,
      photoUrl: demoPhotoOptions[3],
      services: [
        { name: 'Styling', category: 'hair_salon', durationMinutes: 40, price: 31 },
      ],
    },
  ]
}

export function PartnerRegisterPage() {
  const navigate = useNavigate()
  const [ownerName, setOwnerName] = useState('Demo Salon Owner')
  const [ownerEmail, setOwnerEmail] = useState('partner.demo@example.test')
  const [ownerPhone, setOwnerPhone] = useState('+491770001234')
  const [ownerPassword, setOwnerPassword] = useState('TestPass123')
  const [salonName, setSalonName] = useState('PickMe Atelier Royal Demo')
  const [salonAddressLine, setSalonAddressLine] = useState('Schlossstrasse 14, 19288 Ludwigslust')
  const [salonCity, setSalonCity] = useState('Ludwigslust')
  const [salonPostalCode, setSalonPostalCode] = useState('19288')
  const [salonPhone, setSalonPhone] = useState('+49 3874 555 120')
  const [existingGooglePlaceId, setExistingGooglePlaceId] = useState('')
  const [ownershipConfirmed, setOwnershipConfirmed] = useState(true)
  const [activateDemoTrial, setActivateDemoTrial] = useState(true)
  const [staff, setStaff] = useState<RegisterPartnerStaffPayload[]>(buildDefaultStaff)

  const registration = useMutation({ mutationFn: authApi.registerPartner })

  const canSubmit = useMemo(() => {
    return ownerName.trim().length >= 2 && ownerEmail.trim().length > 5 && ownershipConfirmed
  }, [ownerName, ownerEmail, ownershipConfirmed])

  const onSubmit = async () => {
    const payload: RegisterPartnerPayload = {
      ownerName,
      ownerEmail,
      ownerPhone,
      ownerPassword,
      ownerPasswordConfirmation: ownerPassword,
      salonName,
      salonAddressLine,
      salonCity,
      salonPostalCode,
      salonPhone,
      salonCategory: 'hair_salon',
      salonWorkHours: 'Mo-Sa 09:00 - 20:00',
      existingGooglePlaceId: existingGooglePlaceId.trim() || undefined,
      ownershipConfirmed,
      staff,
      activateDemoTrial,
      demoTrialDays: activateDemoTrial ? 14 : undefined,
    }

    const result = await registration.mutateAsync(payload)
    navigate(`/redeem?salonId=${encodeURIComponent(result.salonId)}`)
  }

  return (
    <section className="mx-auto max-w-3xl rounded-[30px] border border-[#cbd7d9] bg-white p-6 shadow-[0_24px_40px_rgba(9,37,41,0.11)]">
      <PikmeLogo withWordmark={false} className="h-10 w-10" />
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b8086]">Partner Onboarding</p>
      <h1 className="mt-1 text-2xl font-semibold text-[#102F35]">Registrierung des Saloninhabers</h1>
      <p className="mt-1 text-sm text-[#5b6f74]">Vollständiger Demo-Flow ohne Google OAuth und ohne echte Zahlungen.</p>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-[#1c3a42]">1. Inhaberdaten</h2>
          <input className="field-input" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Name des Inhabers" />
          <input className="field-input" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="Email" />
          <input className="field-input" value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} placeholder="Telefon" />
          <input type="password" className="field-input" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} placeholder="Passwort" />
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-[#1c3a42]">2. Salondaten</h2>
          <input className="field-input" value={salonName} onChange={(e) => setSalonName(e.target.value)} placeholder="Salonname" />
          <input className="field-input" value={salonAddressLine} onChange={(e) => setSalonAddressLine(e.target.value)} placeholder="Adresse" />
          <input className="field-input" value={salonCity} onChange={(e) => setSalonCity(e.target.value)} placeholder="Stadt" />
          <input className="field-input" value={salonPostalCode} onChange={(e) => setSalonPostalCode(e.target.value)} placeholder="PLZ" />
          <input className="field-input" value={salonPhone} onChange={(e) => setSalonPhone(e.target.value)} placeholder="Salontelefon" />
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <h2 className="text-sm font-semibold text-[#1c3a42]">3. Eigentumsbestätigung</h2>
        <input
          className="field-input"
          value={existingGooglePlaceId}
          onChange={(e) => setExistingGooglePlaceId(e.target.value)}
          placeholder="Google Place ID (falls der Salon bereits bei Google gefunden wurde)"
        />
        <label className="flex items-center gap-2 text-sm text-[#27434a]">
          <input type="checkbox" checked={ownershipConfirmed} onChange={(e) => setOwnershipConfirmed(e.target.checked)} />
          Ich bestätige, dass ich den Salon rechtlich verwalten darf
        </label>
      </div>

      <div className="mt-5 space-y-3">
        <h2 className="text-sm font-semibold text-[#1c3a42]">4. Mitarbeiter (Demo)</h2>
        {staff.map((member, index) => (
          <article key={`${member.name}-${index}`} className="rounded-2xl border border-[#d7e2e5] bg-[#f8fbfc] p-3">
            <div className="text-sm font-semibold text-[#163740]">{member.name}</div>
            <div className="text-xs text-[#5f7378]">{member.specialization} · Erfahrung: {member.experienceYears} Jahre</div>
            <div className="mt-1 text-xs text-[#5f7378]">
              Leistungen: {member.services.map((service) => `${service.name} (${service.price} €, ${service.durationMinutes} Min.)`).join(' · ')}
            </div>
            <label className="mt-2 block text-xs text-[#4f6469]">
              Mitarbeiterfoto
              <select
                className="field-input mt-1"
                value={member.photoUrl}
                onChange={(event) => {
                  const next = [...staff]
                  next[index] = { ...next[index], photoUrl: event.target.value }
                  setStaff(next)
                }}
              >
                {demoPhotoOptions.map((option) => (
                  <option key={option} value={option}>
                    Demo photo {demoPhotoOptions.indexOf(option) + 1}
                  </option>
                ))}
              </select>
            </label>
          </article>
        ))}
      </div>

      <div className="mt-5 space-y-2">
        <h2 className="text-sm font-semibold text-[#1c3a42]">5. Aktivierung</h2>
        <label className="flex items-center gap-2 text-sm text-[#27434a]">
          <input type="checkbox" checked={activateDemoTrial} onChange={(e) => setActivateDemoTrial(e.target.checked)} />
          Demo-Trial aktivieren
        </label>
      </div>

      {registration.error ? (
        <p className="mt-4 rounded-xl border border-[#f3d6cd] bg-[#fff5f1] px-3 py-2 text-sm text-[#8d402c]">
          {(registration.error as { message?: string }).message ?? 'Inhaber konnte nicht registriert werden.'}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <button type="button" onClick={() => void onSubmit()} disabled={!canSubmit || registration.isPending} className="btn-primary">
          {registration.isPending ? 'Registrieren...' : 'Inhaber registrieren'}
        </button>
        <Link to="/login/partner" className="btn-secondary">Partner-Anmeldung</Link>
      </div>
    </section>
  )
}
