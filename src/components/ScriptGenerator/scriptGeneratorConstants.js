/**
 * 内存马模式的默认启用步骤集合，与后端 jspDefault() 预设对齐
 */
export const MEMSHELL_DEFAULTS = new Set([
  'SPLIT_STRING_LITERALS',
  'CHUNK_PAYLOAD',
  'INJECT_SCRIPTLET_NOISE',
  'INSERT_SCRIPT_NOISE',
])

/** Shared prop contract for the Java runtime section and its configuration panel. */
export const javaRuntimeConfigProps = {
  serverTypes: { type: Array, default: () => [] },
  availableInjectorShellTypes: { type: Array, default: () => [] },
  injectorCapabilities: { type: Array, default: () => [] },
  packerTypesStructure: { type: Object, required: true },
  packerTypesFlat: { type: Array, default: () => [] },
  targetJavaVersions: { type: Array, default: () => ['auto', '6', '7', '8', '9+', '17+'] },
  packerCompatibility: { type: Object, default: () => ({}) },
  servletNamespaces: { type: Array, default: () => ['auto', 'javax', 'jakarta'] },
  transportProtocols: {
    type: Object,
    default: () => ({
      webshell: ['http', 'httpchunk'],
      memoryshell: ['http', 'httpchunk', 'websocket']
    })
  }
}
