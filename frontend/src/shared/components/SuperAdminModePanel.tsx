import { useState } from 'react'
import { Shield, Eye, Pencil, Power, Lock, Unlock, RotateCcw, ClipboardList, Sparkles } from 'lucide-react'
import { adminModeApi } from '../../features/admin/api/adminModeApi'
import { useAdminModeStore } from '../store/adminModeStore'

interface SuperAdminModePanelProps {
  entityType: 'Salon' | 'MasterProfile'
  entityId: string
  title: string
  canOpenOwnerEditor?: boolean
  canManageTrial?: boolean
  canResetDemo?: boolean
  resetScope?: 'DEMO_SALON' | 'DEMO_ZUHAUSE' | 'TESTBETRIEB'
  onOpenEditor?: () => void
  onOpenMasterEdit?: () => void
  onRefresh?: () => Promise<void> | void
  isActive?: boolean
  isLocked?: boolean
  targetUserId?: string | null
  disableProfileActions?: boolean
}

export function SuperAdminModePanel(props: SuperAdminModePanelProps) {
  const setAdminModeEnabled = useAdminModeStore((state) => state.setEnabled)
  const [isBusy, setIsBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [auditItems, setAuditItems] = useState<Array<{ id: string; action: string; createdAt: string; actor?: { email: string } }>>([])
  const [auditOpen, setAuditOpen] = useState(false)

  const runAction = async (label: string, action: () => Promise<unknown>) => {
    try {
      setIsBusy(true)
      setStatus(null)
      await action()
      await props.onRefresh?.()
      setStatus(`${label}: OK`)
    } catch (error) {
      const message = typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : 'Fehlgeschlagen'
      setStatus(`${label}: ${message}`)
    } finally {
      setIsBusy(false)
    }
  }

  const toggleProfile = () => runAction(
    props.isActive ? 'Profil deaktivieren' : 'Profil aktivieren',
    () => props.entityType === 'Salon'
      ? adminModeApi.setSalonProfileActive(props.entityId, !props.isActive, 'Admin mode action')
      : adminModeApi.setMasterProfileActive(props.entityId, !props.isActive, 'Admin mode action'),
  )

  const toggleAccess = () => runAction(
    props.isLocked ? 'Zugriff entsperren' : 'Zugriff sperren',
    async () => {
      if (props.entityType === 'Salon') {
        await adminModeApi.setSalonAccessLocked(props.entityId, !props.isLocked, 'Admin mode action')
        return
      }

      if (!props.targetUserId) {
        throw new Error('Kein Zielnutzer für Zugriff gefunden')
      }

      await adminModeApi.setUserAccessLocked(props.targetUserId, !props.isLocked, 'Admin mode action')
    },
  )

  const toggleTrial = () => runAction(
    'Trial verwalten',
    () => adminModeApi.setSalonTrialEnabled(props.entityId, true, 30, 'Admin mode quick trial'),
  )

  const resetDemo = () => runAction(
    'Demo/Testprofil zurücksetzen',
    async () => {
      if (!props.resetScope) throw new Error('Reset scope fehlt')
      const confirmed = window.confirm('Reset wirklich ausführen? Diese Aktion setzt nur Demo/Testdaten zurück.')
      if (!confirmed) return
      await adminModeApi.resetScope(props.resetScope, 'Admin mode reset')
    },
  )

  const openAudit = () => runAction(
    'AuditLog laden',
    async () => {
      const response = await adminModeApi.getAuditLogs({
        entityType: props.entityType,
        entityId: props.entityId,
        limit: 20,
      })
      setAuditItems(response.items.map((item) => ({
        id: item.id,
        action: item.action,
        createdAt: item.createdAt,
        actor: item.actor
          ? { email: item.actor.email }
          : item.actorUser
            ? { email: item.actorUser.email }
            : undefined,
      })))
      setAuditOpen(true)
    },
  )

  return (
    <section className="rounded-2xl border border-[#cfe0e3] bg-[#f8fcfc] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-[#e8f1f2] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#1d545e]">
          <Shield size={13} /> Admin Mode aktiv
        </div>
        <button type="button" onClick={() => setAdminModeEnabled(false)} className="rounded-full border border-[#d2e1e3] bg-white px-2.5 py-1 text-xs font-semibold text-[#315c64]">
          Admin Mode beenden
        </button>
      </div>

      <p className="mt-2 text-xs text-[#5a7076]">{props.title}</p>

      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <button type="button" onClick={props.entityType === 'Salon' ? props.onOpenEditor : props.onOpenMasterEdit} className="btn-secondary inline-flex items-center justify-center gap-1 text-xs" disabled={isBusy}>
          <Pencil size={13} /> Bearbeiten
        </button>
        <button type="button" onClick={() => setAdminModeEnabled(false)} className="btn-secondary inline-flex items-center justify-center gap-1 text-xs" disabled={isBusy}>
          <Eye size={13} /> Als Kunde ansehen
        </button>
        <button type="button" onClick={props.onOpenEditor} className="btn-secondary inline-flex items-center justify-center gap-1 text-xs" disabled={!props.canOpenOwnerEditor || isBusy}>
          <Pencil size={13} /> Owner Editor öffnen
        </button>
        <button type="button" onClick={toggleProfile} className="btn-secondary inline-flex items-center justify-center gap-1 text-xs" disabled={isBusy || props.disableProfileActions}>
          <Power size={13} /> {props.isActive ? 'Profil deaktivieren' : 'Profil aktivieren'}
        </button>
        <button type="button" onClick={toggleAccess} className="btn-secondary inline-flex items-center justify-center gap-1 text-xs" disabled={isBusy || props.disableProfileActions}>
          {props.isLocked ? <Unlock size={13} /> : <Lock size={13} />} {props.isLocked ? 'Zugriff entsperren' : 'Zugriff sperren'}
        </button>
        <button type="button" onClick={toggleTrial} className="btn-secondary inline-flex items-center justify-center gap-1 text-xs" disabled={!props.canManageTrial || isBusy}>
          <Sparkles size={13} /> Trial verwalten
        </button>
        <button type="button" onClick={resetDemo} className="btn-secondary inline-flex items-center justify-center gap-1 text-xs" disabled={!props.canResetDemo || isBusy}>
          <RotateCcw size={13} /> Demo/Testprofil zurücksetzen
        </button>
        <button type="button" onClick={openAudit} className="btn-secondary inline-flex items-center justify-center gap-1 text-xs" disabled={isBusy}>
          <ClipboardList size={13} /> AuditLog öffnen
        </button>
      </div>

      {status ? <p className="mt-2 text-xs font-semibold text-[#315d65]">{status}</p> : null}

      {auditOpen ? (
        <div className="mt-2 rounded-xl border border-[#d9e6e8] bg-white p-2">
          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#5f757b]">Letzte Audit-Events</div>
          <div className="max-h-44 space-y-1 overflow-auto pr-1 text-xs">
            {auditItems.length === 0 ? <p className="text-[#64797f]">Keine Einträge</p> : null}
            {auditItems.map((item) => (
              <div key={item.id} className="rounded-lg bg-[#f5fafb] px-2 py-1">
                <div className="font-semibold text-[#23464f]">{item.action}</div>
                <div className="text-[#5f767c]">{new Date(item.createdAt).toLocaleString('de-DE')} · {item.actor?.email ?? 'system'}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
