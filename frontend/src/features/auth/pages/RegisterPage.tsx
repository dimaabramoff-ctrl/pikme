import { Link, useLocation } from 'react-router-dom'
import { RegisterCustomerForm } from '../components/RegisterCustomerForm'
import { PikmeLogo } from '../../../shared/components/PikmeLogo'

export function RegisterPage() {
  const location = useLocation()
  const query = new URLSearchParams(location.search)
  const returnTo = query.get('returnTo')
  const loginHref = returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login'

  return (
    <section className="mx-auto max-w-md rounded-[30px] border border-[#cbd7d9] bg-white p-6 shadow-[0_24px_40px_rgba(9,37,41,0.11)]">
      <PikmeLogo withWordmark={false} className="h-10 w-10" />
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b8086]">PickMe Access</p>
      <h1 className="mt-1 text-2xl font-semibold text-[#102d34]">Registrierung</h1>
      <div className="mt-4">
        <RegisterCustomerForm />
      </div>
      <p className="mt-4 text-sm text-[#5b6f74]">
        Bereits registriert? <Link to={loginHref} className="font-semibold text-[#154753]">Anmelden</Link>
      </p>
    </section>
  )
}
