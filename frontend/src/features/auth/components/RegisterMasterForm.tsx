import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { authApi } from '../api/authApi'

const schema = z
  .object({
    name: z.string().min(2, 'Bitte geben Sie Ihren Namen ein'),
    email: z.string().email('Ungültige E-Mail-Adresse'),
    phone: z.string().min(6, 'Bitte geben Sie Ihre Telefonnummer ein'),
    password: z.string().min(8, 'Mindestens 8 Zeichen').max(128),
    passwordConfirmation: z.string(),
    experienceYears: z.number().min(0, 'Erfahrung darf nicht negativ sein'),
    specialization: z.string().min(2, 'Bitte geben Sie eine Spezialisierung an'),
    acceptsHomeVisits: z.boolean(),
    independent: z.boolean(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: 'Die Passwörter stimmen nicht überein',
    path: ['passwordConfirmation'],
  })

type FormData = z.infer<typeof schema>

export function RegisterMasterForm() {
  const navigate = useNavigate()
  const registerMutation = useMutation({ mutationFn: authApi.registerMaster })

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      acceptsHomeVisits: false,
      independent: true,
    },
  })

  const onSubmit = async (values: FormData) => {
    await registerMutation.mutateAsync(values)
    navigate('/login', { replace: true })
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
      <input type="password" className="field-input" placeholder="Passwort wiederholen" {...register('passwordConfirmation')} />
      {errors.passwordConfirmation ? <p className="field-hint">{errors.passwordConfirmation.message}</p> : null}

      <input
        type="number"
        className="field-input"
        placeholder="Erfahrung in Jahren"
        {...register('experienceYears', { valueAsNumber: true })}
      />
      {errors.experienceYears ? <p className="field-hint">{errors.experienceYears.message}</p> : null}

      <input className="field-input" placeholder="Spezialisierung" {...register('specialization')} />
      {errors.specialization ? <p className="field-hint">{errors.specialization.message}</p> : null}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register('acceptsHomeVisits')} /> Ich akzeptiere Hausbesuche
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register('independent')} /> Unabhängiger Meister
      </label>

      {registerMutation.error ? <p className="text-sm text-red-600">Fehler bei der Registrierung</p> : null}

      <button
        type="submit"
        disabled={isSubmitting || registerMutation.isPending}
        className="btn-primary w-full disabled:opacity-60"
      >
        {registerMutation.isPending ? 'Antrag wird gesendet...' : 'Antrag einreichen'}
      </button>
    </form>
  )
}
