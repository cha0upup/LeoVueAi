import { expect, it } from 'vitest'
import { formatHeadersForEditor, stringifyHeadersForSubmit } from './headers.js'

it('round-trips stored custom headers with colons and editable empty values', () => {
  const storedHeaders = '{"X-Endpoint":"https://example.test:8443","X-Empty":null}'
  const editorText = formatHeadersForEditor(storedHeaders)

  expect(editorText).toBe('X-Endpoint: https://example.test:8443\nX-Empty: ')
  expect(JSON.parse(stringifyHeadersForSubmit(editorText))).toEqual({
    'X-Endpoint': 'https://example.test:8443',
    'X-Empty': ''
  })
})
