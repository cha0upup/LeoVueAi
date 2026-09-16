import { describe, expect, it } from 'vitest'
import { encodeFileText, useFileEncoding } from './useFileEncoding.js'

describe('file write encoding contract', () => {
  it('exposes only encodings that can be written losslessly', () => {
    const { encodingOptions } = useFileEncoding()
    expect(encodingOptions.map((option) => option.value)).toEqual(['utf-8', 'utf-8-bom'])
  })

  it('adds and removes the UTF-8 BOM without changing content', () => {
    const withBom = encodeFileText('hello世界', 'utf-8-bom')

    expect(withBom.charCodeAt(0)).toBe(0xfeff)
    expect(encodeFileText(withBom, 'utf-8')).toBe('hello世界')
    expect(encodeFileText(withBom, 'utf-8-bom')).toBe(withBom)
  })
  it('decodes URL-safe unpadded base64 and preserves the BOM', () => {
    const { decodeBase64ToString, detectEncoding } = useFileEncoding()
    expect(decodeBase64ToString('8J-YgA\n')).toBe('😀')
    const withBom = decodeBase64ToString('77u/aGVsbG8=')
    expect(withBom).toBe('\uFEFFhello')
    expect(detectEncoding(withBom)).toBe('utf-8-bom')
    expect(detectEncoding('hello')).toBe('utf-8')
  })
})
