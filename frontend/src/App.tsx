import { Link, Outlet } from 'react-router-dom'
import { MapPin, Shield, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuthStore } from './features/auth/authStore'
import { useRestoreSession } from './features/auth/hooks/useRestoreSession'
import { PikmeLogo } from './shared/components/PikmeLogo'
import { useAdminModeStore } from './shared/store/adminModeStore'
import { useUiStore } from './shared/store/uiStore'

function App() {
  useRestoreSession()
  const { entityFilter, setEntityFilter } = useUiStore()
  const currentUser = useAuthStore((state) => state.currentUser)
  const isAuthResolved = useAuthStore((state) => state.isAuthResolved)
  const adminModeEnabled = useAdminModeStore((state) => state.enabled)
  const setAdminModeEnabled = useAdminModeStore((state) => state.setEnabled)
  const toggleAdminMode = useAdminModeStore((state) => state.toggle)
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN'
  const [isOnline, setIsOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const [isUpdateReady, setIsUpdateReady] = useState(false)

  useEffect(() => {
    if (isAuthResolved && !isSuperAdmin && adminModeEnabled) {
      setAdminModeEnabled(false)
    }
  }, [adminModeEnabled, isAuthResolved, isSuperAdmin, setAdminModeEnabled])

  useEffect(() => {
    const handleHotkey = (event: KeyboardEvent) => {
      if (!isSuperAdmin) return
      if (!(event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'a')) return
      event.preventDefault()
      toggleAdminMode()
    }

    window.addEventListener('keydown', handleHotkey)
    return () => window.removeEventListener('keydown', handleHotkey)
  }, [isSuperAdmin, toggleAdminMode])

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    const handleUpdateReady = () => setIsUpdateReady(true)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('pickme:pwa-update-ready', handleUpdateReady)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('pickme:pwa-update-ready', handleUpdateReady)
    }
  }, [])

  return (
    <div className="min-h-svh bg-gradient-to-b from-[#f8f5ef] via-[#f6f3ed] to-[#efece6] px-4 pb-10 pt-5 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-[26px] border border-[#d9e3e5] bg-white px-4 py-3 shadow-[0_14px_30px_rgba(16,47,53,0.08)] sm:px-6">
          <div className="flex items-center gap-4">
            <Link to="/" className="shrink-0">
              <PikmeLogo className="h-10 w-auto" />
            </Link>

            <nav className="hidden items-center gap-1.5 md:flex">
              <button
                type="button"
                onClick={() => setEntityFilter('SALON')}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  entityFilter !== 'MASTER'
                    ? 'bg-[#eef5f5] text-[#133b42]'
                    : 'text-[#60777d] hover:text-[#133b42]'
                }`}
              >
                Salons
              </button>
              <button
                type="button"
                onClick={() => setEntityFilter('MASTER')}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  entityFilter === 'MASTER'
                    ? 'bg-[#eef5f5] text-[#133b42]'
                    : 'text-[#60777d] hover:text-[#133b42]'
                }`}
              >
                Zu Hause
              </button>
            </nav>

            <div className="ml-auto hidden items-center gap-2 md:flex">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full border border-[#dce5e7] bg-white px-3 py-1.5 text-sm text-[#4d676d]"
              >
                <MapPin size={14} /> Ludwigslust
              </button>
              {isSuperAdmin ? (
                <button
                  type="button"
                  onClick={toggleAdminMode}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${adminModeEnabled ? 'border-[#1f626b] bg-[#1f626b] text-white' : 'border-[#dce5e7] text-[#4d676d] hover:bg-[#f4f8f8]'}`}
                  title="Ctrl + Shift + A"
                >
                  <Shield size={14} /> Admin Mode
                </button>
              ) : null}
              <Link
                to={currentUser ? '/profile' : '/login'}
                className="inline-flex items-center gap-2 rounded-full border border-[#dce5e7] px-3 py-1.5 text-sm font-medium text-[#4d676d] transition hover:bg-[#f4f8f8]"
                title="Anmelden"
              >
                <UserRound size={16} />
                <span>{currentUser ? 'Profil' : 'Anmelden'}</span>
              </Link>
            </div>
          </div>

          <div className="mt-3 space-y-2 md:hidden">
            <div className="flex w-full rounded-full border border-[#d6e5e6] bg-[#edf4f4] p-1">
              <button
                onClick={() => setEntityFilter('SALON')}
                className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  entityFilter !== 'MASTER' ? 'bg-[#17666D] text-white shadow-[0_8px_14px_rgba(23,102,109,0.28)]' : 'text-[#4f666b]'
                }`}
              >
                Salons
              </button>
              <button
                onClick={() => setEntityFilter('MASTER')}
                className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  entityFilter === 'MASTER' ? 'bg-[#17666D] text-white shadow-[0_8px_14px_rgba(23,102,109,0.28)]' : 'text-[#4f666b]'
                }`}
              >
                Zu Hause
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#dce5e7] bg-white px-3 py-2 text-sm text-[#4d676d]"
              >
                <MapPin size={14} /> Ludwigslust
              </button>
              {isSuperAdmin ? (
                <button
                  type="button"
                  onClick={toggleAdminMode}
                  className={`inline-flex items-center justify-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition ${adminModeEnabled ? 'border-[#1f626b] bg-[#1f626b] text-white' : 'border-[#dce5e7] text-[#4d676d] hover:bg-[#f4f8f8]'}`}
                  title="Ctrl + Shift + A"
                >
                  <Shield size={14} /> Admin Mode
                </button>
              ) : (
                <Link
                  to={currentUser ? '/profile' : '/login'}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[#dce5e7] px-3 py-2 text-sm font-medium text-[#4d676d] transition hover:bg-[#f4f8f8]"
                  title="Anmelden"
                >
                  <UserRound size={16} />
                  <span>{currentUser ? 'Profil' : 'Anmelden'}</span>
                </Link>
              )}
            </div>
          </div>
        </header>

        {isSuperAdmin && adminModeEnabled ? (
          <section className="mt-3 flex items-center justify-between gap-2 rounded-2xl border border-[#b8d4d8] bg-[#e9f4f5] px-4 py-2 text-sm text-[#17464f]">
            <div className="inline-flex items-center gap-2 font-semibold">
              <Shield size={14} /> Admin Mode aktiv
            </div>
            <button
              type="button"
              onClick={() => setAdminModeEnabled(false)}
              className="rounded-full border border-[#b8d4d8] bg-white px-3 py-1 text-xs font-semibold text-[#1d5962]"
            >
              Admin Mode beenden
            </button>
          </section>
        ) : null}

        {!isOnline ? (
          <section className="mt-3 flex items-center justify-between gap-2 rounded-2xl border border-[#e1cfbe] bg-[#fff7f1] px-4 py-2 text-sm text-[#80563a]">
            <span>Sie sind offline. Inhalte werden geladen, sobald eine Verbindung verfugbar ist.</span>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-full border border-[#e1cfbe] bg-white px-3 py-1 text-xs font-semibold text-[#7a4f34]"
            >
              Erneut versuchen
            </button>
          </section>
        ) : null}

        {isUpdateReady ? (
          <section className="mt-3 flex items-center justify-between gap-2 rounded-2xl border border-[#bdd9de] bg-[#ecf6f8] px-4 py-2 text-sm text-[#174a52]">
            <span>Ein PickMe-Update ist verfugbar.</span>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-full border border-[#bdd9de] bg-white px-3 py-1 text-xs font-semibold text-[#1d5962]"
            >
              Jetzt aktualisieren
            </button>
          </section>
        ) : null}

        <main className="mt-4">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default App
