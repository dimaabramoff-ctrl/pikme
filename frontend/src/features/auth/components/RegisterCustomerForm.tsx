import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { authApi } from '../api/authApi'
import type { ApiErrorResponse } from '../authTypes'

const schema = z
  .object({
    name: z.string().min(2, 'Bitte Namen eingeben'),
    email: z.string().email('Ungültige E-Mail'),
    phone: z.string().min(6, 'Bitte Telefonnummer eingeben'),
    password: z.string().min(8, 'Mindestens 8 Zeichen').max(128),
    passwordConfirmation: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: 'Passwörter stimmen nicht überein',
    path: ['passwordConfirmation'],
  })

type FormData = z.infer<typeof schema>

export function RegisterCustomerForm() {
  const navigate = useNavigate()
  const location = useLocation()
  const registerMutation = useMutation({ mutationFn: authApi.registerCustomer })

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (values: FormData) => {
    try {
      await registerMutation.mutateAsync(values)
      const query = new URLSearchParams(location.search)
      const returnTo = query.get('returnTo')
      const target = returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login'
      navigate(target, { replace: true })
    } catch (error) {
      const apiError = error as ApiErrorResponse | undefined
      if (typeof window !== 'undefined') {
        window.console.error('Register failed', apiError?.message ?? 'Registrierung fehlgeschlagen')
      }
    }
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
      <input className="field-input" placeholder="Name" {...register('name')} />
      {errors.name ? <p className="field-hint">{errors.name.message}</p> : null}

      <input className="field-input" placeholder="Email" {...register('email')} />
      {errors.email ? <p className="field-hint">{errors.email.message}</p> : null}

      <input className="field-input" placeholder="Telefon" {...register('phone')} />
      {errors.phone ? <p className="field-hint">{errors.phone.message}</p> : null}

      <input type="password" className="field-input" placeholder="Passwort" {...register('password')} />
      {errors.password ? <p className="field-hint">{errors.password.message}</p> : null}

      <input type="password" className="field-input" placeholder="Passwort wiederholen" {...register('passwordConfirmation')} />
      {errors.passwordConfirmation ? <p className="field-hint">{errors.passwordConfirmation.message}</p> : null}

      {registerMutation.error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {(((registerMutation.error as unknown) as ApiErrorResponse | null)?.message ?? 'Registrierung fehlgeschlagen')}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting || registerMutation.isPending}
        className="btn-primary w-full disabled:opacity-60"
      >
        {registerMutation.isPending ? 'Registrieren...' : 'Registrieren'}
      </button>
    </form>
  )
}
