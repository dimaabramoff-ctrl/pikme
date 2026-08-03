import { Link } from 'react-router-dom'
import { RegisterMasterForm } from '../components/RegisterMasterForm'

export function RegisterMasterPage() {
  return (
    <section className="mx-auto max-w-md rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <h1 className="text-2xl font-bold">Регистрация мастера</h1>
      <div className="mt-4">
        <RegisterMasterForm />
      </div>
      <p className="mt-4 text-sm text-slate-600">
        Уже есть аккаунт? <Link to="/login" className="font-semibold text-brand-700">Войти</Link>
      </p>
    </section>
  )
}
