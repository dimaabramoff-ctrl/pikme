export function AdminPage() {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <h1 className="text-xl font-bold text-slate-900">Панель супер-администратора</h1>
      <p className="mt-2 text-sm text-slate-600">Доступ только для роли SUPER_ADMIN.</p>
    </section>
  )
}
