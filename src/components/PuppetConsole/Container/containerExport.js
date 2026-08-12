import {
  getContextDisplayName,
  getControllerClassName,
  getControllerMethodName
} from './containerManageModel.js'

const safeFileSegment = value => String(value || 'ROOT').replace(/[\\/:*?"<>|]/g, '_') || 'ROOT'
const rows = value => Array.isArray(value) ? value : []

const buildOverviewRows = (context, frameworkInfo) => [
  ['字段', '值'],
  ['Context 名称', getContextDisplayName(context)],
  ['基础路径', context?.basePath || '/'],
  ['工作目录', context?.workDir || ''],
  ['Servlet 数量', rows(context?.allServlet).length],
  ['Filter 数量', rows(context?.allFilter).length],
  ['Valve 数量', rows(context?.allValve).length],
  ['Listener 数量', rows(context?.allListener).length],
  ['Web 框架', frameworkInfo?.family || '']
]

const buildServletRows = context => [
  ['URL 模式', '包装器名称', 'Servlet 类名'],
  ...rows(context?.allServlet).map(item => [item.url || '-', item.wrapperName || '-', item.servletClass || '-'])
]

const buildFilterRows = context => [
  ['Filter 名称', 'Filter 类名', 'URL 模式', '关联 Servlet'],
  ...rows(context?.allFilter).map(item => [
    item.filterName || '-',
    item.filterClassName || '-',
    rows(item.urlPatterns).join(' | ') || '-',
    rows(item.servletNames).join(' | ') || '无'
  ])
]

const buildValveRows = context => [
  ['Valve 类名', '容器类名', 'ClassLoader', 'Valve ID'],
  ...rows(context?.allValve).map(item => [
    item.valveClassName || '-',
    item.containerClassName || '-',
    item.valveClassLoaderName || '-',
    item.valveId || '-'
  ])
]

const buildListenerRows = context => [
  ['类型', 'Listener 类名', 'ClassLoader', 'Listener ID'],
  ...rows(context?.allListener).map(item => [
    item.category || '-',
    item.className || '-',
    item.classLoader || '-',
    item.listenerId || '-'
  ])
]

const buildControllerRows = frameworkInfo => [
  ['映射名称', '路径', '映射信息', '类名', '方法名', '原始描述'],
  ...rows(frameworkInfo?.allController).map(item => [
    item.mappingName || '-',
    rows(item.directPaths).join(' | ') || '-',
    item.mappingInfo || '-',
    getControllerClassName(item.description) || '-',
    getControllerMethodName(item.description) || '-',
    item.description || '-'
  ])
]

const buildInterceptorRows = frameworkInfo => [
  ['路径', '拦截器类名'],
  ...rows(frameworkInfo?.allMappedInterceptor).map(item => [
    rows(item.pathPatterns).join(' | ') || '-',
    item.interceptorName || '-'
  ])
]

export const buildContextExportSpec = (context, frameworkInfo) => ({
  fileName: `${safeFileSegment(getContextDisplayName(context))}_container_info.xlsx`,
  sheets: [
    { name: 'Context概览', rows: buildOverviewRows(context, frameworkInfo) },
    { name: 'Servlets', rows: buildServletRows(context) },
    { name: 'Filters', rows: buildFilterRows(context) },
    { name: 'Valves', rows: buildValveRows(context) },
    { name: 'Listeners', rows: buildListenerRows(context) },
    { name: 'Controllers', rows: buildControllerRows(frameworkInfo) },
    { name: 'Interceptors', rows: buildInterceptorRows(frameworkInfo) }
  ]
})

const buildAggregateAssetRows = contexts => [
  ['Context', '资产类型', '名称 / 类名', '路径 / 映射', '附加信息'],
  ...rows(contexts).flatMap(context => {
    const contextName = getContextDisplayName(context)
    return [
      ...rows(context.allServlet).map(item => [
        contextName,
        'Servlet',
        item.servletClass || '-',
        item.url || '-',
        item.wrapperName || '-'
      ]),
      ...rows(context.allFilter).map(item => [
        contextName,
        'Filter',
        item.filterClassName || item.filterName || '-',
        rows(item.urlPatterns).join(' | ') || '-',
        rows(item.servletNames).join(' | ') || '-'
      ]),
      ...rows(context.allValve).map(item => [
        contextName,
        'Valve',
        item.valveClassName || '-',
        item.containerClassName || '-',
        item.valveClassLoaderName || '-'
      ]),
      ...rows(context.allListener).map(item => [
        contextName,
        'Listener',
        item.className || '-',
        item.category || '-',
        item.classLoader || '-'
      ])
    ]
  })
]

export const buildAllContextsExportSpec = (contexts, frameworkInfo) => {
  const contextList = rows(contexts)
  return {
    fileName: 'container_all_info.xlsx',
    sheets: [
      {
        name: 'Contexts',
        rows: [
          ['Context 名称', '基础路径', '工作目录', 'Servlet', 'Filter', 'Valve', 'Listener'],
          ...contextList.map(context => [
            getContextDisplayName(context),
            context.basePath || '/',
            context.workDir || '',
            rows(context.allServlet).length,
            rows(context.allFilter).length,
            rows(context.allValve).length,
            rows(context.allListener).length
          ])
        ]
      },
      { name: 'ContextAssets', rows: buildAggregateAssetRows(contextList) },
      { name: 'Controllers', rows: buildControllerRows(frameworkInfo) },
      { name: 'Interceptors', rows: buildInterceptorRows(frameworkInfo) }
    ]
  }
}

export const writeWorkbookSpec = async spec => {
  const XLSXModule = await import('xlsx')
  const XLSX = XLSXModule.default || XLSXModule
  const workbook = XLSX.utils.book_new()
  spec.sheets.forEach(sheet => {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name)
  })
  XLSX.writeFile(workbook, spec.fileName)
}
