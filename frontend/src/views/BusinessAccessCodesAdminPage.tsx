import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Check, RotateCcw, Loader2, AlertCircle } from 'lucide-react'
import { apiClient } from '../shared/api/client'

type CodeType = 'TRIAL' | 'STANDARD' | 'PREMIUM'

interface CreatedCodeResult {
  id: string
  code: string
  codePrefix: string
  targetSalonId?: string
  targetGooglePlaceId?: string
  durationDays: number
  type: CodeType
  expiresAt: string
  maxRedemptions: number
}

interface ListedCode {
  id: string
  codePrefix: string
  targetSalonId?: string
  targetGooglePlaceId?: string
  assignedEmail?: string
  durationDays: number
  type: CodeType
  status: string
  redemptionCount: number
  maxRedemptions: number
  expiresAt: string
  createdAt: string
  activatedAt?: string
  createdBy?: { email: string }
  activatedBy?: { email: string }
  metadata?: { comment?: string }
}

const DURATION_PRESETS = [
  { label: 'Trial 30 Tage', days: 30, type: 'TRIAL' as CodeType },
  { label: '1 Monat', days: 30, type: 'STANDARD' as CodeType },
  { label: '6 Monate', days: 180, type: 'STANDARD' as CodeType },
  { label: '12 Monate', days: 365, type: 'STANDARD' as CodeType },
]

