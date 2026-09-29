import { describe, expect, it } from 'vitest'
import { formatHeadersForEditor, getHeaderEntries, stringifyHeadersForSubmit } from './headers.js'

describe('headers', () => {
  it('converts editor lines into the JSON string stored by the backend', () => {
    const editorText = ['Authorization: Bearer token', 'X-Endpoint: https://example.test:8443'].join('\n')

    expect(JSON.parse(stringifyHeadersForSubmit(editorText))).toEqual({
      Authorization: 'Bearer token',
      'X-Endpoint': 'https://example.test:8443'
    })
  })

  it('formats backend JSON strings for display and editing', () => {
    const storedHeaders = '{"Authorization":"Bearer token","X-Empty":null}'

    expect(getHeaderEntries(storedHeaders)).toEqual([
      ['Authorization', 'Bearer token'],
      ['X-Empty', null]
    ])
    expect(formatHeadersForEditor(storedHeaders)).toBe('Authorization: Bearer token\nX-Empty: ')
  })

  it('preserves header values through an edit and submit round trip', () => {
    const storedHeaders = '{"X-Token":"one:two","Accept":"application/json"}'

    expect(JSON.parse(stringifyHeadersForSubmit(formatHeadersForEditor(storedHeaders)))).toEqual({
      'X-Token': 'one:two',
      Accept: 'application/json'
    })
  })
})
