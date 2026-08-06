export const salonKeys = {
  all: ['salons'] as const,
  list: (params?: Record<string, unknown>) => [...salonKeys.all, { params }] as const,
  detail: (id: string) => [...salonKeys.all, id] as const,
}

export const masterKeys = {
  all: ['masters'] as const,
  list: (params?: Record<string, unknown>) => [...masterKeys.all, { params }] as const,
  detail: (id: string) => [...masterKeys.all, id] as const,
}

export const serviceKeys = {
  all: ['services'] as const,
  list: (params?: Record<string, unknown>) => [...serviceKeys.all, { params }] as const,
}

export const scheduleKeys = {
  all: ['schedules'] as const,
  detail: (masterId: string) => [...scheduleKeys.all, masterId] as const,
}

export const reviewKeys = {
  all: ['reviews'] as const,
  list: (params?: Record<string, unknown>) => [...reviewKeys.all, { params }] as const,
}

export const favoriteKeys = {
  all: ['favorites'] as const,
  list: () => [...favoriteKeys.all] as const,
}

export const bookingKeys = {
  all: ['bookings'] as const,
  slots: (params: Record<string, unknown>) => [...bookingKeys.all, 'slots', { params }] as const,
}
