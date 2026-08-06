import { Link, useLocation } from 'react-router-dom'
import { LoginForm } from '../components/LoginForm'
import { BackendStatusCard } from '../components/BackendStatusCard'
import { PikmeLogo } from '../../../shared/components/PikmeLogo'

export function LoginPage() {
  const location = useLocation()
  const query = new URLSearchParams(location.search)
  const returnTo = query.get('returnTo')
  const registerHref = returnTo ? `/register?returnTo=${encodeURIComponent(returnTo)}` : '/register'

  return (
    <section className="mx-auto max-w-md rounded-[30px] border border-[#cbd7d9] bg-white p-6 shadow-[0_24px_40px_rgba(9,37,41,0.11)]">
      <PikmeLogo withWordmark={false} className="h-10 w-10" />
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b8086]">Customer Access</p>
      <h1 className="mt-1 text-2xl font-semibold text-[#102F35]">Kundenanmeldung</h1>
      <p className="mt-1 text-sm text-[#5b6f74]">Google, Apple oder Anmeldung mit E-Mail und Telefon.</p>

      <div className="mt-4 space-y-2">
        <BackendStatusCard className="mt-1" />
        <button className="btn-secondary w-full border-[#dce6e8] bg-[#f5f8f9] text-[#708388]" disabled type="button">
          Weiter mit Google
        </button>
        <button className="btn-secondary w-full border-[#dce6e8] bg-[#f5f8f9] text-[#708388]" disabled type="button">
          Weiter mit Apple
        </button>
        <p className="rounded-xl border border-dashed border-[#d0dbde] bg-[#f8fbfc] px-3 py-2 text-sm text-[#6b7a80]">
          Google und Apple sind derzeit nicht eingerichtet. Bitte nutzen Sie E-Mail/Telefon oder ein Demo-Konto.
        </p>
      </div>

      <div className="my-4 h-px bg-[#e1e9ea]" />

      <div className="mt-4">
        <LoginForm />
      </div>
      <p className="mt-4 text-sm text-[#5b6f74]">
        Noch kein Konto? <Link to={registerHref} className="font-semibold text-[#154753]">Registrieren</Link>
      </p>
    </section>
  )
}
