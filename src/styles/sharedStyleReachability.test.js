import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compileStyle, parse } from '@vue/compiler-sfc'
import { describe, expect, it } from 'vitest'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const sharedStyles = [
  'assets/global.css', 'styles/design-tokens.css', 'styles/agent-form-dialog-shared.css',
  'styles/database-config-dialog-shared.css', 'styles/database-info-shared.css',
  'styles/detail-card-shared.css', 'styles/file-operation-dialog-shared.css',
  'styles/workbench-directory-shared.css'
]

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return entry.name === 'test-support' ? [] : sourceFiles(path)
    return /\.(?:js|ts|vue)$/.test(entry.name) && !/\.(?:test|spec)\./.test(entry.name) ? [path] : []
  })
}

const components = sourceFiles(root).map(path => {
  const source = readFileSync(path, 'utf8')
  return path.endsWith('.vue') ? { path, ...parse(source).descriptor } : { path, source }
})
const usage = components.map(file => [file.source, file.template?.content,
  file.script?.content, file.scriptSetup?.content].filter(Boolean).join('\n')).join('\n')
const componentStyles = components.flatMap(file => file.styles ?? []).map(style => style.content).join('\n')

function rules(path) {
  const filename = join(root, path)
  const result = compileStyle({ filename, id: 'shared-style-check', source: readFileSync(filename, 'utf8') })
  expect(result.errors, path).toEqual([])
  const selectors = []
  result.rawResult.root.walkRules(rule => selectors.push(rule))
  return selectors
}

describe('shared stylesheet reachability', () => {
  it.each(sharedStyles)('has no orphaned custom selector branches in %s', path => {
    const missing = []
    for (const rule of rules(path)) {
      for (const selector of rule.selectors) {
        const classes = [...selector.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(match => match[1])
        const absent = classes.filter(name => !/^(?:el-|is-|has-)/.test(name) && !usage.includes(name))
        if (absent.length) missing.push({ selector, absent })
      }
    }
    expect(missing).toEqual([])
  })

  it('preserves the live branches of partially retired selector groups', () => {
    expect(rules('assets/global.css').some(rule => rule.selector.trim() === '.module-shell .content-split > section')).toBe(true)
    const scope = rules('styles/workbench-directory-shared.css').find(rule => rule.selector.trim() === '.scope-tab span')
    expect(scope?.nodes.some(node => node.prop === 'opacity' && node.value === '0.72')).toBe(true)
  })

  it('retains responsive file-dialog layout', () => {
    const footer = rules('styles/file-operation-dialog-shared.css').find(rule =>
      rule.selector === '.file-dialog-footer' && rule.parent.type === 'atrule' && rule.parent.name === 'media')
    expect(footer?.nodes.some(node => node.prop === 'flex-direction' && node.value === 'column')).toBe(true)
  })

  it('retains toolbar classes generated from status values', () => {
    const selectors = rules('styles/workbench-toolbar-shared.css').map(rule => rule.selector).join('\n')
    for (const tone of ['info', 'success', 'primary', 'warning']) {
      expect(selectors).toContain(`.toolbar-tag-${tone}`)
      expect(selectors).toContain(`.workbench-type-tag.el-tag--${tone}`)
    }
  })

  it('retains styles for Vue-generated named transition classes', () => {
    const names = new Set()
    for (const file of components) {
      for (const match of (file.template?.content ?? '').matchAll(/<[Tt]ransition\b[^>]*\bname="([\w-]+)"/g)) {
        names.add(match[1])
        expect(componentStyles, relative(root, file.path)).toContain(`.${match[1]}-enter-active`)
      }
    }
    expect(names.size).toBeGreaterThanOrEqual(5)
  })
})
