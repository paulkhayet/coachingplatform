import { describe, expect, it } from 'vitest'
import { readCoachingPackage } from './coaching-packages'

function bundleForm() {
  const form = new FormData()
  for (const [name, value] of Object.entries({
    name: 'Eight-week bundle', kind: 'fixed', termWeeks: '8', credits: '8', price: '1200.25',
    installments: 'on', installmentCount: '3', installmentCadence: 'monthly',
    lateCancellation: 'forfeit', expiration: 'end_of_term', makeupExtensionDays: '14',
  })) form.set(name, value)
  form.append('formatName', 'Standard session')
  form.append('formatDuration', '60')
  form.append('formatCredits', '1')
  form.append('formatName', 'Short session')
  form.append('formatDuration', '30')
  form.append('formatCredits', '0.5')
  return form
}

describe('coaching package setup', () => {
  it('keeps money and fractional credits exact when configuring an installment bundle', () => {
    expect(readCoachingPackage(bundleForm())).toMatchObject({
      success: true,
      data: { priceCents: 120025, creditUnits: 800, installmentCount: 3, makeupExtensionDays: 14,
        sessionFormats: [{ durationMinutes: 60, creditUnits: 100 }, { durationMinutes: 30, creditUnits: 50 }] },
    })
  })

  it('clears fixed-term and installment fields when switching to a monthly plan', () => {
    const form = bundleForm()
    form.set('kind', 'monthly')
    expect(readCoachingPackage(form)).toMatchObject({ success: true, data: { termWeeks: null, installmentCount: null, installmentCadence: null } })
  })

  it('rejects session costs above the allowance and selected-coach packages with no coaches', () => {
    const form = bundleForm()
    form.set('credits', '0.5')
    expect(readCoachingPackage(form)).toMatchObject({ success: false, error: { issues: [{ path: ['sessionFormats'] }] } })
    form.set('credits', '8')
    form.set('coachMode', 'selected')
    expect(readCoachingPackage(form)).toMatchObject({ success: false, error: { issues: [{ path: ['eligibleCoachIds'] }] } })
  })
})
