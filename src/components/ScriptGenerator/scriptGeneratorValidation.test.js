import { describe, expect, it } from 'vitest'

import { isScriptGeneratorFormValid } from './scriptGeneratorValidation.js'

const base = {
  generateType: 'webshell',
  reqDisguiseId: 'request',
  respDisguiseId: 'response',
  shellType: 'JSP',
  protocol: 'http',
  respCode: 200
}

describe('isScriptGeneratorFormValid', () => {
  it('always returns a boolean for a valid webshell form', () => {
    const result = isScriptGeneratorFormValid(base)

    expect(result).toBe(true)
    expect(typeof result).toBe('boolean')
  })

  it('requires protocol for JSP and JSPX', () => {
    expect(isScriptGeneratorFormValid({ ...base, protocol: '' })).toBe(false)
  })

  it('requires all HTTP memory-shell trigger fields', () => {
    const form = {
      ...base,
      generateType: 'memoryshell',
      serverType: 'tomcat',
      shellType: 'listener',
      packerType: 'gzip',
      headerName: 'X-Key',
      headerValue: 'secret',
      urlPattern: '/*'
    }
    expect(isScriptGeneratorFormValid(form)).toBe(true)
    expect(isScriptGeneratorFormValid({ ...form, headerValue: ' ' })).toBe(false)
  })

  it('does not require a header for WebSocket but requires an endpoint path', () => {
    const form = {
      ...base,
      generateType: 'memoryshell',
      protocol: 'websocket',
      serverType: 'Tomcat',
      shellType: 'WebSocketInjector',
      packerType: 'DefaultBase64',
      headerName: '',
      headerValue: '',
      urlPattern: '/leo'
    }
    expect(isScriptGeneratorFormValid(form)).toBe(true)
    expect(isScriptGeneratorFormValid({ ...form, urlPattern: '/*' })).toBe(false)
  })

  it('accepts PHP generation and requires a complete optional header pair', () => {
    const php = { ...base, runtime: 'php', shellType: 'PHP', phpOutputMode: 'compact' }
    expect(isScriptGeneratorFormValid(php)).toBe(true)
    expect(isScriptGeneratorFormValid({ ...php, phpOutputMode: 'packed' })).toBe(true)
    expect(isScriptGeneratorFormValid({ ...php, phpOutputMode: 'portable' })).toBe(true)
    expect(isScriptGeneratorFormValid({ ...php, phpOutputMode: 'unknown' })).toBe(false)
    expect(isScriptGeneratorFormValid({ ...php, headerName: 'X-Key', headerValue: '' })).toBe(false)
    expect(isScriptGeneratorFormValid({ ...php, headerName: 'X-Key', headerValue: 'token' })).toBe(true)
  })
})
