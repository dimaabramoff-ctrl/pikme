import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../authStore'
import { PRESENTATION_CUSTOMER, PRESENTATION_MODE } from '../../../shared/demo/presentationData'

interface AuthPromptModalProps {
  isOpen: boolean
  onClose: () => void
  returnTo?: string
}

export function AuthPromptModal({ isOpen, onClose, returnTo }: AuthPromptModalProps) {
  const navigate = useNavigate()
  const target = returnTo ?? '/profile'
  const setAccessToken = useAuthStore((state) => state.setAccessToken)
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser)
  const setAuthResolved = useAuthStore((state) => state.setAuthResolved)

  if (!isOpen) return null

  const handleDemoClientLogin = () => {
    setAccessToken('presentation-demo-token')
    setCurrentUser({
      id: 'demo-customer-1',
      name: PRESENTATION_CUSTOMER.fullName,
      email: 'customer@example.test',
      phone: PRESENTATION_CUSTOMER.phone,
      role: 'CUSTOMER',
      isActive: true,
      isVerified: true,
    })
    setAuthResolved(true)
    onClose()
    navigate(target, { replace: true })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d242b]/55 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-[28px] border border-[#ccd7da] bg-white p-5 shadow-[0_26px_42px_rgba(7,30,34,0.24)]">
        <h2 className="text-xl font-semibold text-[#0f2f37]">Um fortzufahren, melden Sie sich bei PickMe an</h2>
        <p className="mt-2 text-sm text-[#5b6f74]">Der Ablauf wird gespeichert und Sie kommen nach der Autorisierung direkt zu Ihrem aktuellen Schritt zurück.</p>

        <div className="mt-4 space-y-2">
          <a href={`/login?returnTo=${encodeURIComponent(target)}`} className="btn-primary w-full">
            Anmelden
          </a>
          {PRESENTATION_MODE ? (
            <button onClick={handleDemoClientLogin} className="btn-primary w-full bg-[#124753] hover:bg-[#0f3e49]" type="button">
              Als Demo-Kunde fortfahren
            </button>
          ) : null}
          <button className="btn-ghost w-full opacity-60" disabled type="button">
            Mit Google fortfahren
          </button>
          <button className="btn-ghost w-full opacity-60" disabled type="button">
            Mit Apple fortfahren
          </button>
          <p className="text-sm text-[#6b7a80]">
            Google und Apple sind derzeit nicht konfiguriert. Für die Demo verwenden Sie bitte die E-Mail-Anmeldung oder den Demo-Kunden.
          </p>
          <Link to={`/register?returnTo=${encodeURIComponent(target)}`} className="btn-secondary w-full">
            Registrierung
          </Link>
          <button onClick={onClose} className="btn-secondary w-full border-transparent text-[#63767b]">
            Abbrechen
          </button>
        </div>
        {PRESENTATION_MODE ? (
          <p className="mt-3 text-xs text-[#718287]">
            Test-Kunde: customer@example.test / TestPass123
          </p>
        ) : null}
      </div>
    </div>
  )
}
