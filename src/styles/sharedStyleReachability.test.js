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
  'styles/workbench-directory-shared.css', 'styles/workbench-dialog.css', 'styles/workbench-toolbar-shared.css'
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
const usage = components.map(file => [file.path.endsWith('.vue') ? null : file.source, file.template?.content,
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

function orphanedSelectors(styleRules) {
  const missing = []
  for (const rule of styleRules) {
    for (const selector of rule.selectors) {
      const classes = [...selector.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(match => match[1])
      const absent = classes.filter(name => !/^(?:el-|is-|has-)/.test(name) && !usage.includes(name))
      if (absent.length) missing.push({ selector, absent })
    }
  }
  return missing
}

describe('shared stylesheet reachability', () => {
  it.each(sharedStyles)('has no orphaned custom selector branches in %s', path => {
    expect(orphanedSelectors(rules(path))).toEqual([])
  })

  it.each(['components/common/EntityCard.vue', 'components/common/EmptyState.vue', 'components/UserSpace/UserSpace.vue'])(
    'has no orphaned scoped selector branches in %s', path => {
      const file = components.find(file => file.path === join(root, path))
      const result = compileStyle({ filename: file.path, id: 'scoped-style-check', source: file.styles[0].content })
      expect(result.errors).toEqual([])
      const selectors = []
      result.rawResult.root.walkRules(rule => selectors.push(rule))
      expect(orphanedSelectors(selectors)).toEqual([])
    }
  )

  it('preserves the live branches of partially retired selector groups', () => {
    expect(rules('assets/global.css').some(rule => rule.selector.trim() === '.module-shell .content-split > section')).toBe(true)
    expect(rules('styles/workbench-directory-shared.css').some(rule => rule.selector.trim() === '.scope-tab span')).toBe(true)
  })

  it('retains responsive file-dialog layout', () => {
    const footer = rules('styles/file-operation-dialog-shared.css').find(rule =>
      rule.selector === '.file-dialog-footer' && rule.parent.type === 'atrule' && rule.parent.name === 'media')
    expect(footer?.nodes.some(node => node.prop === 'flex-direction' && node.value === 'column')).toBe(true)
  })

  it('retains type-tag variants without retired toolbar selectors', () => {
    const selectors = rules('styles/workbench-toolbar-shared.css').map(rule => rule.selector).join('\n')
    for (const tone of ['info', 'success', 'primary', 'warning']) {
      expect(selectors).toContain(`.workbench-type-tag.el-tag--${tone}`)
    }
    expect(selectors).not.toContain('.toolbar-stats')
  })

  it('keeps only referenced static design tokens', () => {
    const css = readdirSync(join(root, 'styles')).filter(name => name.endsWith('.css'))
      .map(name => readFileSync(join(root, 'styles', name), 'utf8')).join('\n')
    const implementation = [usage, componentStyles, css, readFileSync(join(root, 'assets/global.css'), 'utf8')]
      .join('\n').replace(/\/\*[\s\S]*?\*\//g, '')
    const tokens = rules('styles/design-tokens.css').find(rule => rule.selector === ':root').nodes
      .filter(node => node.type === 'decl').map(node => node.prop)
    const unused = tokens.filter(token => (implementation.match(new RegExp(`${token}(?![\\w-])`, 'g')) ?? []).length < 2)
    expect(unused).toEqual([])
  })

  it('does not repeat sidebar selectors within the same responsive context', () => {
    const file = components.find(file => file.path === join(root, 'components/Home.vue'))
    const result = compileStyle({ filename: file.path, id: 'sidebar-cleanup', source: file.styles[0].content })
    expect(result.errors).toEqual([])
    const seen = new Set()
    const duplicate = []
    result.rawResult.root.walkRules(rule => {
      const context = []
      for (let parent = rule.parent; parent; parent = parent.parent) {
        if (parent.type === 'atrule') context.push(`${parent.name} ${parent.params}`)
      }
      for (const selector of rule.selectors) {
        const key = [...context, selector].join('|')
        if (seen.has(key)) duplicate.push(key)
        seen.add(key)
      }
    })
    expect(duplicate).toEqual([])
  })

  it('retains styles for Vue-generated named transition classes', () => {
    for (const file of components) {
      for (const match of (file.template?.content ?? '').matchAll(/<[Tt]ransition\b[^>]*\bname="([\w-]+)"/g)) {
        expect(componentStyles, relative(root, file.path)).toContain(`.${match[1]}-enter-active`)
      }
    }
  })
})

describe('workbench control baseline', () => {
  const declarations = rule => Object.fromEntries(
    (rule?.nodes ?? []).filter(node => node.type === 'decl').map(node => [node.prop, node.value])
  )
  const elements = node => [
    ...(node.type === 1 ? [node] : []),
    ...(node.children ?? []).flatMap(elements)
  ]
  const component = path => components.find(file => file.path === join(root, path))

  it('keeps form-dialog scrolling in the body while the header and footer remain fixed', () => {
    const dialogRules = rules('styles/workbench-dialog.css')
    const rule = selector => declarations(dialogRules.find(item => item.selector === selector))
    expect(rule('.workbench-dialog.el-dialog')['max-width']).toBe('calc(100vw - 32px)')
    expect(rule('.workbench-dialog.el-dialog')['max-height']).toBe('calc(100dvh - 48px)')
    expect(rule('.workbench-dialog > .el-dialog__body')['overflow-y']).toBe('auto')
    expect(rule('.workbench-dialog > .el-dialog__footer')['flex-shrink']).toBe('0')
  })

  it('keeps directory filters on one line per button, with wrapping groups and visible keyboard focus', () => {
    const directoryRules = rules('styles/workbench-directory-shared.css')
    const rule = selector => declarations(directoryRules.find(item => item.selector === selector))
    expect(rule('.scope-tabs')['flex-wrap']).toBe('wrap')
    expect(rule('.scope-tab')['white-space']).toBe('nowrap')
    expect(rule('.scope-tab').height).toBe('var(--control-height-sm)')
    expect(rule('.scope-tab:focus-visible').outline).toBe('var(--focus-outline)')
    expect(rule('.toolbar-row .u-icon-btn').width).toBe('var(--control-height-sm)')
  })

  it('exposes the selected state of native directory filter buttons', () => {
    for (const path of ['components/PluginManager/PluginManager.vue', 'components/DisguiseManager/DisguiseManager.vue']) {
      const filters = elements(component(path).template.ast).filter(node => node.tag === 'button' &&
        node.props.some(prop => prop.name === 'class' && prop.value?.content === 'scope-tab'))
      expect(filters, path).toHaveLength(1)
      expect(filters[0].props.some(prop => prop.name === 'bind' && prop.arg?.content === 'aria-pressed'), path).toBe(true)
    }
  })

  it('limits stacked-cell text styles to text nodes instead of stretching tags and their inner spans', () => {
    const file = component('components/SkillManager/SkillManager.vue')
    const result = compileStyle({ filename: file.path, id: 'skill-control-check', source: file.styles[0].content })
    expect(result.errors).toEqual([])
    const selectors = []
    result.rawResult.root.walkRules(rule => selectors.push(...rule.selectors))
    expect(selectors).toContain('.stacked-cell > .cell-secondary')
    expect(selectors).not.toContain('.stacked-cell span')
    expect(selectors).not.toContain('.skill-name-cell span')
    const textNodes = elements(file.template.ast).filter(node => node.tag === 'span' &&
      node.props.some(prop => prop.name === 'class' && prop.value?.content === 'cell-secondary'))
    expect(textNodes).toHaveLength(4)
  })

  it('uses neutral cancellation controls without changing confirmation buttons', () => {
    for (const path of [
      'components/PluginManager/PluginFormDialog.vue',
      'components/AgentManager/AddChildAgent.vue',
      'components/AgentManager/ShareAgent.vue'
    ]) {
      const buttons = elements(component(path).template.ast).filter(node => node.tag === 'el-button')
      const cancel = buttons.filter(node => node.children.some(child => child.type === 2 &&
        /^(取消|关闭)$/.test(child.content.trim())))
      expect(cancel, path).toHaveLength(1)
      expect(cancel[0].props.find(prop => prop.name === 'type')?.value?.content, path).toBeUndefined()
      expect(buttons.some(node => node.props.some(prop => prop.name === 'type' && prop.value?.content === 'primary')), path)
        .toBe(true)
    }
  })
})

describe('responsive workbench baseline', () => {
  const style = path => components.find(file => file.path === join(root, path)).styles.map(item => item.content).join('\n')

  it('stacks model settings by available pane width and drops viewport-sized detail height', () => {
    const settings = style('components/Settings/AiChannelSettings.vue')
    expect(settings).toContain('container: ai-settings / inline-size')
    expect(settings).toContain('@container ai-settings (max-width: 1100px)')
    const detail = style('components/Settings/AiModelDetailPanel.vue')
    expect(detail).not.toMatch(/\n\s*height:\s*calc\(100vh/)
    expect(detail).toContain('@container ai-settings (max-width: 1100px)')
    expect(detail).toContain('max-height: none')
  })

  it('lets model rows reflow instead of forcing a wider table on small panes', () => {
    const catalog = style('components/Settings/AiProviderCatalog.vue')
    expect(catalog).toContain('container: ai-catalog / inline-size')
    expect(catalog).toContain('@container ai-catalog (max-width: 680px)')
    expect(catalog).not.toMatch(/min-width:\s*(640|720)px/)
    expect(catalog).toContain('.model-row-lite:focus-visible')
    expect(catalog).toContain('overflow-wrap: anywhere')
  })

  it('keeps navigation reachable in narrow workspaces without a tall sidebar', () => {
    for (const [path, name] of [['components/Home.vue', 'home-workspace'], ['views/AdminView.vue', 'admin-workspace']]) {
      const css = style(path)
      expect(css, path).toContain(`container: ${name} / inline-size`)
      expect(css, path).toContain(`@container ${name} (max-width: 860px)`)
      expect(css, path).toContain('overflow-x: auto')
    }
    expect(style('components/Home.vue')).not.toContain('max-height: 42vh')
    expect(style('views/AdminView.vue')).not.toMatch(/\.admin-sidebar\s*\{\s*display:\s*none/)
  })

  it('uses local pane width for directory stacking and overlays the AI dock rather than squeezing tools', () => {
    const manager = style('components/common/ManagerLayout.vue')
    expect(manager).toContain('@container manager-workspace (max-width: 760px)')
    expect(manager).toContain('overflow-y: auto')
    expect(manager).toContain('flex: 0 0 clamp(260px, 40%, 320px)')
    const consoleCss = style('components/AgentConsole/AgentConsoleView.vue')
    expect(consoleCss).toContain('container: console-workspace / inline-size')
    expect(consoleCss).not.toContain('max-width: 50%')
    const dock = style('components/Workspace/AiDock.vue')
    expect(dock).toContain('@container console-workspace (max-width: 900px)')
    expect(dock).toContain('position: absolute')
  })

  it('uses the same semantic warning colors in both AI surfaces', () => {
    for (const path of ['components/AgentConsole/Ai/NodeAiAssistant.vue', 'components/PlatformAi/PlatformAiAssistant.vue']) {
      const css = style(path)
      expect(css, path).toContain('var(--el-color-warning-light-9)')
      expect(css, path).toContain('var(--el-color-warning-dark-2)')
      expect(css, path).not.toContain('#fffbe6')
    }
  })

  it('does not wash dark controls and semantic tags with a literal white surface', () => {
    for (const rule of rules('assets/global.css')) {
      if (!rule.selector.includes('.el-button') && !rule.selector.includes('.el-tag')) continue
      const backgrounds = rule.nodes.filter(node => node.prop === 'background').map(node => node.value)
      if (rule.selector === '.el-button--primary:hover') continue
      expect(backgrounds.join('\n'), rule.selector).not.toMatch(/\bwhite\b/)
    }
  })
})
