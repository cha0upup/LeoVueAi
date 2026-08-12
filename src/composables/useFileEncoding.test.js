import { describe, expect, it } from 'vitest'
import { useFileEncoding } from './useFileEncoding.js'

describe('file write encoding contract', () => {
  it('exposes only encodings that can be written losslessly', () => {
    const { encodingOptions } = useFileEncoding()
    expect(encodingOptions.map(option => option.value)).toEqual(['utf-8', 'utf-8-bom'])
  })

  it('adds and removes the UTF-8 BOM without changing content', async () => {
    const { convertEncoding } = useFileEncoding()
    const withBom = await convertEncoding('hello世界', 'utf-8', 'utf-8-bom')

    expect(withBom.charCodeAt(0)).toBe(0xfeff)
    expect(await convertEncoding(withBom, 'utf-8-bom', 'utf-8')).toBe('hello世界')
  })
})
