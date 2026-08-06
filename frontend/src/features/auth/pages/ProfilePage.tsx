import { useMutation, useQuery } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { bookingApi } from '../../bookings/api/bookingApi'
import { authApi } from '../api/authApi'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useLogout } from '../hooks/useLogout'

function formatBookingStatus(status: string) {
  switch (status) {
    case 'REQUESTED':
      return 'Angefragt'
    case 'CONFIRMED':
      return 'Bestätigt'
    case 'CANCELLED':
      return 'Storniert'
    case 'COMPLETED':
      return 'Abgeschlossen'
    case 'NO_SHOW':
      return 'No-show'
    default:
      return status
  }
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(8, 'Mindestens 8 Zeichen'),
    newPassword: z
      .string()
      .min(8, 'Mindestens 8 Zeichen')
      .max(128)
      .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, 'Mindestens ein Buchstabe und eine Ziffer erforderlich'),
    newPasswordConfirmation: z.string(),
  })
  .refine((data) => data.newPassword === data.newPasswordConfirmation, {
    message: 'Passwörter stimmen nicht überein',
    path: ['newPasswordConfirmation'],
  })

type PasswordFormData = z.infer<typeof passwordSchema>

export function ProfilePage() {
  const navigate = useNavigate()
  const logoutMutation = useLogout()
  const logoutAllMutation = useMutation({ mutationFn: authApi.logoutAll })
  const changePasswordMutation = useMutation({ mutationFn: authApi.changePassword })
  const { data: user, isLoading, isError } = useCurrentUser()
  const { data: bookings = [], isLoading: isBookingsLoading } = useQuery({
    queryKey: ['bookings', 'me'],
    queryFn: bookingApi.getMyBookings,
    enabled: Boolean(user?.id),
  })
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormData>({ resolver: zodResolver(passwordSchema) })

  const logout = async () => {
    await logoutMutation.mutateAsync()
    navigate('/login', { replace: true })
  }

  const logoutAll = async () => {
    await logoutAllMutation.mutateAsync()
    navigate('/login', { replace: true })
  }

  const changePassword = async (values: PasswordFormData) => {
    await changePasswordMutation.mutateAsync(values)
    reset()
    navigate('/login', { replace: true })
  }

  if (isLoading) {
    return <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">Profil wird geladen...</section>
  }

  if (isError || !user) {
    return <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">Profil konnte nicht geladen werden.</section>
  }

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <h1 className="text-xl font-bold">Profil</h1>
      <div className="mt-3 space-y-1 text-sm text-slate-700">
        <p>Name: {user.name}</p>
        <p>Email: {user.email}</p>
        <p>Telefon: {user.phone}</p>
        <p>Rolle: {user.role}</p>
        <p>Verifizierung: {user.isVerified ? 'Bestätigt' : 'Ausstehend'}</p>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white" onClick={logout}>
          Abmelden
        </button>
        <button className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800" onClick={logoutAll}>
          Auf allen Geräten abmelden
        </button>
      </div>

      <div className="mt-6 border-t border-slate-200 pt-4">
        <h2 className="text-base font-semibold">Meine Buchungen</h2>
        {isBookingsLoading ? (
          <p className="mt-3 text-sm text-slate-600">Buchungen werden geladen…</p>
        ) : bookings.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">Noch keine Buchungen vorhanden.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {bookings.map((booking) => (
              <div key={booking.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{booking.serviceId}</p>
                    <p className="text-slate-600">{new Date(booking.startsAt).toLocaleString('de-DE')}</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    {formatBookingStatus(booking.status)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span>Gesamt: {booking.totalPrice} {booking.currency}</span>
                  <span>•</span>
                  <span>Status: {formatBookingStatus(booking.status)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 border-t border-slate-200 pt-4">
        <h2 className="text-base font-semibold">Passwort ändern</h2>
        <form className="mt-3 space-y-2" onSubmit={handleSubmit(changePassword)}>
          <input
            type="password"
            className="w-full rounded-xl border border-slate-300 px-3 py-2"
            placeholder="Aktuelles Passwort"
            {...register('currentPassword')}
          />
          {errors.currentPassword ? <p className="text-sm text-red-600">{errors.currentPassword.message}</p> : null}

          <input
            type="password"
            className="w-full rounded-xl border border-slate-300 px-3 py-2"
            placeholder="Neues Passwort"
            {...register('newPassword')}
          />
          {errors.newPassword ? <p className="text-sm text-red-600">{errors.newPassword.message}</p> : null}

          <input
            type="password"
            className="w-full rounded-xl border border-slate-300 px-3 py-2"
            placeholder="Neues Passwort bestätigen"
            {...register('newPasswordConfirmation')}
          />
          {errors.newPasswordConfirmation ? <p className="text-sm text-red-600">{errors.newPasswordConfirmation.message}</p> : null}

          {changePasswordMutation.error ? <p className="text-sm text-red-600">Passwort konnte nicht geändert werden</p> : null}

          <button
            type="submit"
            disabled={isSubmitting || changePasswordMutation.isPending}
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {changePasswordMutation.isPending ? 'Speichern...' : 'Passwort ändern'}
          </button>
        </form>
      </div>
    </section>
  )
}
