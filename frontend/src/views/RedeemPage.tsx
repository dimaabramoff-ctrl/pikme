import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { voucherApi } from '../features/bookings/api/voucherApi'

export function RedeemPage() {
  const [params] = useSearchParams()
  const [code, setCode] = useState('')
  const salonId = params.get('salonId') ?? undefined

  const redeemMutation = useMutation({
    mutationFn: voucherApi.redeem,
  })

  return (
    <section className="mx-auto max-w-xl rounded-[30px] border border-[#d1dcde] bg-white p-6 shadow-[0_24px_40px_rgba(9,37,41,0.11)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b8086]">PickMe Partner</p>
      <h1 className="mt-1 text-2xl font-semibold text-[#102F35]">Gutscheincode aktivieren</h1>

      <div className="mt-5 space-y-2">
        <label htmlFor="redeem-code" className="text-sm font-semibold text-[#1f3b42]">Gutscheincode</label>
        <input
          id="redeem-code"
          className="field-input"
          placeholder="PM-MONTH-8H2M-P4WD"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
        />
      </div>

      <button
        type="button"
        className="btn-primary mt-4"
        disabled={code.trim().length < 8 || redeemMutation.isPending}
        onClick={() => {
          void redeemMutation.mutateAsync({ code: code.trim(), salonId })
        }}
      >
        {redeemMutation.isPending ? 'Aktivieren...' : 'Aktivieren'}
      </button>

      {redeemMutation.error ? (
        <p className="mt-4 rounded-xl border border-[#f4ddd5] bg-[#fff6f3] px-3 py-2 text-sm text-[#8c4733]">
          {(redeemMutation.error as { message?: string }).message ?? 'Code wurde nicht akzeptiert.'}
        </p>
      ) : null}

      {redeemMutation.data ? (
        <div className="mt-5 space-y-2 rounded-2xl border border-[#d5e2e6] bg-[#f7fbfc] p-4 text-sm text-[#214047]">
          <h2 className="text-base font-semibold text-[#13414c]">PickMe Partner aktiviert</h2>
          <p>Zugangstyp: {redeemMutation.data.accessType ?? redeemMutation.data.type}</p>
          <p>Salon: {salonId ?? 'Ihr Salon'}</p>
          <p>Start: {redeemMutation.data.subscription?.startsAt ? new Date(redeemMutation.data.subscription.startsAt).toLocaleString('de-DE') : 'jetzt'}</p>
          <p>Ende: {redeemMutation.data.subscription?.endsAt ? new Date(redeemMutation.data.subscription.endsAt).toLocaleString('de-DE') : 'laut Tarif'}</p>
          <p>Laufzeit: {redeemMutation.data.subscription?.durationDays ?? '—'} Tage</p>
          <div>
            <p className="font-semibold">Verfügbare Funktionen:</p>
            <ul className="mt-1 list-disc pl-5">
              {(redeemMutation.data.activatedFeatures ?? []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  )
}
