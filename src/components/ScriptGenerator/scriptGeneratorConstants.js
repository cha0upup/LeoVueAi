/**
 * 内存马模式的默认启用步骤集合，与后端 jspDefault() 预设对齐
 */
export const MEMSHELL_DEFAULTS = new Set([
  'SPLIT_STRING_LITERALS',
  'CHUNK_PAYLOAD',
  'INJECT_SCRIPTLET_NOISE',
  'INSERT_SCRIPT_NOISE',
])
