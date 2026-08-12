import { icons } from '@/utils/icons.js'

const EXTENSION_GROUPS = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico', 'avif', 'heic'],
  video: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm', 'm4v'],
  audio: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma'],
  archive: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz'],
  pdf: ['pdf'],
  word: ['doc', 'docx', 'odt', 'rtf'],
  excel: ['xls', 'xlsx', 'csv', 'tsv', 'ods'],
  ppt: ['ppt', 'pptx', 'key', 'odp'],
  code: [
    'js',
    'mjs',
    'cjs',
    'ts',
    'jsx',
    'tsx',
    'vue',
    'html',
    'htm',
    'css',
    'scss',
    'sass',
    'less',
    'java',
    'kt',
    'py',
    'rb',
    'go',
    'rs',
    'cpp',
    'cc',
    'cxx',
    'c',
    'h',
    'hpp',
    'swift',
    'sh',
    'bash',
    'zsh',
    'ps1',
    'sql'
  ],
  json: ['json', 'jsonl'],
  markdown: ['md', 'markdown'],
  text: ['txt', 'log', 'ini', 'conf', 'cfg', 'yml', 'yaml', 'toml', 'properties'],
  font: ['ttf', 'otf', 'woff', 'woff2', 'eot'],
  executable: ['exe', 'msi', 'bat', 'cmd', 'apk', 'app', 'deb', 'rpm', 'dmg', 'pkg', 'bin'],
  book: ['epub', 'mobi', 'azw3']
}

const ICON_BY_TYPE = {
  image: { icon: icons.picture, className: 'image-icon' },
  video: { icon: icons.video, className: 'video-icon' },
  audio: { icon: icons.musicNote, className: 'audio-icon' },
  archive: { icon: icons.compress, className: 'archive-icon' },
  pdf: { icon: icons.filePdf, className: 'pdf-icon' },
  word: { icon: icons.fileWord, className: 'word-icon' },
  excel: { icon: icons.fileExcel, className: 'excel-icon' },
  ppt: { icon: icons.filePowerPoint, className: 'ppt-icon' },
  code: { icon: icons.codeFile, className: 'code-icon' },
  json: { icon: icons.codeJson, className: 'json-icon' },
  markdown: { icon: icons.markdown, className: 'markdown-icon' },
  text: { icon: icons.document, className: 'text-icon' },
  font: { icon: icons.fontFile, className: 'font-icon' },
  executable: { icon: icons.applicationCog, className: 'executable-icon' },
  book: { icon: icons.bookOpenPageVariant, className: 'book-icon' },
  default: { icon: icons.file, className: 'file-icon' }
}

const COLOR_BY_TYPE = {
  folder: 'var(--el-color-primary)',
  image: 'var(--el-color-success)',
  archive: 'var(--el-color-warning)',
  default: 'var(--el-text-color-secondary)'
}

export const getFileTypeNameByExtension = (extension = '') => {
  const normalized = String(extension).trim().toLowerCase().replace(/^\./, '')
  if (!normalized) return 'default'

  for (const [type, extensions] of Object.entries(EXTENSION_GROUPS)) {
    if (extensions.includes(normalized)) return type
  }

  return 'default'
}

export const getFileIconMeta = (file = {}) => {
  if (file.isDirectory) {
    return {
      icon: icons.folder,
      className: 'folder-icon'
    }
  }

  const type = getFileTypeNameByExtension(file.extension || '')
  return ICON_BY_TYPE[type] || ICON_BY_TYPE.default
}

export const getFileIconPresentation = (file = {}) => {
  if (file.isDirectory) {
    return {
      icon: icons.folder,
      className: 'folder-icon',
      color: COLOR_BY_TYPE.folder,
      type: 'folder'
    }
  }

  const extension =
    file.extension ||
    file.ext ||
    String(file.name || '')
      .split('.')
      .pop() ||
    ''
  const type = getFileTypeNameByExtension(extension)
  const iconMeta = ICON_BY_TYPE[type] || ICON_BY_TYPE.default

  return {
    ...iconMeta,
    color: COLOR_BY_TYPE[type] || COLOR_BY_TYPE.default,
    type
  }
}