export function BusinessAccessCodesAdminPage() {
  const [targetSalonId, setTargetSalonId] = useState('')
  const [targetGooglePlaceId, setTargetGooglePlaceId] = useState('')
  const [assignedEmail, setAssignedEmail] = useState('')
  const [comment, setComment] = useState('')
  const [selectedPreset, setSelectedPreset] = useState(0)
  const [isOneTime, setIsOneTime] = useState(true)
  const [createdCode, setCreatedCode] = useState<CreatedCodeResult | null>(null)
  const [copied, setCopied] = useState(false)

  const codesQuery = useQuery({
    queryKey: ['business-access-codes', 'list'],
    queryFn: () => apiClient.request<ListedCode[]>('/business-access-codes/list'),
  })

  const createMutation = useMutation({
    mutationFn: (payload: object) =>
      apiClient.request<CreatedCodeResult>('/business-access-codes', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (result) => {
      setCreatedCode(result)
      void codesQuery.refetch()
    },
  })

  const revokeMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.request(`/business-access-codes/${id}/revoke`, {
        method: 'PATCH',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => void codesQuery.refetch(),
  })

  const preset = DURATION_PRESETS[selectedPreset]

  const handleCreate = () => {
    if (!targetSalonId && !targetGooglePlaceId) return
    void createMutation.mutateAsync({
      targetSalonId: targetSalonId || undefined,
      targetGooglePlaceId: targetGooglePlaceId || undefined,
      durationDays: preset.days,
      type: preset.type,
      assignedEmail: assignedEmail || undefined,
      isOneTime,
      comment: comment || undefined,
    })
  }

  const copyCode = (code: string) => {
    void navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="space-y-6 rounded-[30px] border border-[#ccdcde] bg-white p-5 shadow-[0_24px_42px_rgba(9,37,41,0.11)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b8086]">Master Admin</p>
          <h1 className="text-xl font-semibold text-[#0f2f37]">Business-Zugangscodes</h1>
        </div>
        <Link to="/master-admin" className="btn-secondary text-sm">← Zurück</Link>
      </div>

      {/* Generator form */}
      <article className="space-y-4 rounded-2xl border border-[#d7e3e6] p-4">
        <h2 className="font-semibold text-[#193c45]">Code für Unternehmen erstellen</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-[#2d4a50]">
            Salon-ID (intern)
            <input
              className="field-input mt-1"
              value={targetSalonId}
              onChange={(e) => setTargetSalonId(e.target.value)}
              placeholder="clxxxx..."
            />
          </label>
          <label className="text-sm text-[#2d4a50]">
            Google Place ID
            <input
              className="field-input mt-1"
              value={targetGooglePlaceId}
              onChange={(e) => setTargetGooglePlaceId(e.target.value)}
              placeholder="ChIJ..."
            />
          </label>
        </div>

        <div className="text-xs text-slate-400 -mt-2">Mindestens eine Kennung angeben</div>

        <div>
          <p className="text-sm text-[#2d4a50] mb-2">Zugangsdauer</p>
          <div className="flex flex-wrap gap-2">
            {DURATION_PRESETS.map((p, i) => (
              <button
                key={p.label}
                onClick={() => setSelectedPreset(i)}
                className={`rounded-xl px-3 py-1.5 text-sm font-medium transition ${i === selectedPreset ? 'bg-[#17666D] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-[#2d4a50]">
            E-Mail zuweisen (optional)
            <input
              type="email"
              className="field-input mt-1"
              value={assignedEmail}
              onChange={(e) => setAssignedEmail(e.target.value)}
              placeholder="owner@example.com"
            />
          </label>
          <label className="text-sm text-[#2d4a50]">
            Kommentar
            <input
              className="field-input mt-1"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Für interne Notizen"
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm text-[#2d4a50] cursor-pointer">
          <input
            type="checkbox"
            checked={isOneTime}
            onChange={(e) => setIsOneTime(e.target.checked)}
            className="accent-[#17666D]"
          />
          Einmalcode
        </label>

        {(!targetSalonId && !targetGooglePlaceId) && (
          <div className="flex items-center gap-2 text-sm text-amber-700 rounded-xl bg-amber-50 px-3 py-2">
            <AlertCircle size={14} />
            Salon-ID oder Google Place ID angeben
          </div>
        )}

        <button
          className="btn-primary"
          onClick={handleCreate}
          disabled={(!targetSalonId && !targetGooglePlaceId) || createMutation.isPending}
        >
          {createMutation.isPending ? (
            <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Wird erstellt...</span>
          ) : 'Code erstellen'}
        </button>

        {/* Created code display */}
        {createdCode && (
          <div className="rounded-xl border border-[#d5e4e8] bg-[#f4fafc] p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#6b8086]">Code erstellt – nur einmal sichtbar</p>
            <div className="rounded-lg bg-white border border-slate-200 px-3 py-2 font-mono text-sm break-all text-slate-700">
              {createdCode.code}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
              <span>Typ: {createdCode.type}</span>
              <span>·</span>
              <span>Laufzeit: {createdCode.durationDays} Tage</span>
              <span>·</span>
              <span>Aktivieren bis: {new Date(createdCode.expiresAt).toLocaleDateString('de-DE')}</span>
            </div>
            <button
              onClick={() => copyCode(createdCode.code)}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              {copied ? <><Check size={14} className="text-emerald-600" /> Kopiert</> : <><Copy size={14} /> Code kopieren</>}
            </button>
          </div>
        )}
      </article>

      {/* Codes list */}
      <article className="space-y-3 rounded-2xl border border-[#d7e3e6] p-4">
        <h2 className="font-semibold text-[#193c45]">Ausgegebene Codes</h2>
        {codesQuery.isPending && <p className="text-sm text-slate-500">Laden...</p>}
        {codesQuery.isError && <p className="text-sm text-red-600">Codes konnten nicht geladen werden</p>}
        <div className="space-y-2">
          {(codesQuery.data ?? []).map((code) => (
            <div key={code.id} className="rounded-xl border border-[#e0eaed] bg-[#fbfdfe] p-3 text-sm space-y-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-mono text-xs text-slate-600">{code.codePrefix}…</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  code.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' :
                  code.status === 'USED' ? 'bg-blue-50 text-blue-700' :
                  code.status === 'REVOKED' ? 'bg-red-50 text-red-700' :
                  'bg-slate-100 text-slate-600'
                }`}>{code.status}</span>
              </div>
              <p className="text-xs text-slate-500">
                {code.type} · {code.durationDays} Tage · {code.redemptionCount}/{code.maxRedemptions} Aktivierungen
              </p>
              {code.targetGooglePlaceId && <p className="text-xs text-slate-400">Google: {code.targetGooglePlaceId}</p>}
              {code.targetSalonId && <p className="text-xs text-slate-400">Salon: {code.targetSalonId}</p>}
              {code.assignedEmail && <p className="text-xs text-slate-400">Email: {code.assignedEmail}</p>}
              {code.metadata?.comment && <p className="text-xs text-slate-400">Kommentar: {code.metadata.comment}</p>}
              <p className="text-xs text-slate-400">
                Erstellt: {new Date(code.createdAt).toLocaleDateString('de-DE')}
                {code.activatedAt ? ` · Aktiviert: ${new Date(code.activatedAt).toLocaleDateString('de-DE')}` : ''}
                {code.activatedBy ? ` · Benutzer: ${code.activatedBy.email}` : ''}
              </p>
              {code.status === 'ACTIVE' && (
                <button
                  onClick={() => void revokeMutation.mutateAsync({ id: code.id, reason: 'Im Master Admin widerrufen' })}
                  disabled={revokeMutation.isPending}
                  className="mt-1 flex items-center gap-1 text-xs text-red-600 hover:text-red-800 transition"
                >
                  <RotateCcw size={12} /> Widerrufen
                </button>
              )}
            </div>
          ))}
          {(codesQuery.data ?? []).length === 0 && !codesQuery.isPending && (
            <p className="text-sm text-slate-400">Es wurden noch keine Codes erstellt</p>
          )}
        </div>
      </article>
    </section>
  )
}
