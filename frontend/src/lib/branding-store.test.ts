import { describe, expect, it } from 'bun:test'
import { useBrandingStore } from './branding-store'

describe('Branding Store Unit Tests', () => {
  it('initializes with default system name and copyright', () => {
    const state = useBrandingStore.getState()
    expect(state.systemName).toBeDefined()
    expect(state.schoolName).toContain('เตรียมอุดมศึกษา')
    expect(state.siteCopyright).toContain('© 2026')
  })

  it('updates branding fields correctly', () => {
    const { setBranding } = useBrandingStore.getState()

    setBranding({
      systemName: 'Custom Assessment System',
      schoolName: 'โรงเรียนตัวอย่าง',
      siteLogo: '/uploads/branding/custom-logo.png',
      siteFavicon: '/uploads/branding/custom-favicon.ico',
      siteCopyright: '© 2026 Example School'
    })

    const updated = useBrandingStore.getState()
    expect(updated.systemName).toBe('Custom Assessment System')
    expect(updated.schoolName).toBe('โรงเรียนตัวอย่าง')
    expect(updated.siteLogo).toBe('/uploads/branding/custom-logo.png')
    expect(updated.siteFavicon).toBe('/uploads/branding/custom-favicon.ico')
    expect(updated.siteCopyright).toBe('© 2026 Example School')
  })

  it('partially updates fields without overwriting unrelated fields', () => {
    const { setBranding } = useBrandingStore.getState()

    setBranding({
      siteLogo: '/uploads/branding/new-logo.png'
    })

    const updated = useBrandingStore.getState()
    expect(updated.siteLogo).toBe('/uploads/branding/new-logo.png')
    expect(updated.systemName).toBe('Custom Assessment System')
    expect(updated.siteFavicon).toBe('/uploads/branding/custom-favicon.ico')
  })

  it('resets logo and favicon to empty string when cleared', () => {
    const { setBranding } = useBrandingStore.getState()

    setBranding({
      siteLogo: '',
      siteFavicon: ''
    })

    const updated = useBrandingStore.getState()
    expect(updated.siteLogo).toBe('')
    expect(updated.siteFavicon).toBe('')
  })
})
