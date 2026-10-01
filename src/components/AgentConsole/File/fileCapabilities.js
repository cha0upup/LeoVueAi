export const FILE_CAPABILITIES_KEY = Symbol('fileCapabilities')

const ARCHIVE_EXTENSIONS = {
  '.tar.gz': 'tar.gz',
  '.tgz': 'tar.gz',
  '.tar': 'tar',
  '.gzip': 'gzip',
  '.gz': 'gzip',
  '.zip': 'zip'
}

function archiveExtension(name) {
  const lower = String(name || '').toLowerCase()
  return Object.keys(ARCHIVE_EXTENSIONS).find((suffix) => lower.endsWith(suffix)) || ''
}

export function archiveFormat(name) {
  return ARCHIVE_EXTENSIONS[archiveExtension(name)] || null
}

export function stripArchiveExtension(name) {
  const filename = String(name || 'archive')
  return filename.slice(0, filename.length - archiveExtension(filename).length)
}

export function supportsFileAction(capabilities = {}, action, file = {}) {
  if (['grep', 'touch', 'pack', 'rename', 'chmod'].includes(action))
    return capabilities[action] === true
  if (action === 'copy' && file.isDirectory) return capabilities.copyDirectory === true
  if (action === 'compress') return (capabilities.compressionFormats || []).includes('zip')
  if (action === 'decompress')
    return (capabilities.extractionFormats || []).includes(archiveFormat(file.name))
  return true
}
