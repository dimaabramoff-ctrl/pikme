import { Link } from 'react-router-dom'

interface AuthPromptModalProps {
  isOpen: boolean
  onClose: () => void
  returnTo?: string
}

export function AuthPromptModal({ isOpen, onClose, returnTo }: AuthPromptModalProps) {
  if (!isOpen) return null

  const target = returnTo ?? '/profile'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-bold text-slate-900">Чтобы продолжить, войдите в PickMe</h2>
        <p className="mt-2 text-sm text-slate-600">Сохраните выбранный сценарий и продолжайте после авторизации.</p>

        <div className="mt-4 space-y-2">
          <a href={`/login?returnTo=${encodeURIComponent(target)}`} className="flex items-center justify-center rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white">
            Войти по телефону или email
          </a>
          <button className="flex w-full items-center justify-center rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">
            Продолжить с Google
          </button>
          <button className="flex w-full items-center justify-center rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">
            Продолжить с Apple
          </button>
          <Link to={`/register?returnTo=${encodeURIComponent(target)}`} className="flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800">
            Создать аккаунт
          </Link>
          <button onClick={onClose} className="flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-slate-500">
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}
