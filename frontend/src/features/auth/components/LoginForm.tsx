import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useLogin } from '../hooks/useLogin'
import type { ApiErrorResponse } from '../authTypes'

const loginSchema = z.object({
  emailOrPhone: z.string().min(3, 'Bitte geben Sie E-Mail oder Telefon ein'),
  password: z.string().min(8, 'Mindestens 8 Zeichen'),
})

type LoginFormData = z.infer<typeof loginSchema>

interface LoginFormProps {
  submitLabel?: string
}

export function LoginForm({ submitLabel = 'Anmelden' }: LoginFormProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const loginMutation = useLogin()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (values: LoginFormData) => {
    setSubmitError(null)
    try {
      await loginMutation.mutateAsync(values)
      reset()
      const query = new URLSearchParams(location.search)
      const returnTo = query.get('returnTo')
      const targetPath = (location.state as { from?: string } | null)?.from
      navigate(returnTo ?? targetPath ?? '/profile', { replace: true })
    } catch (error) {
      const apiError = error as ApiErrorResponse | undefined
      const message = apiError?.message ?? 'Fehler beim Anmelden'
      setSubmitError(message)
      if (typeof window !== 'undefined') {
        window.console.error('Login failed', message)
      }
    }
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label htmlFor="emailOrPhone" className="mb-1 block text-sm font-semibold">
          E-Mail oder Telefon
        </label>
        <input
          id="emailOrPhone"
          className="field-input"
          {...register('emailOrPhone')}
        />
        {errors.emailOrPhone ? <p className="field-hint">{errors.emailOrPhone.message}</p> : null}
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-semibold">
          Passwort
        </label>
        <input
          id="password"
          type="password"
          className="field-input"
          {...register('password')}
        />
        {errors.password ? <p className="field-hint">{errors.password.message}</p> : null}
      </div>

      {(submitError || loginMutation.error) ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <p>{submitError ?? (((loginMutation.error as unknown) as ApiErrorResponse | null)?.message ?? 'Fehler beim Anmelden')}</p>
          <p className="mt-1 text-xs text-red-600">Bitte prüfen Sie Benutzername, Passwort oder die Serververbindung.</p>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting || loginMutation.isPending}
        className="btn-primary w-full disabled:opacity-60"
      >
        {loginMutation.isPending ? 'Anmeldung läuft...' : submitLabel}
      </button>

      {(submitError || loginMutation.error) ? (
        <button
          type="button"
          onClick={() => setSubmitError(null)}
          className="w-full rounded-xl border border-[#cbd7d9] px-3 py-2 text-sm font-semibold text-[#154753]"
        >
          Erneut versuchen
        </button>
      ) : null}
    </form>
  )
}
