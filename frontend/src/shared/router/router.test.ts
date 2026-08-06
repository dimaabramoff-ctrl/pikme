import { describe, expect, it } from 'vitest'
import { router } from './router'

describe('router demo flows', () => {
  it('exposes partner onboarding, voucher activation, and master admin routes', () => {
    const topLevelChildren = router.routes[0]?.children ?? []
    const paths = topLevelChildren.map((route) => route.path).filter(Boolean)

    expect(paths).toContain('partner/register')
    expect(paths).toContain('redeem')
    expect(paths).toContain('master-admin')
  })
})
