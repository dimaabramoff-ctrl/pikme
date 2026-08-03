import { Link } from 'react-router-dom'

export function MapPage() {
  return (
    <div className="space-y-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <h1 className="text-xl font-bold text-slate-900">Карта</h1>
      <p className="text-sm text-slate-600">Публичная карта каталога доступна гостям. В следующем шаге здесь появится реальная карта с объектами из PostgreSQL.</p>
      <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
        <div className="font-semibold">Сейчас доступно</div>
        <div className="mt-2">• Салоны и мастера из базы</div>
        <div>• Безопасный гостевой просмотр</div>
        <div>• Подготовка к live-карте и внешним провайдерам</div>
      </div>
      <Link to="/salons" className="inline-flex rounded-2xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Открыть каталог</Link>
    </div>
  )
}
