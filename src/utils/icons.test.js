import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { babelParse, parse as parseSfc } from '@vue/compiler-sfc'
import { icons } from './icons.js'

const sourceFiles = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const path = `${directory}/${entry.name}`
  if (entry.isDirectory()) return entry.name === 'test-support' ? [] : sourceFiles(path)
  return /\.(js|vue)$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name) ? [path] : []
})

describe('application icon registry', () => {
  it('resolves every statically referenced application icon', () => {
    const references = new Set()
    const visit = node => {
      if (!node || typeof node !== 'object') return
      if (['MemberExpression', 'OptionalMemberExpression'].includes(node.type) &&
          ['icons', 'iconMap'].includes(node.object?.name)) {
        const name = node.computed ? node.property?.value : node.property?.name
        if (typeof name === 'string') references.add(name)
      }
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(visit)
        else if (value && typeof value === 'object') visit(value)
      }
    }
    for (const file of sourceFiles(fileURLToPath(new URL('../', import.meta.url)))) {
      const source = readFileSync(file, 'utf8')
      const component = file.endsWith('.vue') ? parseSfc(source).descriptor : null
      const scripts = component ? [component.script?.content, component.scriptSetup?.content] : [source]
      for (const script of scripts.filter(Boolean)) visit(babelParse(script, { sourceType: 'module' }))
      for (const match of (component?.template?.content || '').matchAll(/\b(?:icons|iconMap)(?:\?\.|\.)(\w+)/g)) {
        references.add(match[1])
      }
    }
    expect(references.size).toBeGreaterThan(0)
    expect([...references].filter(name => !Object.hasOwn(icons, name))).toEqual([])
  })

  it('uses complete Iconify identifiers for retained entries', () => {
    for (const icon of Object.values(icons)) expect(icon).toMatch(/^[\w-]+:[\w-]+$/)
  })
})
