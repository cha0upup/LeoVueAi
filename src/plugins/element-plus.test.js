import { describe, expect, it, vi } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { setupElementPlus } from './element-plus.js'

const srcRoot = fileURLToPath(new URL('../', import.meta.url))

const vueFiles = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const path = `${directory}/${entry.name}`
  if (entry.isDirectory()) return vueFiles(path)
  return entry.name.endsWith('.vue') ? [path] : []
})

const toKebab = name => name
  .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
  .toLowerCase()

const register = () => {
  const app = { component: vi.fn(), directive: vi.fn() }
  setupElementPlus(app)
  return app
}

const usedTags = () => new Set(vueFiles(srcRoot).flatMap(file =>
  [...readFileSync(file, 'utf8').matchAll(/<el-([a-z-]+)/g)].map(match => `el-${match[1]}`)
))

describe('setupElementPlus', () => {
  it('registers every Element Plus component used by templates', () => {
    const names = new Set(register().component.mock.calls.map(([name]) => name))
    const registeredTags = new Set([...names].map(toKebab))
    expect([...usedTags()].filter(tag => !registeredTags.has(tag))).toEqual([])
  })

  it('does not eagerly register components absent from the application templates', () => {
    const tags = register().component.mock.calls.map(([name]) => toKebab(name))
    const used = usedTags()
    expect(tags.filter(tag => !used.has(tag))).toEqual([])
    expect(new Set(tags).size).toBe(tags.length)
  })

  it('registers components and the loading directive on the app', () => {
    const app = register()
    for (const [name, component] of app.component.mock.calls) expect(component.name).toBe(name)
    expect(app.directive).toHaveBeenCalledWith('loading', expect.any(Object))
  })
})
