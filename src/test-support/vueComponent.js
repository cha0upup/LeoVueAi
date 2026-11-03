import * as Vue from 'vue'
import { readFileSync } from 'node:fs'
import { compileScript, parse } from '@vue/compiler-sfc'

// Node's default SFC transform targets SSR. Lifecycle/interaction fixtures need
// the real client render function instead; imports are supplied explicitly.
export function compileClientComponent(url, modules = {}, id = 'client-fixture') {
  const { descriptor } = parse(readFileSync(url, 'utf8'))
  const imports = { vue: Vue, ...modules }
  const compiled = compileScript(descriptor, { id, inlineTemplate: true }).content
    .replace(/^import\s+(\{[^}]+\}|\w+)\s+from\s+['"]([^'"]+)['"];?$/gm, (_line, names, path) => {
      if (!imports[path]) throw new Error(`Unexpected fixture import: ${path}`)
      const binding = names.startsWith('{') ? names.replace(/\s+as\s+/g, ': ') : `{ default: ${names} }`
      return `const ${binding} = modules[${JSON.stringify(path)}]`
    })
    .replace(/import\.meta\.env\.DEV/g, 'false')
    .replace('export default', 'return')
  return new Function('modules', compiled)(imports)
}

export function findNode(node, type) {
  if (node.type === type) return node
  for (const child of node.children) {
    const found = findNode(child, type)
    if (found) return found
  }
  return null
}

export function findNodes(node, predicate = () => true) {
  return [
    ...(predicate(node) ? [node] : []),
    ...node.children.flatMap(child => findNodes(child, predicate))
  ]
}

// Forward attributes and only the slots exercised by the fixture, in order.
export function createSlotStub(name, slotNames = ['default']) {
  return Vue.defineComponent({
    inheritAttrs: false,
    setup(_props, { attrs, slots }) {
      return () => Vue.h(name, attrs, slotNames.length === 1
        ? slots[slotNames[0]]?.()
        : slotNames.map(slot => slots[slot]?.()))
    }
  })
}
