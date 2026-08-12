import { describe, expect, it, vi } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { elementPlusComponents, setupElementPlus } from './element-plus.js'

const srcRoot = fileURLToPath(new URL('../', import.meta.url))

const vueFiles = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const path = `${directory}/${entry.name}`
  if (entry.isDirectory()) return vueFiles(path)
  return entry.name.endsWith('.vue') ? [path] : []
})

const toKebab = name => name
  .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
  .toLowerCase()

describe('setupElementPlus', () => {
  it('registers every Element Plus component used by templates', () => {
    const names = new Set(elementPlusComponents.map(component => component.name))

    expect(names).toContain('ElSegmented')
    expect(names).toContain('ElLink')

    const registeredTags = new Set([...names].map(toKebab))
    const usedTags = new Set(vueFiles(srcRoot).flatMap(file =>
      [...readFileSync(file, 'utf8').matchAll(/<el-([a-z-]+)/g)].map(match => `el-${match[1]}`)
    ))
    expect([...usedTags].filter(tag => !registeredTags.has(tag))).toEqual([])
  })

  it('registers components and the loading directive on the app', () => {
    const app = { component: vi.fn(), directive: vi.fn() }

    setupElementPlus(app)

    expect(app.component).toHaveBeenCalledTimes(elementPlusComponents.length)
    expect(app.directive).toHaveBeenCalledWith('loading', expect.any(Object))
  })
})
