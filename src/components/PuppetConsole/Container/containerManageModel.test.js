import { describe, expect, it } from 'vitest'
import { createApp, effectScope, nextTick, ref } from 'vue'
import { useContainerAssetList } from './useContainerAssetList.js'
import { buildAllContextsExportSpec, buildContextExportSpec } from './containerExport.js'
import {
  filterRuntimeContexts,
  getContextAssetScore,
  getContextKey,
  normalizeRuntimeOperation,
  normalizeWebRuntimePayload,
  sortRuntimeContexts
} from './containerManageModel.js'

const snapshot = {
  schemaVersion: 2,
  scanId: 'scan-1',
  runtimes: [{
    runtimeId: 'runtime-1',
    family: 'TOMCAT',
    productVersion: 'Apache Tomcat/9.0.89',
    profileId: 'tomcat-9',
    namespace: 'JAVAX',
    capabilities: {
      servlet: { inspect: true, remove: true },
      filter: { inspect: true, remove: true },
      listener: { inspect: true, remove: true },
      valve: { inspect: true, remove: true }
    },
    contexts: [{
      contextId: 'root', name: 'ROOT', path: '/', components: {}
    }, {
      contextId: 'app',
      name: 'app',
      path: '/app',
      workDir: '/tmp/app',
      components: {
        servlet: [{ url: '/x', servletClass: 'DemoServlet' }],
        filter: [{ filterName: 'auth', urlPatterns: ['/api/*'] }],
        valve: [{ valveClassName: 'DemoValve' }],
        listener: [{ className: 'DemoListener' }]
      }
    }]
  }]
}

describe('containerManageModel', () => {
  it('pages reactive list settings and clamps the page after filtering or removal', async () => {
    const pageSize = ref(2)
    const items = ref([{ name: 'a' }, { name: 'b' }, { name: 'c' }])
    const scope = effectScope()
    const app = createApp({}).provide('puppetListPageSize', pageSize)
    try {
      const list = app.runWithContext(() => scope.run(() =>
        useContainerAssetList(() => items.value, item => [item.name])))
      expect(list.pagedItems.value.map(item => item.name)).toEqual(['a', 'b'])
      list.currentPage.value = 2
      expect(list.pagedItems.value.map(item => item.name)).toEqual(['c'])
      items.value.pop()
      await nextTick()
      expect(list.currentPage.value).toBe(1)
      pageSize.value = 1
      await nextTick()
      expect(list.pagedItems.value).toHaveLength(1)
      list.searchKeyword.value = 'B'
      await nextTick()
      expect(list.pagedItems.value.map(item => item.name)).toEqual(['b'])
    } finally {
      scope.stop()
    }
  })

  it('normalizes V2 runtimes into context-local assets and capabilities', () => {
    const normalized = normalizeWebRuntimePayload(snapshot)
    const app = normalized.contexts.find(context => context.contextId === 'app')
    expect(normalized).toMatchObject({ ok: true, scanId: 'scan-1' })
    expect(sortRuntimeContexts(normalized.contexts).map(item => item.name)).toEqual(['ROOT', 'app'])
    expect(filterRuntimeContexts(normalized.contexts, 'TMP/APP')).toEqual([app])
    expect(getContextAssetScore(app)).toBe(4)
    expect(getContextKey(app)).toBe('app')
  })

  it('rejects invalid payloads and only accepts verified changes', () => {
    expect(normalizeWebRuntimePayload(null)).toMatchObject({ ok: false, contexts: [] })
    expect(normalizeWebRuntimePayload({ runtimes: [] }))
      .toMatchObject({ ok: false, error: 'Web Runtime 数据协议版本不匹配' })
    expect(normalizeRuntimeOperation({ status: 'CHANGED', verified: true })).toMatchObject({ ok: true })
    expect(normalizeRuntimeOperation({ status: 'NOT_FOUND', verified: true })).toMatchObject({ ok: false })
  })

  it('builds complete single and aggregate export specifications', () => {
    const app = normalizeWebRuntimePayload(snapshot).contexts.find(context => context.contextId === 'app')
    const framework = {
      allController: [{ description: 'com.demo.Controller.run()' }],
      allMappedInterceptor: [{ interceptorName: 'AuthInterceptor', pathPatterns: ['/api'] }]
    }
    const single = buildContextExportSpec({ ...app, frameworkInfo: framework })
    expect(single.sheets.map(sheet => sheet.name)).toEqual([
      'Context概览', 'Servlets', 'Filters', 'Valves', 'Listeners', 'Controllers', 'Interceptors', 'FrameworkRuntime'
    ])
    expect(single.sheets.find(sheet => sheet.name === 'Controllers').rows[1]).toContain('com.demo.Controller')

    const aggregate = buildAllContextsExportSpec([app, { ...app, contextId: 'app-2' }], [
      { ...framework, contextId: 'app', family: 'Spring MVC' },
      { family: 'JAX-RS', runtimeComponents: [{ role: 'runtime', className: 'example.Application' }] }
    ])
    expect(aggregate.sheets.find(sheet => sheet.name === 'Controllers').rows[1].slice(0, 2))
      .toEqual(['Spring MVC', 'app'])
    expect(aggregate.sheets.find(sheet => sheet.name === 'FrameworkRuntime').rows[1])
      .toEqual(['JAX-RS', '归属未确定', 'runtime', 'example.Application'])
    expect(buildContextExportSpec(app).sheets.find(sheet => sheet.name === 'Controllers').rows).toHaveLength(1)
    expect(new Set(aggregate.sheets.map(sheet => sheet.name)).size).toBe(aggregate.sheets.length)
    expect(aggregate.sheets[0].rows[0]).toContain('Valve')
    expect(aggregate.sheets.find(sheet => sheet.name === 'ContextAssets').rows.map(row => row[1]))
      .toEqual(expect.arrayContaining(['Servlet', 'Filter', 'Valve', 'Listener']))
  })
})
