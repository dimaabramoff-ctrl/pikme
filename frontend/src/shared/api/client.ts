import type { ApiError } from '@pickme/api-types'
import { useAuthStore } from '../../features/auth/authStore'
import type { AuthResponse } from '../../features/auth/authTypes'

const DEFAULT_TIMEOUT_MS = 10_000

interface RequestOptions extends RequestInit {
  timeoutMs?: number
  requestId?: string
  skipAuthRefresh?: boolean
  params?: Record<string, string | number | boolean | undefined>
}

export class ApiClient {
  private readonly baseUrl: string
  private refreshPromise: Promise<string | null> | null = null
  private hasRefreshFailure = false

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  async request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
    const accessToken = useAuthStore.getState().accessToken

    try {
      const url = new URL(path.startsWith('http') ? path : `${this.baseUrl}${path}`, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
      if (options.params) {
        const search = new URLSearchParams()
        Object.entries(options.params).forEach(([key, value]) => {
          if (value !== undefined) {
            search.set(key, String(value))
          }
        })
        url.search = search.toString()
      }

      let response: Response
      try {
        response = await fetch(url.toString(), {
          credentials: 'include',
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            ...(options.requestId ? { 'x-request-id': options.requestId } : {}),
            ...options.headers,
          },
          signal: options.signal ?? controller.signal,
        })
      } catch (error) {
        this.hasRefreshFailure = true
        throw {
          statusCode: 503,
          code: 'NETWORK_ERROR',
          message: 'Der Server ist gerade nicht verfügbar.',
          details: error instanceof Error ? error.message : undefined,
        } satisfies ApiError
      }

      if (
        response.status === 401 &&
        !options.skipAuthRefresh &&
        !isRetry &&
        path !== '/auth/refresh'
      ) {
        if (this.hasRefreshFailure) {
          throw {
            statusCode: 503,
            code: 'NETWORK_ERROR',
            message: 'Der Server ist gerade nicht verfügbar.',
          } satisfies ApiError
        }

        const newAccessToken = await this.refreshAccessToken()

        if (newAccessToken) {
          return this.request<T>(path, options, true)
        }

        this.hasRefreshFailure = true
        useAuthStore.getState().clearAuth()
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          const returnPath = `${window.location.pathname}${window.location.search}`
          window.location.href = `/login?returnTo=${encodeURIComponent(returnPath)}`
        }
        throw {
          statusCode: 503,
          code: 'NETWORK_ERROR',
          message: 'Der Server ist gerade nicht verfügbar.',
        } satisfies ApiError
      }

      if (response.ok) {
        this.hasRefreshFailure = false
      }

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as ApiError | null
        throw {
          statusCode: response.status,
          code: errorPayload?.code ?? 'HTTP_ERROR',
          message: errorPayload?.message ?? 'Request failed',
          details: errorPayload?.details,
          requestId: errorPayload?.requestId,
        } satisfies ApiError
      }

      const text = await response.text()
      if (!text) {
        return {} as T
      }

      return JSON.parse(text) as T
    } finally {
      clearTimeout(timeout)
    }
  }

  private async refreshAccessToken(): Promise<string | null> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.executeRefresh()
    }

    const result = await this.refreshPromise
    this.refreshPromise = null
    return result
  }

  private async executeRefresh(): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      if (!response.ok) {
        this.hasRefreshFailure = true
        return null
      }

      const payload = (await response.json()) as AuthResponse
      const store = useAuthStore.getState()
      store.setAccessToken(payload.accessToken)
      store.setCurrentUser(payload.user)
      store.setAuthResolved(true)
      this.hasRefreshFailure = false
      return payload.accessToken
    } catch (error) {
      this.hasRefreshFailure = true
      return null
    }
  }
}

export const apiClient = new ApiClient(import.meta.env.VITE_API_URL || '/api')
