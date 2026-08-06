import { Link } from 'react-router-dom'

export function MapPage() {
  return (
    <div className="space-y-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <h1 className="text-xl font-bold text-slate-900">Karte</h1>
      <p className="text-sm text-slate-600">Die öffentliche Katalogkarte ist für Gäste verfügbar. Im nächsten Schritt erscheint hier die echte Karte mit Daten aus PostgreSQL.</p>
      <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
        <div className="font-semibold">Jetzt verfügbar</div>
        <div className="mt-2">• Salons und Meister aus der Datenbank</div>
        <div>• Sicherer Gastmodus</div>
        <div>• Vorbereitung auf Live-Karte und externe Provider</div>
      </div>
      <Link to="/salons" className="inline-flex rounded-2xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Katalog öffnen</Link>
    </div>
  )
}
