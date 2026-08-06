import type { NearbyCatalogItem, NearbyCatalogResponse } from '@pickme/api-types'

export type { NearbyCatalogItem }

export interface NearbyMeta {
  googleRequestsMade: number
  googleRawResults: number
  uniqueResults: number
  returnedOnThisPage: number
  hasMore: boolean
  radiusMetersUsed: number
}

export interface NearbyResponseWithMeta {
  payload: NearbyCatalogResponse
  meta: NearbyMeta
}

export const nearbyApi = {
  list: async (params: {
    latitude: number
    longitude: number
    radius?: number
    query?: string
    category?: string
    limit?: number
  }) => {
    const result = await nearbyApi.listWithMeta(params)
    return result.payload.items
  },

  listWithMeta: async (
    params: {
      latitude: number
      longitude: number
      radius?: number
      query?: string
      category?: string
      limit?: number
      cursor?: string
      filters?: string
    },
    signal?: AbortSignal,
  ) => {
    const url = new URL('/api/catalog/nearby', window.location.origin)
    const search = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        search.set(key, String(value))
      }
    })
    url.search = search.toString()

    const response = await fetch(url.toString(), {
      method: 'GET',
      signal,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ message: 'Request failed' }))
      throw {
        statusCode: response.status,
        code: payload?.code ?? 'HTTP_ERROR',
        message: payload?.message ?? 'Request failed',
      }
    }

    const payload = (await response.json()) as NearbyCatalogResponse
    return {
      payload,
      meta: {
        googleRequestsMade: Number(response.headers.get('x-catalog-google-requests-made') ?? '0'),
        googleRawResults: Number(response.headers.get('x-catalog-google-raw-results') ?? '0'),
        uniqueResults: Number(response.headers.get('x-catalog-unique-results') ?? '0'),
        returnedOnThisPage: Number(response.headers.get('x-catalog-returned-on-this-page') ?? '0'),
        hasMore: response.headers.get('x-catalog-has-more') === 'true',
        radiusMetersUsed: Number(response.headers.get('x-catalog-radius-meters-used') ?? '0'),
      },
    } satisfies NearbyResponseWithMeta
  },
}
