import { afterEach, describe, expect, it, vi } from 'vitest'

const luminance = hex => {
  const channels = hex.match(/[a-f\d]{2}/gi).map(value => parseInt(value, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) /
  (Math.min(luminance(a), luminance(b)) + 0.05)

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

describe('theme palette', () => {
  it('keeps dark primary surfaces dark and their foreground readable', async () => {
    vi.stubGlobal('window', {})
    const { useTheme } = await import('./theme.js')
    const dark = useTheme().themes.dark
    for (const step of [7, 8, 9]) expect(luminance(dark[`--el-color-primary-light-${step}`])).toBeLessThan(0.06)
    expect(contrast(dark['--el-color-primary-dark-2'], dark['--el-color-primary-light-8'])).toBeGreaterThan(4.5)
    expect(contrast(dark['--el-text-color-primary'], dark['--el-bg-color-overlay'])).toBeGreaterThan(7)
  })

  it('preserves light/dark preference values, theme labels and document color scheme', async () => {
    const storage = { getItem: vi.fn(), setItem: vi.fn() }
    const root = { style: { setProperty: vi.fn() }, classList: { add: vi.fn(), remove: vi.fn() }, setAttribute: vi.fn() }
    vi.stubGlobal('window', { localStorage: storage })
    vi.stubGlobal('document', { documentElement: root })
    const { useTheme } = await import('./theme.js')
    const theme = useTheme()
    expect(theme.getAvailableThemes().map(item => [item.name, item.value])).toEqual([['明亮', 'light'], ['黑暗', 'dark']])
    theme.setTheme('dark')
    expect(root.style.colorScheme).toBe('dark')
    expect(root.setAttribute).toHaveBeenCalledWith('data-theme', 'dark')
    expect(storage.setItem).toHaveBeenLastCalledWith(expect.any(String), 'dark')
    theme.setTheme('light')
    expect(root.style.colorScheme).toBe('light')
    expect(theme.currentTheme.value).toBe('light')
  })
})
