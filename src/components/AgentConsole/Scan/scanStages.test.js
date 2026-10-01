import { describe, expect, it } from 'vitest'
import { selectScanStages, toggleScanStage } from './scanStages.js'

describe('scan stage selection', () => {
  it('enables component dependencies and removes components when a dependency is disabled', () => {
    const selected = toggleScanStage([], 'FINGERPRINT', true)
    expect(selected).toEqual(['PORT_SCAN', 'SERVICE_PROBE', 'FINGERPRINT'])
    expect(toggleScanStage(selected, 'SERVICE_PROBE', false)).toEqual(['PORT_SCAN'])
    expect(toggleScanStage(selected, 'PORT_SCAN', false)).toEqual([])
    expect(selectScanStages().map(stage => stage.name)).not.toContain('FINGERPRINT')
  })

  it('switches from the full workflow to discovery only without leaving service probes enabled', () => {
    const allStages = selectScanStages().map(stage => stage.name)
    const discoveryOnly = toggleScanStage(allStages, 'PORT_SCAN', false)
    expect(discoveryOnly).toEqual(['REACHABILITY'])
    expect(toggleScanStage(discoveryOnly, 'REACHABILITY', false)).toEqual([])
    expect(allStages).toEqual(['REACHABILITY', 'PORT_SCAN', 'SERVICE_PROBE'])
  })

  it('can identify services while bypassing discovery and preserves the port dependency', () => {
    const discoveryOnly = ['REACHABILITY']
    const withServices = toggleScanStage(discoveryOnly, 'SERVICE_PROBE', true)
    expect(withServices).toEqual(['REACHABILITY', 'PORT_SCAN', 'SERVICE_PROBE'])
    const skipDiscovery = toggleScanStage(withServices, 'REACHABILITY', false)
    expect(skipDiscovery).toEqual(['PORT_SCAN', 'SERVICE_PROBE'])
    expect(toggleScanStage(skipDiscovery, 'SERVICE_PROBE', false)).toEqual(['PORT_SCAN'])
    expect(discoveryOnly).toEqual(['REACHABILITY'])
  })
})
