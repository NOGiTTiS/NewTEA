import { describe, expect, it } from 'bun:test'
import {
  hexToRgb,
  rgbToHex,
  mixColors,
  getContrastColor,
  generateColorPalette,
  DEFAULT_DAY_COLORS,
  resolveEffectiveThemeColor
} from '@/components/dynamic-branding'

describe('Dynamic Branding Engine', () => {
  it('hexToRgb accurately converts hex color to rgb components', () => {
    const rgb1 = hexToRgb('#5f06c4')
    expect(rgb1).toEqual({ r: 95, g: 6, b: 196 })

    const rgb2 = hexToRgb('#ffffff')
    expect(rgb2).toEqual({ r: 255, g: 255, b: 255 })

    const rgb3 = hexToRgb('#000000')
    expect(rgb3).toEqual({ r: 0, g: 0, b: 0 })

    // Invalid fallback
    const fallback = hexToRgb('invalid')
    expect(fallback).toEqual({ r: 95, g: 6, b: 196 })
  })

  it('rgbToHex converts rgb values to valid hex code', () => {
    expect(rgbToHex(95, 6, 196)).toBe('#5f06c4')
    expect(rgbToHex(255, 255, 255)).toBe('#ffffff')
    expect(rgbToHex(0, 0, 0)).toBe('#000000')
    // Clamping test
    expect(rgbToHex(300, -10, 128)).toBe('#ff0080')
  })

  it('mixColors interpolates between two colors', () => {
    const white = { r: 255, g: 255, b: 255 }
    const black = { r: 0, g: 0, b: 0 }
    const mid = mixColors(black, white, 0.5)
    expect(mid).toBe('#808080')
  })

  it('getContrastColor returns high contrast foreground for dark and light backgrounds', () => {
    expect(getContrastColor({ r: 255, g: 255, b: 255 })).toBe('#0f172a') // Dark text on white
    expect(getContrastColor({ r: 0, g: 0, b: 0 })).toBe('#ffffff') // Light text on black
    expect(getContrastColor({ r: 95, g: 6, b: 196 })).toBe('#ffffff') // Brand purple needs white text
  })

  it('generateColorPalette generates 50 through 950 shades and foreground', () => {
    const palette = generateColorPalette('#5f06c4')
    expect(palette[500]).toBe('#5f06c4')
    expect(palette[50]).toMatch(/^#[0-9A-Fa-f]{6}$/)
    expect(palette[100]).toMatch(/^#[0-9A-Fa-f]{6}$/)
    expect(palette[950]).toMatch(/^#[0-9A-Fa-f]{6}$/)
    expect(palette.foreground).toBe('#ffffff')
  })

  it('DEFAULT_DAY_COLORS defines all 7 days of the week', () => {
    expect(Object.keys(DEFAULT_DAY_COLORS).length).toBe(7)
    expect(DEFAULT_DAY_COLORS[0].name).toBe('วันอาทิตย์')
    expect(DEFAULT_DAY_COLORS[0].defaultHex).toBe('#dc2626')
    expect(DEFAULT_DAY_COLORS[1].name).toBe('วันจันทร์')
    expect(DEFAULT_DAY_COLORS[1].defaultHex).toBe('#eab308')
    expect(DEFAULT_DAY_COLORS[2].name).toBe('วันอังคาร')
    expect(DEFAULT_DAY_COLORS[2].defaultHex).toBe('#ec4899')
    expect(DEFAULT_DAY_COLORS[3].name).toBe('วันพุธ')
    expect(DEFAULT_DAY_COLORS[3].defaultHex).toBe('#059669')
    expect(DEFAULT_DAY_COLORS[4].name).toBe('วันพฤหัสบดี')
    expect(DEFAULT_DAY_COLORS[4].defaultHex).toBe('#ea580c')
    expect(DEFAULT_DAY_COLORS[5].name).toBe('วันศุกร์')
    expect(DEFAULT_DAY_COLORS[5].defaultHex).toBe('#0284c7')
    expect(DEFAULT_DAY_COLORS[6].name).toBe('วันเสาร์')
    expect(DEFAULT_DAY_COLORS[6].defaultHex).toBe('#7c3aed')
  })

  it('resolveEffectiveThemeColor returns custom primary color when auto theme is disabled', () => {
    const settings = {
      theme_auto_color_enabled: 'false',
      theme_primary_color: '#2563eb'
    }
    expect(resolveEffectiveThemeColor(settings)).toBe('#2563eb')
  })

  it('resolveEffectiveThemeColor falls back to #5f06c4 when invalid primary is provided', () => {
    const settings = {
      theme_auto_color_enabled: 'false',
      theme_primary_color: 'invalid-hex'
    }
    expect(resolveEffectiveThemeColor(settings)).toBe('#5f06c4')
  })

  it('resolveEffectiveThemeColor returns day color when auto theme is enabled', () => {
    const todayIndex = new Date().getDay()
    const expectedDefaultHex = DEFAULT_DAY_COLORS[todayIndex].defaultHex

    const settings = {
      theme_auto_color_enabled: 'true',
      theme_primary_color: '#2563eb'
    }
    expect(resolveEffectiveThemeColor(settings)).toBe(expectedDefaultHex)
  })

  it('resolveEffectiveThemeColor respects customized day color when auto theme is enabled', () => {
    const todayIndex = new Date().getDay()
    const todayKey = DEFAULT_DAY_COLORS[todayIndex].key

    const settings: Record<string, string> = {
      theme_auto_color_enabled: 'true',
      theme_primary_color: '#2563eb',
      [todayKey]: '#10b981'
    }
    expect(resolveEffectiveThemeColor(settings)).toBe('#10b981')
  })
})
