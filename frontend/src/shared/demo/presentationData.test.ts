import {
  calculatePresentationTravelFee,
  getPresentationHomeAddressOptions,
} from './presentationData'

describe('presentationData travel fee', () => {
  it('applies minimum travel fee of 5 euro', () => {
    expect(calculatePresentationTravelFee(3)).toBe(5)
  })

  it('calculates 8km as 8 euro round trip by formula', () => {
    expect(calculatePresentationTravelFee(8)).toBe(8)
  })

  it('keeps 15km as 15 euro', () => {
    expect(calculatePresentationTravelFee(15)).toBe(15)
  })

  it('returns stable demo distance for address selection', () => {
    const options = getPresentationHomeAddressOptions('demo-anna')
    const selected = options.find((item) => item.label.includes('Schweriner'))
    expect(selected?.demoDistanceKm).toBe(3)
  })
})
