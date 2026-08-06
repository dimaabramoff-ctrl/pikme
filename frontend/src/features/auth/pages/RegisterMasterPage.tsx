import { Link } from 'react-router-dom'
import { RegisterMasterForm } from '../components/RegisterMasterForm'
import { PikmeLogo } from '../../../shared/components/PikmeLogo'

export function RegisterMasterPage() {
  return (
    <section className="mx-auto max-w-md rounded-[30px] border border-[#cbd7d9] bg-white p-6 shadow-[0_24px_40px_rgba(9,37,41,0.11)]">
      <PikmeLogo withWordmark={false} className="h-10 w-10" />
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b8086]">Partner Application</p>
      <h1 className="mt-1 text-2xl font-semibold text-[#102F35]">Partnerregistrierung</h1>
      <div className="mt-4">
        <RegisterMasterForm />
      </div>
      <p className="mt-4 text-sm text-[#5b6f74]">
        Bereits registriert? <Link to="/login/partner" className="font-semibold text-[#154753]">Partner-Anmeldung</Link>
      </p>
    </section>
  )
}
