import { Heart, MapPin, Star } from 'lucide-react'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { favoriteApi } from '../../favorites/api/favoriteApi'
import { favoriteKeys } from '../../../shared/query/queryKeys'
import { useAuthStore } from '../../auth/authStore'
import { AuthPromptModal } from '../../auth/components/AuthPromptModal'
import type { MasterSummary } from '../../../shared/api/types'

interface MasterCardProps {
  master: MasterSummary
}

export function MasterCard({ master }: MasterCardProps) {
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((state) => state.currentUser)
  const [isPromptOpen, setIsPromptOpen] = useState(false)
  const favoriteMutation = useMutation({
    mutationFn: () => favoriteApi.addMaster(master.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: favoriteKeys.list() })
    },
  })

  const handleFavorite = () => {
    if (!currentUser) {
      setIsPromptOpen(true)
      return
    }

    favoriteMutation.mutate()
  }

  const labels = master.profileFlags?.labels ?? (master.acceptsHomeVisits ? ['Selbstständiger Anbieter'] : [])

  return (
    <>
    <article className="rounded-[24px] bg-white p-4 shadow-[0_14px_30px_rgba(9,37,41,0.08)] ring-1 ring-black/5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-slate-900">{master.displayName}</h3>
          <p className="mt-1 text-sm text-slate-600">{master.specialization}</p>
          {labels.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {labels.map((label) => (
                <span key={`${master.id}-${label}`} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${label === 'Demo-Profil' ? 'bg-[#fff0de] text-[#8d552c]' : 'bg-[#edf3f4] text-[#4b6870]'}`}>
                  {label}
                </span>
              ))}
            </div>
          ) : null}
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
            <MapPin size={14} />
            <span>{master.salon?.name ?? 'Mobiler Service'}</span>
          </div>
        </div>
        <button onClick={handleFavorite} className="rounded-full bg-slate-100 p-2 text-slate-700">
          <Heart size={16} />
        </button>
      </div>
      <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
        <span className="inline-flex items-center gap-1 rounded-2xl bg-slate-50 px-3 py-2"><Star size={14} className="text-amber-500" /> Bewertung: {master.ratingAverage?.toFixed(1) ?? '0.0'}</span>
        <span className="rounded-2xl bg-slate-50 px-3 py-2">Betreute Kunden: {master.reviewCount ?? 0}</span>
        <span className="rounded-2xl bg-slate-50 px-3 py-2">Status: {master.acceptsHomeVisits ? 'Jetzt verfügbar' : 'Nach Vereinbarung'}</span>
        <span className="rounded-2xl bg-slate-50 px-3 py-2">Service: {master.acceptsHomeVisits ? 'Friseur zu Hause' : 'Salon'}</span>
      </div>
    </article>
    <AuthPromptModal isOpen={isPromptOpen} onClose={() => setIsPromptOpen(false)} returnTo={`/masters/${master.id}`} />
    </>
  )
}
