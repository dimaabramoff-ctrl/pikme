import React, { useState } from 'react';
import { X, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCreateBusinessClaim, useRedeemCode, useActivateTrialDirect } from './hooks';
import { useAuthStore } from '../auth/authStore';
import { AuthPromptModal } from '../auth/components/AuthPromptModal';

// Admin contact — never hardcoded, always from env; if not set, shows placeholder
const ADMIN_CONTACT_EMAIL = import.meta.env.VITE_ADMIN_CONTACT_EMAIL as string | undefined
const ADMIN_WHATSAPP_NUMBER = import.meta.env.VITE_ADMIN_WHATSAPP_NUMBER as string | undefined

if (!ADMIN_CONTACT_EMAIL) {
  // eslint-disable-next-line no-console
  console.warn('[PickMe] VITE_ADMIN_CONTACT_EMAIL is not configured — admin contact will be hidden from users.')
}

const CLAIM_STORAGE_KEY = 'pickme_pending_claim';

interface PendingClaimState {
  salonId?: string;
  googlePlaceId?: string;
  salonName: string;
  address?: string;
  claimId?: string;
  trialCode?: string;
  pendingStep: 'options' | 'contact_form' | 'creating' | 'status' | 'redeem_form';
}

export function savePendingClaim(state: PendingClaimState) {
  sessionStorage.setItem(CLAIM_STORAGE_KEY, JSON.stringify(state));
}

export function loadPendingClaim(): PendingClaimState | null {
  const raw = sessionStorage.getItem(CLAIM_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingClaimState;
  } catch {
    return null;
  }
}

export function clearPendingClaim() {
  sessionStorage.removeItem(CLAIM_STORAGE_KEY);
}

interface ClaimBusinessModalProps {
  isOpen: boolean;
  onClose: () => void;
  salonId?: string;
  googlePlaceId?: string;
  salonName: string;
  address?: string;
  claimId?: string;
  initialStep?: ClaimBusinessModalStep;
  onClaimCreated?: (claimId: string) => void;
}

export type ClaimBusinessModalStep = 'options' | 'contact_form' | 'creating' | 'status' | 'redeem_form';

interface ContactForm {
  contactName: string;
  contactRole: string;
  contactEmail: string;
  contactPhone: string;
  preferredContactMethod: string;
  verificationMethod: string;
  message: string;
}

const EMPTY_FORM: ContactForm = {
  contactName: '',
  contactRole: '',
  contactEmail: '',
  contactPhone: '',
  preferredContactMethod: 'EMAIL',
  verificationMethod: 'BUSINESS_EMAIL',
  message: '',
}

function statusLabel(status: string): string {
  switch (status) {
    case 'PENDING': return 'Ihre Anfrage ist eingegangen.'
    case 'VERIFICATION_REQUIRED': return 'Bitte schließen Sie die Bestätigung ab.'
    case 'UNDER_REVIEW': return 'PickMe prüft Ihre Angaben.'
    case 'APPROVED': return 'Ihr Unternehmen wurde bestätigt.'
    case 'REJECTED': return 'Die Bestätigung konnte nicht abgeschlossen werden.'
    case 'CODE_ISSUED': return 'Ein Zugangscode wurde erstellt.'
    case 'ACTIVE_TRIAL': return 'Trial ist aktiv.'
    default: return status
  }
}

function nextStepHint(status: string): string {
  switch (status) {
    case 'PENDING': return 'Wir werden Sie in Kürze kontaktieren, um die Inhaberschaft zu bestätigen.'
    case 'VERIFICATION_REQUIRED': return 'Bitte überprüfen Sie Ihren Posteingang oder das im Formular angegebene Kontaktmedium.'
    case 'UNDER_REVIEW': return 'Wir melden uns innerhalb von 1–2 Werktagen.'
    case 'APPROVED': return 'Sie können jetzt Ihren kostenlosen 30-Tage-Trial aktivieren.'
    case 'REJECTED': return 'Bei Fragen wenden Sie sich an den PickMe-Support.'
    default: return ''
  }
}

