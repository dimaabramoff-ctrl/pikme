import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useLogin } from '../hooks/useLogin'

const loginSchema = z.object({
  emailOrPhone: z.string().min(3, 'Введите email или телефон'),
  password: z.string().min(8, 'Минимум 8 символов'),
})

type LoginFormData = z.infer<typeof loginSchema>

export function LoginForm() {
  const navigate = useNavigate()
  const location = useLocation()
  const loginMutation = useLogin()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (values: LoginFormData) => {
    await loginMutation.mutateAsync(values)
    const query = new URLSearchParams(location.search)
    const returnTo = query.get('returnTo')
    const targetPath = (location.state as { from?: string } | null)?.from
    navigate(returnTo ?? targetPath ?? '/profile', { replace: true })
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label htmlFor="emailOrPhone" className="mb-1 block text-sm font-semibold">
          Email или телефон
        </label>
        <input
          id="emailOrPhone"
          className="w-full rounded-xl border border-slate-300 px-3 py-2"
          {...register('emailOrPhone')}
        />
        {errors.emailOrPhone ? <p className="mt-1 text-sm text-red-600">{errors.emailOrPhone.message}</p> : null}
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-semibold">
          Пароль
        </label>
        <input
          id="password"
          type="password"
          className="w-full rounded-xl border border-slate-300 px-3 py-2"
          {...register('password')}
        />
        {errors.password ? <p className="mt-1 text-sm text-red-600">{errors.password.message}</p> : null}
      </div>

      {loginMutation.error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {(loginMutation.error as { message?: string }).message ?? 'Ошибка входа'}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting || loginMutation.isPending}
        className="w-full rounded-xl bg-brand-600 px-4 py-2 font-semibold text-white disabled:opacity-60"
      >
        {loginMutation.isPending ? 'Входим...' : 'Войти'}
      </button>
    </form>
  )
}
