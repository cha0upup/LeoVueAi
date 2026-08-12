import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC_ROOT = join(process.cwd(), 'src')
const ICON_ONLY_BUTTON =
  /<(el-button|button)\b([^>]*)>\s*<el-icon\b[^>]*>\s*<Icon\b[^>]*\/?>(?:\s*<\/Icon>)?\s*<\/el-icon>\s*<\/\1>/gs

function vueFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return vueFiles(path)
    return entry.name.endsWith('.vue') ? [path] : []
  })
}

describe('icon-only button accessibility', () => {
  it('gives every directly icon-only button an accessible name', () => {
    const violations = []
    for (const file of vueFiles(SRC_ROOT)) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(ICON_ONLY_BUTTON)) {
        const attributes = match[2]
        if (!/\b(?:aria-label|title)\s*=/.test(attributes)) {
          const line = source.slice(0, match.index).split('\n').length
          violations.push(`${relative(process.cwd(), file)}:${line}`)
        }
      }
    }
    expect(violations).toEqual([])
  })
})
