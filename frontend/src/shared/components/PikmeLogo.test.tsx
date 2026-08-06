import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PikmeLogo } from './PikmeLogo'

describe('PikmeLogo', () => {
  it('renders scissors mark and PickMe wordmark', () => {
    const { container } = render(<PikmeLogo withWordmark />)

    expect(container.querySelector('svg')).toBeTruthy()
    expect(container.textContent).toContain('PickMe')
    expect(container.textContent).toContain('BEAUTY BOOKING PLATFORM')
  })

  it('renders compact icon without wordmark', () => {
    const { container } = render(<PikmeLogo withWordmark={false} />)

    expect(container.querySelector('svg')).toBeTruthy()
    expect(container.textContent).not.toContain('PickMe')
  })
})
