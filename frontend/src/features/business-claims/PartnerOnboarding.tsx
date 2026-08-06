import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, Circle, ChevronRight, Loader2, X, Plus, AlertTriangle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiClient } from '../../shared/api/client';
import { loadPendingClaim, clearPendingClaim } from './ClaimBusinessModal';

interface OnboardingState {
  salonId?: string;
  googlePlaceId?: string;
  salonName?: string;
}

interface MasterDraft {
  id: string;
  displayName: string;
  specialization: string;
  workStatus: 'AVAILABLE' | 'BUSY' | 'UNAVAILABLE';
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  _local?: boolean; // temp before API save
}

const STEPS = [
  { id: 'contacts', title: 'Kontakte', description: 'Telefon und Profiltext' },
  { id: 'staff', title: 'Mitarbeiter', description: 'Team oder Einzelperson' },
  { id: 'schedule', title: 'Arbeitszeiten', description: 'Öffnungszeiten festlegen' },
  { id: 'publish', title: 'Veröffentlichen', description: 'Profil aktivieren' },
] as const;

export const PartnerOnboarding: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as OnboardingState | null) ?? {};
  const salonName = state.salonName ?? 'Ihr Unternehmen';
  const salonId = state.salonId;

  useEffect(() => {
    const pending = loadPendingClaim();
    if (pending) clearPendingClaim();
    if (salonId) {
      void apiClient.request<MasterDraft[]>(`/salons/${salonId}/staff-drafts`)
        .then((data) => setMasters(data))
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salonId]);  // salonId is stable for the lifetime of this page

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedSteps, setSavedSteps] = useState<Set<number>>(new Set());
  const [draftSaveStates, setDraftSaveStates] = useState<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({});
  const [, setDraftErrorMap] = useState<Record<string, string>>({});
  const draftSaveTimersRef = useRef<Record<string, number | undefined>>({});
  const pendingDraftRequestsRef = useRef<Record<string, AbortController | null>>({});
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
  const [soloWork, setSoloWork] = useState(false);
  const [masters, setMasters] = useState<MasterDraft[]>([]);
  const [trialEndsAt] = useState<Date | null>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d;
  });
  const [renewCode, setRenewCode] = useState('');
  const [showRenew, setShowRenew] = useState(false);
  const [renewMsg, setRenewMsg] = useState<string | null>(null);
  const [scheduleRows, setScheduleRows] = useState([
    { day: 'Mo', start: '09:00', end: '18:00', enabled: true },
    { day: 'Di', start: '09:00', end: '18:00', enabled: true },
    { day: 'Mi', start: '09:00', end: '18:00', enabled: true },
    { day: 'Do', start: '09:00', end: '18:00', enabled: true },
    { day: 'Fr', start: '09:00', end: '18:00', enabled: true },
    { day: 'Sa', start: '10:00', end: '16:00', enabled: false },
    { day: 'So', start: '10:00', end: '16:00', enabled: false },
  ]);

  const completionPct = Math.round((savedSteps.size / STEPS.length) * 100);
  const markSaved = (idx: number) => setSavedSteps((s) => new Set([...s, idx]));

  // 5-day warning
  const daysLeft = trialEndsAt
    ? Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const showWarning = daysLeft !== null && daysLeft <= 5 && daysLeft > 0;

  const saveContacts = async () => {
    setSaving(true);
    try {
      if (salonId) {
        await apiClient.request(`/salons/${salonId}`, {
          method: 'PATCH',
          body: JSON.stringify({ phone: phone || undefined, description: description || undefined }),
        });
      }
      markSaved(0);
      setStep(1);
    } catch { markSaved(0); setStep(1); }
    finally { setSaving(false); }
  };

  const saveSchedule = async () => {
    setSaving(true);
    try {
      if (salonId) {
        const openingHoursJson = Object.fromEntries(
          scheduleRows.map((r) => [r.day, r.enabled ? { open: r.start, close: r.end } : null])
        );
        await apiClient.request(`/salons/${salonId}`, {
          method: 'PATCH',
          body: JSON.stringify({ openingHoursJson }),
        });
      }
      markSaved(2);
      setStep(3);
    } catch { markSaved(2); setStep(3); }
    finally { setSaving(false); }
  };

  const addMaster = async () => {
    const localId = `local-${crypto.randomUUID()}`;
    setMasters((prev) => [...prev, {
      id: localId,
      displayName: '',
      specialization: '',
      workStatus: 'AVAILABLE',
      status: 'DRAFT',
      _local: true,
    }]);
  };

  const clearDraftTimer = (id: string) => {
    const timer = draftSaveTimersRef.current[id];
    if (timer) window.clearTimeout(timer);
    draftSaveTimersRef.current[id] = undefined;
  };

  const abortPendingDraftRequest = (id: string) => {
    const controller = pendingDraftRequestsRef.current[id];
    controller?.abort();
    pendingDraftRequestsRef.current[id] = null;
  };

  const flushDraftSave = async (id: string, force = false) => {
    clearDraftTimer(id);
    const current = masters.find((m) => m.id === id);
    if (!current) return;
    if (!force && current.displayName.trim().length === 0) return;
    if (!salonId) return;

    const previousState = draftSaveStates[id];
    if (previousState === 'saving') return;

    const payload = {
      displayName: current.displayName,
      specialization: current.specialization,
      workStatus: current.workStatus,
    };

    const previousPayloadKey = `${current.displayName.trim()}::${current.specialization.trim()}::${current.workStatus}`;
    const lastPayloadKey = (current as MasterDraft & { _lastSavedPayload?: string })._lastSavedPayload;
    if (!force && lastPayloadKey === previousPayloadKey) {
      setDraftSaveStates((prev) => ({ ...prev, [id]: 'saved' }));
      return;
    }

    setDraftSaveStates((prev) => ({ ...prev, [id]: 'saving' }));
    setDraftErrorMap((prev) => ({ ...prev, [id]: '' }));

    try {
      const controller = new AbortController();
      pendingDraftRequestsRef.current[id] = controller;
      const saved = current._local
        ? await apiClient.request<MasterDraft>(`/salons/${salonId}/staff-drafts`, {
            method: 'POST',
            body: JSON.stringify(payload),
            signal: controller.signal,
          })
        : await apiClient.request<MasterDraft>(`/salons/${salonId}/staff-drafts/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
            signal: controller.signal,
          });

      setMasters((prev) => prev.map((m) => m.id === id ? { ...saved, _lastSavedPayload: previousPayloadKey } : m));
      setDraftSaveStates((prev) => ({ ...prev, [id]: 'saved' }));
      setDraftErrorMap((prev) => ({ ...prev, [id]: '' }));
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') return;
      setDraftSaveStates((prev) => ({ ...prev, [id]: 'error' }));
      setDraftErrorMap((prev) => ({ ...prev, [id]: 'Erneut speichern' }));
    } finally {
      pendingDraftRequestsRef.current[id] = null;
    }
  };

  const updateMaster = async (id: string, patch: Partial<MasterDraft>) => {
    const current = masters.find((m) => m.id === id);
    if (!current) return;
    const updated = { ...current, ...patch };
    setMasters((prev) => prev.map((m) => m.id === id ? updated : m));

    if (!salonId) return;
    if (!updated.displayName.trim()) return;

    abortPendingDraftRequest(id);
    clearDraftTimer(id);
    setDraftSaveStates((prev) => ({ ...prev, [id]: 'saving' }));
    setDraftErrorMap((prev) => ({ ...prev, [id]: '' }));

    draftSaveTimersRef.current[id] = window.setTimeout(() => {
      void flushDraftSave(id);
    }, 650);
  };

  const removeMaster = async (id: string) => {
    const m = masters.find((x) => x.id === id);
    if (!m) return;
    abortPendingDraftRequest(id);
    clearDraftTimer(id);
    if (!m._local && salonId) {
      try {
        await apiClient.request(`/salons/${salonId}/staff-drafts/${id}`, { method: 'DELETE' });
      } catch { /* ignore, still remove from UI */ }
    }
    setMasters((prev) => prev.filter((x) => x.id !== id));
  };

  const publishMaster = async (id: string) => {
    const current = masters.find((m) => m.id === id);
    if (!current) return;
    await flushDraftSave(id, true);
    if (!salonId) { updateMaster(id, { status: 'PUBLISHED' }); return; }
    try {
      const saved = await apiClient.request<{ error?: string } & MasterDraft>(`/salons/${salonId}/staff-drafts/${id}/publish`, { method: 'POST' });
      if ((saved as { error?: string }).error === 'SUBSCRIPTION_REQUIRED') {
        alert('Aktiver Zugang erforderlich');
        return;
      }
      setMasters((prev) => prev.map((m) => m.id === id ? { ...saved } : m));
    } catch { void updateMaster(id, { status: 'PUBLISHED' }); }
  };

  const handleRenew = async () => {
    if (!renewCode.trim()) return;
    try {
      const res = await apiClient.request<{ subscriptionEndsAt?: string }>('/business-access-codes/redeem', {
        method: 'POST',
        body: JSON.stringify({ code: renewCode.trim(), salonId, googlePlaceId: state.googlePlaceId }),
      });
      const endsAt = (res as { subscriptionEndsAt?: string }).subscriptionEndsAt;
      const formatted = endsAt ? new Date(endsAt).toLocaleDateString('de-DE') : '';
      setRenewMsg(`Ihr PickMe-Zugang wurde bis ${formatted}.`);
      setRenewCode('');
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Fehler';
      setRenewMsg(msg.includes('bereits verwendet') || msg.includes('already used')
        ? 'Dieser Code wurde bereits verwendet.'
        : msg);
    }
  };

  const handlePublish = async () => {
    await Promise.all(masters.filter((m) => m.displayName.trim()).map((m) => flushDraftSave(m.id, true)));
    markSaved(3);
    navigate('/salon-admin');
  };

  return (
    <div className="min-h-screen bg-[#f7f3ec] py-6 px-4">
      <div className="mx-auto max-w-xl space-y-4">

        {/* Header */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#6b8086]">Salonverwaltung einrichten</p>
          <h1 className="mt-1 text-2xl font-bold text-[#0f2f37]">{salonName}</h1>
          <p className="mt-2 text-sm text-[#51666b]">Vervollständigen Sie Ihr Profil in wenigen Schritten und bringen Sie Ihren Salon direkt in die Buchung.</p>
        </div>

        {/* 5-day warning */}
        {showWarning && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">
                Ihr Testzugang endet in {daysLeft} {daysLeft === 1 ? 'Tag' : 'Tagen'}.
              </p>
              <button
                onClick={() => setShowRenew(true)}
                className="mt-2 text-xs font-semibold text-amber-700 underline"
              >
                Zugang verlängern →
              </button>
            </div>
          </div>
        )}

        {/* Renew panel */}
        {showRenew && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-800">Zugang verlängern</p>
            <input
              type="text"
              value={renewCode}
              onChange={(e) => setRenewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
              placeholder="PM-6M-XXXX-XXXX"
              className="field-input w-full font-mono text-sm"
            />
            {renewMsg && (
              <p className={`text-sm ${renewMsg.toLowerCase().includes('verlängert') ? 'text-emerald-700' : 'text-red-600'}`}>
                {renewMsg}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => void handleRenew()}
                className="btn-primary flex-1"
              >
                Code eingeben
              </button>
              <button onClick={() => { setShowRenew(false); setRenewMsg(null); }} className="btn-secondary">
                Abbrechen
              </button>
            </div>
          </div>
        )}

        {/* Progress */}
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex justify-between text-xs text-slate-500 mb-2">
            <span>Profil ausgefüllt</span>
            <span className="font-semibold text-[#17666D]">{completionPct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-[#17666D] transition-all duration-500" style={{ width: `${completionPct}%` }} />
          </div>
        </div>

        {/* Step tabs */}
        <div className="flex gap-1">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setStep(i)}
              className={`flex-1 h-1.5 rounded-full transition ${i === step ? 'bg-[#17666D]' : savedSteps.has(i) ? 'bg-emerald-400' : 'bg-slate-200'}`}
            />
          ))}
        </div>

        {/* Active step */}
        <div className="rounded-2xl bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            {savedSteps.has(step) ? <CheckCircle className="text-emerald-500 shrink-0" size={20} /> : <Circle className="text-[#17666D] shrink-0" size={20} />}
            <div>
              <h2 className="font-semibold text-[#0f2f37]">{step + 1}. {STEPS[step].title}</h2>
              <p className="text-xs text-slate-500">{STEPS[step].description}</p>
            </div>
          </div>

          {/* Step 1: Contacts */}
          {step === 0 && (
            <div className="space-y-3">
              <input type="tel" placeholder="Telefonnummer" value={phone} onChange={(e) => setPhone(e.target.value)} className="field-input w-full" />
              <textarea placeholder="Kurzbeschreibung (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="field-input w-full resize-none" />
              <button onClick={() => void saveContacts()} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />}
                Speichern & weiter <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* Step 2: Staff */}
          {step === 1 && (
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer rounded-xl border border-slate-200 p-3">
                <input type="checkbox" checked={soloWork} onChange={(e) => setSoloWork(e.target.checked)} className="h-4 w-4 accent-[#17666D]" />
                <span className="text-sm font-medium">Ich arbeite allein</span>
              </label>

              {!soloWork && (
                <>
                  <div className="space-y-2">
                    {masters.map((m) => (
                      <div key={m.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <input
                            placeholder="Name des Mitarbeiters"
                            value={m.displayName}
                            onChange={(e) => void updateMaster(m.id, { displayName: e.target.value })}
                            className="field-input flex-1 text-sm"
                          />
                          <button onClick={() => void removeMaster(m.id)} className="text-slate-400 hover:text-red-500 transition shrink-0" title="Mitarbeiter entfernen">
                            <X size={16} />
                          </button>
                        </div>
                        <input
                          placeholder="Spezialisierung (z.B. Friseur)"
                          value={m.specialization ?? ''}
                          onChange={(e) => void updateMaster(m.id, { specialization: e.target.value })}
                          className="field-input w-full text-sm"
                        />
                        <div className="flex items-center gap-2">
                          <select
                            value={m.workStatus}
                            onChange={(e) => void updateMaster(m.id, { workStatus: e.target.value as MasterDraft['workStatus'] })}
                            className="field-input text-sm"
                          >
                            <option value="AVAILABLE">Frei</option>
                            <option value="BUSY">Besetzt</option>
                            <option value="UNAVAILABLE">Nicht verfügbar</option>
                          </select>
                          {m.status !== 'PUBLISHED' ? (
                            <button
                              onClick={() => void publishMaster(m.id)}
                              disabled={!m.displayName}
                              className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50"
                            >
                              Veröffentlichen
                            </button>
                          ) : (
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">✓ Veröffentlicht</span>
                          )}
                        </div>
                        {m.status === 'DRAFT' && (
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <p className="text-slate-400">Entwurf — für Kunden nicht sichtbar</p>
                            {draftSaveStates[m.id] === 'saving' ? <span className="text-amber-600">Wird gespeichert…</span> : draftSaveStates[m.id] === 'saved' ? <span className="text-emerald-600">Gespeichert</span> : draftSaveStates[m.id] === 'error' ? <button onClick={() => void flushDraftSave(m.id, true)} className="text-red-600 underline">Erneut speichern</button> : null}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <button onClick={() => void addMaster()} className="btn-secondary w-full flex items-center justify-center gap-2 text-sm">
                    <Plus size={14} /> Mitarbeiter hinzufügen
                  </button>
                </>
              )}

              <button onClick={async () => {
                await Promise.all(masters.filter((m) => m.displayName.trim()).map((m) => flushDraftSave(m.id, true)));
                markSaved(1);
                setStep(2);
              }} className="btn-primary w-full flex items-center justify-center gap-2">
                Weiter <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* Step 3: Schedule */}
          {step === 2 && (
            <div className="space-y-2">
              {scheduleRows.map((row, idx) => (
                <div key={row.day} className="flex items-center gap-2 text-sm">
                  <label className="flex items-center gap-1 w-10">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={(e) => setScheduleRows((rows) => rows.map((r, i) => i === idx ? { ...r, enabled: e.target.checked } : r))}
                      className="accent-[#17666D]"
                    />
                    <span className="text-slate-600">{row.day}</span>
                  </label>
                  <input type="time" disabled={!row.enabled} value={row.start}
                    onChange={(e) => setScheduleRows((rows) => rows.map((r, i) => i === idx ? { ...r, start: e.target.value } : r))}
                    className="field-input py-1 px-2 text-xs disabled:opacity-40" />
                  <span className="text-slate-400">–</span>
                  <input type="time" disabled={!row.enabled} value={row.end}
                    onChange={(e) => setScheduleRows((rows) => rows.map((r, i) => i === idx ? { ...r, end: e.target.value } : r))}
                    className="field-input py-1 px-2 text-xs disabled:opacity-40" />
                </div>
              ))}
              <button onClick={() => void saveSchedule()} disabled={saving} className="btn-primary w-full mt-3 flex items-center justify-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />}
                Zeiten speichern <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* Step 4: Publish */}
          {step === 3 && (
            <div className="space-y-3">
              <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
                <p className="font-semibold mb-1">Bereit zur Veröffentlichung!</p>
                <p>Ihr Profil wird für Kunden sichtbar. Sie können es jederzeit weiter bearbeiten.</p>
              </div>
              <div className="rounded-xl bg-blue-50 p-3 text-xs text-blue-700">
                ❆ Verwaltungsprofil · 30 Tage kostenlos aktiv
              </div>
              <button onClick={handlePublish} className="btn-primary w-full flex items-center justify-center gap-2 !bg-emerald-600 hover:!bg-emerald-700">
                Veröffentlichen und zum Dashboard
              </button>
            </div>
          )}
        </div>

        {/* Step list nav */}
        <div className="rounded-2xl bg-white p-4 shadow-sm space-y-1">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setStep(i)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition ${i === step ? 'bg-[#f0fafa]' : 'hover:bg-slate-50'}`}
            >
              {savedSteps.has(i) ? <CheckCircle size={16} className="text-emerald-500 shrink-0" /> : <Circle size={16} className={i === step ? 'text-[#17666D]' : 'text-slate-300'} />}
              <span className={`text-sm ${i === step ? 'font-semibold text-[#0f2f37]' : 'text-slate-600'}`}>{i + 1}. {s.title}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
