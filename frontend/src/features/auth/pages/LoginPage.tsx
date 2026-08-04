import { Link } from 'react-router-dom'
import { LoginForm } from '../components/LoginForm'

export function LoginPage() {
  return (
    <section className="mx-auto max-w-md rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <h1 className="text-2xl font-bold">Вход</h1>
      <p className="mt-1 text-sm text-slate-600">Войдите в аккаунт PickMe.</p>
      <div className="mt-4">
        <LoginForm />
      </div>
      <p className="mt-4 text-sm text-slate-600">
        Нет аккаунта? <Link to="/register" className="font-semibold text-brand-700">Регистрация клиента</Link>
      </p>
    </section>
  )
}
