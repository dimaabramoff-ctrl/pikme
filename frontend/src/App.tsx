import { Home, Heart, MapPin, User } from 'lucide-react'
import { Link, Outlet } from 'react-router-dom'
import { useRestoreSession } from './features/auth/hooks/useRestoreSession'
import { useAuthStore } from './features/auth/authStore'
import { PikmeLogo } from './shared/components/PikmeLogo'
import { useUiStore } from './shared/store/uiStore'

function App() {
  useRestoreSession()
  const currentUser = useAuthStore((state) => state.currentUser)
  const { entityFilter, setEntityFilter } = useUiStore()

  return (
    <div className="mx-auto min-h-svh max-w-4xl px-4 pb-12 pt-4 sm:px-6">
      <header className="rounded-3xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="shrink-0">
            <PikmeLogo className="h-8 w-auto sm:h-9" />
          </Link>

          <div className="ml-auto flex items-center gap-3 sm:ml-0">
            <Link 
              to={currentUser ? '/profile' : '/login'}
              className="rounded-full border border-slate-200 bg-slate-50 p-2 hover:bg-slate-100"
              title={currentUser ? 'Профиль' : 'Вход'}
            >
              <User size={20} className="text-slate-600" />
            </Link>
          </div>
        </div>

        <div className="mt-3 flex rounded-full border border-slate-200 bg-slate-50 p-1">
          <button
            onClick={() => setEntityFilter('SALON')}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              entityFilter !== 'MASTER' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            Салоны
          </button>
          <button
            onClick={() => setEntityFilter('MASTER')}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              entityFilter === 'MASTER' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            На дом
          </button>
        </div>
      </header>
      <main className="mt-4">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-2 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-md items-center justify-around">
          <Link to="/" className="flex flex-col items-center gap-1 rounded-full px-3 py-2 text-[11px] font-semibold text-slate-600 hover:text-brand-600">
            <Home size={18} />
            Главная
          </Link>
          <Link to="/salons" className="flex flex-col items-center gap-1 rounded-full px-3 py-2 text-[11px] font-semibold text-slate-600 hover:text-brand-600">
            <MapPin size={18} />
            Салоны
          </Link>
          <Link to="/favorites" className="flex flex-col items-center gap-1 rounded-full px-3 py-2 text-[11px] font-semibold text-slate-600 hover:text-brand-600">
            <Heart size={18} />
            Избранное
          </Link>
          <Link to={currentUser ? '/profile' : '/login'} className="flex flex-col items-center gap-1 rounded-full px-3 py-2 text-[11px] font-semibold text-slate-600 hover:text-brand-600">
            <User size={18} />
            Профиль
          </Link>
        </div>
      </nav>
      <div className="pb-20 sm:pb-0" />
    </div>
  )
}

export default App
