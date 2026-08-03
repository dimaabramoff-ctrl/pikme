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

  return (
    <>
    <article className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">{master.displayName}</h3>
          <p className="mt-1 text-sm text-slate-600">{master.specialization}</p>
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
            <MapPin size={14} />
            <span>{master.salon?.name ?? 'Независимый мастер'}</span>
          </div>
        </div>
        <button onClick={handleFavorite} className="rounded-full bg-slate-100 p-2 text-slate-700">
          <Heart size={16} />
        </button>
      </div>
      <div className="mt-3 flex items-center gap-4 text-sm text-slate-700">
        <span className="flex items-center gap-1"><Star size={14} className="text-amber-500" /> {master.ratingAverage?.toFixed(1) ?? '0.0'}</span>
        <span>{master.reviewCount ?? 0} отзывов</span>
        <span>{master.acceptsHomeVisits ? 'Выезд на дом' : 'Салон'}</span>
      </div>
    </article>
    <AuthPromptModal isOpen={isPromptOpen} onClose={() => setIsPromptOpen(false)} returnTo={`/masters/${master.id}`} />
    </>
  )
}
