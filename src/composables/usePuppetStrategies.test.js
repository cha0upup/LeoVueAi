import { describe, expect, it } from 'vitest'

import { usePuppetStrategies } from './usePuppetStrategies.js'

describe('usePuppetStrategies', () => {
  it('loads strategy objects and JSON strings into a shared form model', () => {
    const strategies = usePuppetStrategies()

    strategies.loadStrategies({
      urlStrategy: JSON.stringify({
        enabled: true,
        mode: 'POOL',
        prefix: '/api',
        urlPool: ['/one', '/two'],
        extensions: ['json', 'html']
      }),
      paddingStrategy: {
        enabled: true,
        lengthDistribution: 'GAUSSIAN',
        minBytes: 128,
        maxBytes: 2048
      },
      tlsFingerprintStrategy: JSON.stringify({
        enabled: true,
        profile: 'FIREFOX_MODERN',
        rotate: true
      })
    })

    expect(strategies.urlStrategyEnabled.value).toBe(true)
    expect(strategies.urlStrategyForm.urlPoolText).toBe('/one\n/two')
    expect(strategies.urlStrategyForm.extensionsText).toBe('json,html')
    expect(strategies.paddingForm.lengthDistribution).toBe('GAUSSIAN')
    expect(strategies.tlsFingerprintForm).toMatchObject({
      profile: 'FIREFOX_MODERN',
      rotate: true
    })
  })

  it('resets invalid strategies instead of retaining stale form values', () => {
    const strategies = usePuppetStrategies()
    strategies.urlStrategyEnabled.value = true
    strategies.urlStrategyForm.prefix = '/stale'

    strategies.loadStrategies({ urlStrategy: '{broken' })

    expect(strategies.urlStrategyEnabled.value).toBe(false)
    expect(strategies.urlStrategyForm.prefix).toBe('')
  })

  it('serializes normalized lists and preserves TLS rotation', () => {
    const strategies = usePuppetStrategies()
    strategies.urlStrategyEnabled.value = true
    strategies.urlStrategyForm.urlPoolText = ' /one \n\n/two\n/one '
    strategies.urlStrategyForm.extensionsText = ' json, html, '
    strategies.tlsFingerprintEnabled.value = true
    strategies.tlsFingerprintForm.profile = 'CHROME_MODERN'
    strategies.tlsFingerprintForm.rotate = true

    expect(JSON.parse(strategies.buildUrlStrategyJson())).toEqual({
      enabled: true,
      mode: 'POOL',
      prefix: null,
      urlPool: ['/one', '/two', '/one'],
      extensions: ['json', 'html']
    })
    expect(JSON.parse(strategies.buildTlsFingerprintStrategyJson())).toEqual({
      enabled: true,
      profile: 'CHROME_MODERN',
      rotate: true
    })
  })

  it('applies known padding presets and merges probed paths without duplicates', () => {
    const strategies = usePuppetStrategies()
    expect(strategies.applyPaddingPreset('stealth')).toBe(true)
    expect(strategies.paddingForm).toMatchObject({
      lengthDistribution: 'GAUSSIAN',
      minBytes: 128,
      maxBytes: 2048
    })

    strategies.urlStrategyForm.urlPoolText = '/existing\n/shared'
    expect(strategies.mergeUrlPoolPaths(['/shared', '/new'])).toEqual([
      '/existing',
      '/shared',
      '/new'
    ])
  })
})
