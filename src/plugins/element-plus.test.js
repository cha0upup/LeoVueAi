import { expect, it, vi } from 'vitest'
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

it('registers the Element Plus components and loading directive used by the app', () => {
  const app = { component: vi.fn(), directive: vi.fn() }
  setupElementPlus(app)
  const registeredTags = new Set(app.component.mock.calls.map(([name]) => toKebab(name)))
  const usedTags = new Set(vueFiles(srcRoot).flatMap(file =>
    [...readFileSync(file, 'utf8').matchAll(/<el-([a-z-]+)/g)].map(match => `el-${match[1]}`)
  ))
  expect([...usedTags].filter(tag => !registeredTags.has(tag))).toEqual([])
  expect(app.directive).toHaveBeenCalledWith('loading', expect.any(Object))
})
