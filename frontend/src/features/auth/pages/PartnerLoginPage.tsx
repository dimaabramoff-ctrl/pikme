import { Link, useLocation } from 'react-router-dom'
import { LoginForm } from '../components/LoginForm'
import { PikmeLogo } from '../../../shared/components/PikmeLogo'

export function PartnerLoginPage() {
  const location = useLocation()
  const query = new URLSearchParams(location.search)
  const returnTo = query.get('returnTo')
  const registerHref = returnTo
    ? `/register/master?returnTo=${encodeURIComponent(returnTo)}`
    : '/register/master'

  return (
    <section className="mx-auto max-w-md rounded-[30px] border border-[#cbd7d9] bg-white p-6 shadow-[0_24px_40px_rgba(9,37,41,0.11)]">
      <PikmeLogo withWordmark={false} className="h-10 w-10" />
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b8086]">Partner Access</p>
      <h1 className="mt-1 text-2xl font-semibold text-[#102F35]">Partner-Anmeldung</h1>
      <p className="mt-1 text-sm text-[#5b6f74]">Für Saloninhaber, Administratoren und Meister.</p>

      <div className="mt-4">
        <LoginForm submitLabel="Als Partner anmelden" />
      </div>

      <p className="mt-4 text-sm text-[#5b6f74]">
        Noch kein Partnerkonto?{' '}
        <Link to={registerHref} className="font-semibold text-[#154753]">
          Antrag stellen / Salon oder Meisterprofil registrieren
        </Link>
      </p>
      <p className="mt-2 text-sm text-[#5b6f74]">
        Zugang ohne Registrierung?{' '}
        <Link to="/partner/request-access" className="font-semibold text-[#154753]">
          Partnerzugang anfragen
        </Link>
      </p>
    </section>
  )
}
