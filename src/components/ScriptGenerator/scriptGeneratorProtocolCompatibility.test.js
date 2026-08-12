import { describe, expect, it } from 'vitest'

import {
  filterPackerTypesStructure,
  isPackerProtocolCompatible,
  normalizeTransportProtocol,
  reconcileMemoryProtocolSelection
} from './scriptGeneratorProtocolCompatibility.js'

describe('script generator protocol compatibility', () => {
  it('normalizes the protocol key used to read the backend capability matrix', () => {
    expect(normalizeTransportProtocol(' HTTPCHUNK ')).toBe('httpchunk')
    expect(normalizeTransportProtocol(undefined)).toBe('http')
  })

  it('filters packer groups with backend protocol metadata', () => {
    const packers = {
      groups: [{ groupName: 'Base64', packers: ['AllProtocols', 'HttpOnly'] }],
      ungrouped: ['WebSocketOnly'],
      flat: ['AllProtocols', 'HttpOnly', 'WebSocketOnly']
    }
    const compatibility = {
      AllProtocols: { supportedProtocols: ['http', 'httpchunk', 'websocket'] },
      HttpOnly: { supportedProtocols: ['http'] },
      WebSocketOnly: { supportedProtocols: ['websocket'] }
    }

    expect(filterPackerTypesStructure(packers, compatibility, 'websocket')).toEqual({
      groups: [{ groupName: 'Base64', packers: ['AllProtocols'] }],
      ungrouped: ['WebSocketOnly'],
      flat: ['AllProtocols', 'WebSocketOnly']
    })
    expect(isPackerProtocolCompatible(undefined, 'httpchunk')).toBe(false)
  })

  it('repairs stale selections and auto-selects the only compatible injector', () => {
    const form = {
      serverType: 'SpringWebMVC',
      shellType: 'InterceptorInjector',
      packerType: 'HttpOnly'
    }

    reconcileMemoryProtocolSelection({
      form,
      serverInjectorTypes: { Tomcat: ['WebSocketInjector'] },
      compatiblePackerNames: ['AllProtocols']
    })

    expect(form).toEqual({
      serverType: 'Tomcat',
      shellType: 'WebSocketInjector',
      packerType: ''
    })
  })
})
