import { describe, expect, it } from 'vitest'
import { archiveFormat, stripArchiveExtension, supportsFileAction } from './fileCapabilities.js'

describe('file operation capabilities', () => {
  it.each([
    ['a.TAR.GZ', 'tar.gz', 'a'],
    ['a.TGZ', 'tar.gz', 'a'],
    ['a.ZIP', 'zip', 'a'],
    ['a.gzip', 'gzip', 'a'],
    ['notes.txt', null, 'notes.txt'],
    ['', null, 'archive']
  ])('uses the same archive suffix for %s format and output name', (name, format, stem) => {
    expect(archiveFormat(name)).toBe(format)
    expect(stripArchiveExtension(name)).toBe(stem)
  })
  it('hides unadvertised enhancements and directory copy', () => {
    expect(supportsFileAction({}, 'rename')).toBe(false)
    expect(supportsFileAction({ rename: true }, 'rename')).toBe(true)
    expect(supportsFileAction({}, 'copy', { isDirectory: true })).toBe(false)
    expect(supportsFileAction({}, 'copy', { isDirectory: false })).toBe(true)
  })
  it('offers only advertised archive formats', () => {
    const php = { compressionFormats: ['zip'], extractionFormats: ['zip'] }
    expect(supportsFileAction(php, 'decompress', { name: 'a.tar.gz' })).toBe(false)
    expect(supportsFileAction(php, 'decompress', { name: 'a.ZIP' })).toBe(true)
    expect(archiveFormat('a.TGZ')).toBe('tar.gz')
  })
})
