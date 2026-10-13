import { readFileSync } from 'node:fs'
import { compileScript, parse } from '@vue/compiler-sfc'

// Vitest's Node transform emits SSR components; lifecycle tests need real client templates.
export function compileTestComponent(url, modules, id) {
  const { descriptor } = parse(readFileSync(url, 'utf8'))
  const compiled = compileScript(descriptor, { id, inlineTemplate: true }).content
    .replace(/^import\s+(\{[^}]+\}|\w+)\s+from\s+['"]([^'"]+)['"];?$/gm, (_line, names, path) => {
      if (!modules[path]) throw new Error(`Unexpected component import: ${path}`)
      const binding = names.startsWith('{') ? names.replace(/\s+as\s+/g, ': ') : `{ default: ${names} }`
      return `const ${binding} = modules[${JSON.stringify(path)}]`
    })
    .replace('export default', 'return')
  return new Function('modules', compiled)(modules)
}

export function findNode(node, type) {
  if (node.type === type) return node
  for (const child of node.children) {
    const found = findNode(child, type)
    if (found) return found
  }
  return null
}
