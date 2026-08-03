import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { authApi } from '../api/authApi'

const schema = z
  .object({
    name: z.string().min(2, 'Введите имя'),
    email: z.string().email('Некорректный email'),
    phone: z.string().min(6, 'Введите телефон'),
    password: z.string().min(8, 'Минимум 8 символов').max(128),
    passwordConfirmation: z.string(),
    experienceYears: z.number().min(0, 'Опыт не может быть отрицательным'),
    specialization: z.string().min(2, 'Укажите специализацию'),
    acceptsHomeVisits: z.boolean(),
    independent: z.boolean(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: 'Пароли не совпадают',
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
      <input className="w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Имя" {...register('name')} />
      {errors.name ? <p className="text-sm text-red-600">{errors.name.message}</p> : null}

      <input className="w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Email" {...register('email')} />
      {errors.email ? <p className="text-sm text-red-600">{errors.email.message}</p> : null}

      <input className="w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Телефон" {...register('phone')} />
      {errors.phone ? <p className="text-sm text-red-600">{errors.phone.message}</p> : null}

      <input type="password" className="w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Пароль" {...register('password')} />
      <input type="password" className="w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Повторите пароль" {...register('passwordConfirmation')} />
      {errors.passwordConfirmation ? <p className="text-sm text-red-600">{errors.passwordConfirmation.message}</p> : null}

      <input
        type="number"
        className="w-full rounded-xl border border-slate-300 px-3 py-2"
        placeholder="Опыт в годах"
        {...register('experienceYears', { valueAsNumber: true })}
      />
      {errors.experienceYears ? <p className="text-sm text-red-600">{errors.experienceYears.message}</p> : null}

      <input className="w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Специализация" {...register('specialization')} />
      {errors.specialization ? <p className="text-sm text-red-600">{errors.specialization.message}</p> : null}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register('acceptsHomeVisits')} /> Принимаю выезды на дом
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register('independent')} /> Независимый мастер
      </label>

      {registerMutation.error ? <p className="text-sm text-red-600">Ошибка регистрации</p> : null}

      <button
        type="submit"
        disabled={isSubmitting || registerMutation.isPending}
        className="w-full rounded-xl bg-brand-600 px-4 py-2 font-semibold text-white disabled:opacity-60"
      >
        {registerMutation.isPending ? 'Регистрируем...' : 'Зарегистрироваться как мастер'}
      </button>
    </form>
  )
}