export const ClaimBusinessModal: React.FC<ClaimBusinessModalProps> = ({
  isOpen,
  onClose,
  salonId,
  googlePlaceId,
  salonName,
  address,
  claimId: externalClaimId,
  initialStep = 'options',
  onClaimCreated,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.currentUser);
  const [step, setStep] = useState<ClaimBusinessModalStep>(initialStep);
  const [form, setForm] = useState<ContactForm>(EMPTY_FORM)
  const [codeInput, setCodeInput] = useState('');
  const [internalClaimId, setInternalClaimId] = useState<string | undefined>(externalClaimId);
  const [claimStatus, setClaimStatus] = useState<string>('PENDING');
  const [claimCreatedAt, setClaimCreatedAt] = useState<string | null>(null);
  const [trialResult, setTrialResult] = useState<{ trialEndsAt: string } | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  const createClaimMutation = useCreateBusinessClaim();
  const redeemMutation = useRedeemCode();
  const trialMutation = useActivateTrialDirect();

  const claimId = internalClaimId ?? externalClaimId;

  const requireAuth = (nextStep: ClaimBusinessModalStep) => {
    savePendingClaim({ salonId, googlePlaceId, salonName, address, claimId: internalClaimId ?? externalClaimId, pendingStep: nextStep });
    setShowAuthPrompt(true);
  };

  const buildFactualSnapshot = () => ({
    name: salonName,
    address: address ?? undefined,
  });

  const handleSubmitContactForm = async () => {
    if (!currentUser) { requireAuth('contact_form'); return; }
    if (!form.contactName.trim() || !form.contactEmail.trim() || !form.contactPhone.trim()) {
      setErrorMsg('Bitte füllen Sie Name, E-Mail und Telefon aus.');
      return;
    }
    setErrorMsg(null);
    setStep('creating');
    try {
      const result = await createClaimMutation.mutateAsync({
        salonId,
        googlePlaceId,
        factualSnapshot: buildFactualSnapshot(),
        contactName: form.contactName.trim(),
        contactRole: form.contactRole.trim(),
        contactEmail: form.contactEmail.trim(),
        contactPhone: form.contactPhone.trim(),
        preferredContactMethod: form.preferredContactMethod,
        verificationMethod: form.verificationMethod,
        message: form.message.trim() || undefined,
      });
      const r = result as { id?: string; status?: string; createdAt?: string };
      const newId = r.id ?? '';
      setInternalClaimId(newId);
      setClaimStatus(r.status ?? 'PENDING');
      setClaimCreatedAt(r.createdAt ?? null);
      onClaimCreated?.(newId);
      setStep('status');
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Fehler beim Senden der Anfrage';
      setErrorMsg(
        msg.includes('already exists') || msg.includes('already have an active claim')
          ? 'Für dieses Geschäft wurde bereits eine Anfrage gestellt.'
          : msg.includes('Unauthorized') ? 'Bitte melden Sie sich an.'
          : msg
      );
      setStep('contact_form');
    }
  };

  const handleActivateTrial = async () => {
    if (!claimId) return;
    setErrorMsg(null);
    try {
      const result = await trialMutation.mutateAsync(claimId);
      setTrialResult({ trialEndsAt: result.trialEndsAt });
      setStep('status');
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Fehler bei der Trial-Aktivierung';
      setErrorMsg(
        msg.includes('APPROVED') ? 'Der Trial kann erst nach Bestätigung aktiviert werden.' :
        msg.includes('already exists') ? 'Der Trial für dieses Unternehmen wurde bereits aktiviert.' :
        msg
      );
    }
  };

  const doRedirect = (res: unknown) => {
    const r = res as { redirectTo?: string; alreadyUsed?: boolean } | null;
    const target = r?.redirectTo ?? '/partner/onboarding';
    clearPendingClaim();
    navigate(target, { state: { salonId, googlePlaceId, salonName } });
    onClose();
  };

  const handleRedeemManual = async () => {
    if (!currentUser) { requireAuth('redeem_form'); return; }
    if (!codeInput.trim()) return;
    setErrorMsg(null);
    try {
      const res = await redeemMutation.mutateAsync({ code: codeInput.trim(), salonId, googlePlaceId, factualSnapshot: buildFactualSnapshot() });
      doRedirect(res);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Aktivierungsfehler';
      setErrorMsg(
        msg.includes('bereits verwendet') || msg.includes('already used') ? 'Dieser Code wurde bereits verwendet.' :
        msg.includes('not valid for this') ? 'Dieser Code gilt für ein anderes Geschäft.' :
        msg.includes('expired') ? 'Der Code ist abgelaufen.' :
        msg.includes('fully redeemed') ? 'Dieser Code wurde bereits verwendet.' :
        msg.includes('REVOKED') ? 'Dieser Code wurde widerrufen.' :
        msg
      );
    }
  };

  React.useEffect(() => {
    if (!isOpen) return;
    if (step !== 'creating') return;
    if (redeemMutation.isPending || createClaimMutation.isPending) return;
  }, [isOpen, step, redeemMutation.isPending, createClaimMutation.isPending]);

  if (!isOpen) return null;

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-slate-900">Unternehmen bestätigen und PickMe testen</h2>
          <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:text-slate-600" type="button"><X size={18} /></button>
        </div>

        <div className="px-5 pt-4">
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="font-medium text-sm text-slate-900">{salonName}</p>
            {address ? <p className="text-xs text-slate-500 mt-0.5">{address}</p> : null}
          </div>
        </div>

        {errorMsg ? (
          <div className="mx-5 mt-3 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle size={14} /><span>{errorMsg}</span>
          </div>
        ) : null}

        <div className="px-5 py-4 space-y-3">

          {/* Options step */}
          {step === 'options' ? (
            <>
              <p className="text-sm leading-6 text-slate-600">
                Damit niemand ein fremdes Profil übernimmt, bestätigen wir kurz, dass Sie zu diesem Unternehmen gehören.
                Nach der Bestätigung starten Sie automatisch Ihren kostenlosen 30-Tage-Trial.
              </p>
              <button
                onClick={() => { setErrorMsg(null); setStep('contact_form'); }}
                className="w-full rounded-xl bg-[#17666D] py-2.5 text-sm font-semibold text-white hover:bg-[#0f4d52] transition"
                type="button"
              >
                Profil übernehmen und Trial starten
              </button>
              <button
                onClick={() => { setErrorMsg(null); setStep('redeem_form'); }}
                className="w-full rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition"
                type="button"
              >
                Ich habe bereits einen PickMe-Zugangscode
              </button>
              <button onClick={onClose} className="w-full py-2 text-xs text-slate-400 hover:text-slate-600" type="button">
                Das ist nicht mein Geschäft
              </button>
            </>
          ) : null}

          {/* Contact form step */}
          {step === 'contact_form' ? (
            <>
              <p className="text-xs text-slate-500 leading-5">Pflichtfelder: Name, geschäftliche E-Mail, Telefon.</p>
              <div className="grid gap-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Vorname und Nachname *
                  <input className="field-input mt-1" value={form.contactName} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} placeholder="Max Mustermann" />
                </label>
                <label className="block text-xs font-semibold text-slate-700">
                  Rolle im Unternehmen
                  <input className="field-input mt-1" value={form.contactRole} onChange={(e) => setForm((f) => ({ ...f, contactRole: e.target.value }))} placeholder="Inhaber, Geschäftsführer …" />
                </label>
                <label className="block text-xs font-semibold text-slate-700">
                  Geschäftliche E-Mail *
                  <input type="email" className="field-input mt-1" value={form.contactEmail} onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))} placeholder="info@ihr-salon.de" />
                </label>
                <label className="block text-xs font-semibold text-slate-700">
                  Geschäftliche Telefonnummer *
                  <input type="tel" className="field-input mt-1" value={form.contactPhone} onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))} placeholder="+49 30 …" />
                </label>
                <label className="block text-xs font-semibold text-slate-700">
                  Bevorzugter Kontaktweg
                  <select className="field-input mt-1" value={form.preferredContactMethod} onChange={(e) => setForm((f) => ({ ...f, preferredContactMethod: e.target.value }))}>
                    <option value="EMAIL">E-Mail</option>
                    <option value="PHONE">Telefon</option>
                    <option value="WHATSAPP">WhatsApp</option>
                  </select>
                </label>
                <label className="block text-xs font-semibold text-slate-700">
                  Bestätigungsweg
                  <select className="field-input mt-1" value={form.verificationMethod} onChange={(e) => setForm((f) => ({ ...f, verificationMethod: e.target.value }))}>
                    <option value="BUSINESS_EMAIL">Code an geschäftliche E-Mail</option>
                    <option value="BUSINESS_PHONE">Code an geschäftliche Telefonnummer</option>
                    <option value="CALLBACK">Rückruf durch PickMe</option>
                    <option value="DOCUMENT">Nachweis hochladen</option>
                    <option value="MANUAL">Manuelle Prüfung durch PickMe</option>
                  </select>
                </label>
                <label className="block text-xs font-semibold text-slate-700">
                  Nachricht (optional)
                  <textarea className="field-input mt-1 min-h-16" value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} placeholder="Weitere Hinweise …" />
                </label>
              </div>

              {ADMIN_CONTACT_EMAIL ? (
                <div className="rounded-xl bg-[#eef7f7] px-3 py-2 text-xs text-[#124047]">
                  PickMe-Kontakt: <a href={`mailto:${ADMIN_CONTACT_EMAIL}`} className="font-semibold underline">{ADMIN_CONTACT_EMAIL}</a>
                  {ADMIN_WHATSAPP_NUMBER ? <span> · <a href={`https://wa.me/${ADMIN_WHATSAPP_NUMBER}`} className="font-semibold underline" target="_blank" rel="noopener noreferrer">WhatsApp</a></span> : null}
                </div>
              ) : (
                <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  PickMe-Kontakt ist derzeit nicht konfiguriert.
                </div>
              )}

              <button
                onClick={() => void handleSubmitContactForm()}
                disabled={createClaimMutation.isPending || !form.contactName || !form.contactEmail || !form.contactPhone}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#17666D] py-2.5 text-sm font-semibold text-white hover:bg-[#0f4d52] transition disabled:opacity-50"
                type="button"
              >
                {createClaimMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                Anfrage senden
              </button>
              <button onClick={() => setStep('options')} className="w-full py-2 text-xs text-slate-400 hover:text-slate-600" type="button">Zurück</button>
            </>
          ) : null}

          {/* Sending */}
          {step === 'creating' ? (
            <div className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 py-3 text-sm text-slate-700">
              <Loader2 size={16} className="animate-spin" /> Anfrage wird gesendet…
            </div>
          ) : null}

          {/* Status */}
          {step === 'status' ? (
            <div className="space-y-3">
              {trialResult ? (
                <div className="rounded-xl bg-[#eef8f2] px-4 py-3 text-sm text-[#145028]">
                  <div className="flex items-center gap-2 font-semibold"><CheckCircle2 size={16} className="text-[#1a7a40]" /> PickMe Partner Trial ist aktiv</div>
                  <p className="mt-1 text-xs">
                    Aktiv bis {new Date(trialResult.trialEndsAt).toLocaleDateString('de-DE')}.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl bg-[#f7fbfc] px-3 py-3 text-sm text-slate-700 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-[#17666D] shrink-0" />
                    <span className="font-semibold">{statusLabel(claimStatus)}</span>
                  </div>
                  {claimId ? <p className="text-[11px] text-slate-500">Anfrage-ID: <span className="font-mono">{claimId.slice(0, 16)}</span></p> : null}
                  {claimCreatedAt ? <p className="text-[11px] text-slate-500">Gesendet: {new Date(claimCreatedAt).toLocaleDateString('de-DE')}</p> : null}
                  <p className="text-xs text-[#3a6069]">{nextStepHint(claimStatus)}</p>
                </div>
              )}

              {claimStatus === 'APPROVED' && !trialResult ? (
                <button
                  onClick={() => void handleActivateTrial()}
                  disabled={trialMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#17666D] py-2.5 text-sm font-semibold text-white hover:bg-[#0f4d52] transition disabled:opacity-50"
                  type="button"
                >
                  {trialMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                  30 Tage Trial aktivieren
                </button>
              ) : null}

              {trialResult ? (
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => { clearPendingClaim(); navigate('/partner/onboarding'); onClose(); }} className="btn-primary text-xs" type="button">Jetzt verwalten</button>
                  <button onClick={onClose} className="btn-secondary text-xs" type="button">Schließen</button>
                </div>
              ) : (
                <button onClick={onClose} className="w-full py-2 text-xs text-slate-400 hover:text-slate-600" type="button">Schließen</button>
              )}
            </div>
          ) : null}

          {/* Code redeem */}
          {step === 'redeem_form' ? (
            <>
              <label className="block text-sm text-slate-700">
                PickMe-Zugangscode
                <input
                  type="text"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#17666D]"
                  placeholder="PM-TRIAL-XXXX-XXXX"
                  maxLength={32}
                />
              </label>
              <button
                onClick={() => void handleRedeemManual()}
                disabled={!codeInput || redeemMutation.isPending}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#17666D] py-2.5 text-sm font-semibold text-white hover:bg-[#0f4d52] transition disabled:opacity-50"
                type="button"
              >
                {redeemMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                Aktivieren
              </button>
              <button onClick={() => setStep('options')} className="w-full py-2 text-xs text-slate-400 hover:text-slate-600" type="button">Zurück</button>
            </>
          ) : null}

        </div>
      </div>
    </div>

    <AuthPromptModal
      isOpen={showAuthPrompt}
      onClose={() => setShowAuthPrompt(false)}
      returnTo={`${location.pathname}${location.search}`}
    />
    </>
  );
};
