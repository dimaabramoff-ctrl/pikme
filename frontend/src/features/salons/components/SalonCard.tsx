import { Heart, MapPin, Star } from 'lucide-react'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { favoriteApi } from '../../favorites/api/favoriteApi'
import { favoriteKeys } from '../../../shared/query/queryKeys'
import { useAuthStore } from '../../auth/authStore'
import { AuthPromptModal } from '../../auth/components/AuthPromptModal'
import type { SalonSummary } from '../../../shared/api/types'

interface SalonCardProps {
  salon: SalonSummary
}

export function SalonCard({ salon }: SalonCardProps) {
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((state) => state.currentUser)
  const [isPromptOpen, setIsPromptOpen] = useState(false)
  const favoriteMutation = useMutation({
    mutationFn: () => favoriteApi.addSalon(salon.id),
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

  const profileLabels = (() => {
    const metadata = salon.cancellationPolicyJson
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return [] as string[]
    const flags = (metadata as { pickmeProfileFlags?: { labels?: unknown } }).pickmeProfileFlags
    if (!flags || !Array.isArray(flags.labels)) return [] as string[]
    return flags.labels.filter((item): item is string => typeof item === 'string')
  })()

  return (
    <>
    <article className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">{salon.name}</h3>
          {profileLabels.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {profileLabels.map((label) => (
                <span key={`${salon.id}-${label}`} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${label === 'Demo-Profil' ? 'bg-[#fff0de] text-[#8d552c]' : 'bg-[#edf3f4] text-[#4b6870]'}`}>
                  {label}
                </span>
              ))}
            </div>
          ) : null}
          <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
            <MapPin size={14} />
            <span>{salon.city}, {salon.postalCode}</span>
          </div>
        </div>
        <button onClick={handleFavorite} className="rounded-full bg-slate-100 p-2 text-slate-700">
          <Heart size={16} />
        </button>
      </div>
      <p className="mt-2 text-sm text-slate-600">{salon.description}</p>
      <div className="mt-3 flex items-center gap-4 text-sm text-slate-700">
        <span className="flex items-center gap-1"><Star size={14} className="text-amber-500" /> {salon.ratingAverage.toFixed(1)}</span>
        <span>{salon.reviewCount} Bewertungen</span>
        <span>{salon.homeVisitEnabled ? 'Hausbesuch' : 'Salon'}</span>
      </div>
    </article>
    <AuthPromptModal isOpen={isPromptOpen} onClose={() => setIsPromptOpen(false)} returnTo={`/salons/${salon.id}`} />
    </>
  )
}
