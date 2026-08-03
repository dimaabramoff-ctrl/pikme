import { useMutation } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { authApi } from '../api/authApi'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useLogout } from '../hooks/useLogout'

const passwordSchema = z
  .object({
    currentPassword: z.string().min(8, 'Минимум 8 символов'),
    newPassword: z
      .string()
      .min(8, 'Минимум 8 символов')
      .max(128)
      .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, 'Нужны минимум одна буква и одна цифра'),
    newPasswordConfirmation: z.string(),
  })
  .refine((data) => data.newPassword === data.newPasswordConfirmation, {
    message: 'Пароли не совпадают',
    path: ['newPasswordConfirmation'],
  })

type PasswordFormData = z.infer<typeof passwordSchema>

export function ProfilePage() {
  const navigate = useNavigate()
  const logoutMutation = useLogout()
  const logoutAllMutation = useMutation({ mutationFn: authApi.logoutAll })
  const changePasswordMutation = useMutation({ mutationFn: authApi.changePassword })
  const { data: user, isLoading, isError } = useCurrentUser()
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
    return <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">Загрузка профиля...</section>
  }

  if (isError || !user) {
    return <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">Не удалось загрузить профиль.</section>
  }

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <h1 className="text-xl font-bold">Профиль</h1>
      <div className="mt-3 space-y-1 text-sm text-slate-700">
        <p>Имя: {user.name}</p>
        <p>Email: {user.email}</p>
        <p>Телефон: {user.phone}</p>
        <p>Роль: {user.role}</p>
        <p>Верификация: {user.isVerified ? 'Подтвержден' : 'Ожидает подтверждения'}</p>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white" onClick={logout}>
          Выйти
        </button>
        <button className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800" onClick={logoutAll}>
          Выйти на всех устройствах
        </button>
      </div>

      <div className="mt-6 border-t border-slate-200 pt-4">
        <h2 className="text-base font-semibold">Смена пароля</h2>
        <form className="mt-3 space-y-2" onSubmit={handleSubmit(changePassword)}>
          <input
            type="password"
            className="w-full rounded-xl border border-slate-300 px-3 py-2"
            placeholder="Текущий пароль"
            {...register('currentPassword')}
          />
          {errors.currentPassword ? <p className="text-sm text-red-600">{errors.currentPassword.message}</p> : null}

          <input
            type="password"
            className="w-full rounded-xl border border-slate-300 px-3 py-2"
            placeholder="Новый пароль"
            {...register('newPassword')}
          />
          {errors.newPassword ? <p className="text-sm text-red-600">{errors.newPassword.message}</p> : null}

          <input
            type="password"
            className="w-full rounded-xl border border-slate-300 px-3 py-2"
            placeholder="Подтвердите новый пароль"
            {...register('newPasswordConfirmation')}
          />
          {errors.newPasswordConfirmation ? <p className="text-sm text-red-600">{errors.newPasswordConfirmation.message}</p> : null}

          {changePasswordMutation.error ? <p className="text-sm text-red-600">Не удалось сменить пароль</p> : null}

          <button
            type="submit"
            disabled={isSubmitting || changePasswordMutation.isPending}
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {changePasswordMutation.isPending ? 'Сохраняем...' : 'Сменить пароль'}
          </button>
        </form>
      </div>
    </section>
  )
}
