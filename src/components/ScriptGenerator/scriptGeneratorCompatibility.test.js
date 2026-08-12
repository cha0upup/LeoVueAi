import { describe, expect, it } from 'vitest'

import {
  getPackerCompatibilityWarning,
  isPackerTargetCompatible,
  isServletNamespaceCompatible,
  targetJavaMajor
} from './scriptGeneratorCompatibility.js'

describe('script generator compatibility', () => {
  it('parses target buckets and keeps auto unknown', () => {
    expect(targetJavaMajor('17+')).toBe(17)
    expect(targetJavaMajor('auto')).toBeNull()
  })

  it('blocks only explicit targets below the minimum', () => {
    const metadata = { minTargetJava: 17 }
    expect(isPackerTargetCompatible(metadata, '8')).toBe(false)
    expect(isPackerTargetCompatible(metadata, '17+')).toBe(true)
    expect(isPackerTargetCompatible(metadata, 'auto')).toBe(true)
    expect(isPackerTargetCompatible({ status: 'failed' }, 'auto')).toBe(false)
  })

  it('warns about missing bundled JavaScript engines on modern JDKs', () => {
    const metadata = { requiredCapabilities: ['javascript-engine'] }
    expect(getPackerCompatibilityWarning(metadata, '17+')).toContain('JDK 15+')
    expect(getPackerCompatibilityWarning(metadata, 'auto')).toContain('自动模式')
    expect(getPackerCompatibilityWarning(metadata, '8')).toBe('')
  })

  it('requires JDK 8 or newer for the Jakarta namespace', () => {
    expect(isServletNamespaceCompatible('jakarta', '7')).toBe(false)
    expect(isServletNamespaceCompatible('jakarta', '8')).toBe(true)
    expect(isServletNamespaceCompatible('jakarta', 'auto')).toBe(true)
    expect(isServletNamespaceCompatible('javax', '6')).toBe(true)
  })
})
