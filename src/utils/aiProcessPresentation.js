const TOOL_LABELS = Object.freeze({
  exec: '执行命令',
  querytask: '查询命令输出',
  stoptask: '停止命令',
  execsql: '执行 SQL',
  querysql: '查询数据库',
  listdatabaseconnections: '查看数据库配置',
  createdatabaseconnection: '新增数据库配置',
  updatedatabaseconnection: '编辑数据库配置',
  deletedatabaseconnection: '删除数据库配置',
  startscanport: '启动端口扫描',
  queryscanportresult: '查询扫描进度',
  pausescanport: '暂停端口扫描',
  resumescanport: '恢复端口扫描',
  stopscanport: '停止端口扫描',
  scanreachablehost: '探测存活主机',
  getbasicinfo: '获取节点信息',
  readtextfile: '读取文件',
  searchfilecontent: '搜索文件内容',
  startuploadtask: '上传文件',
  startdownloadtask: '下载文件',
  stageremotefiletoworkspace: '采集文件到任务工作空间',
  queryremotefilestage: '查询文件采集任务',
  workspaceexec: '执行工作空间命令',
  workspaceexecstatus: '查询工作空间命令',
  workspaceexeccancel: '停止工作空间命令',
  harvestall: '采集运行时凭据',
  managereconsummary: '更新侦察摘要',
  manage_recon_summary: '更新侦察摘要',
  inspectwebruntime: '检查 Web Runtime',
  removewebruntimecomponent: '移除 Web Runtime 组件',
  getresource: '读取 Classpath 资源',
  readspringbootconfigresources: '读取 Spring Boot 配置',
  getclassbytecode: '反编译已加载类',
  httprequest: '发送 HTTP 请求',
  sendrawrequest: '发送原始 HTTP 请求',
  execscript: '执行脚本',
  invokejavaplugin: '调用 Java 插件',
  startreversetunnel: '启动反向隧道',
  listreversetunnels: '查看反向隧道',
  activate_skill: '启用作业技能',
  createplan: '创建执行计划',
  updateplanstep: '更新计划步骤',
  completeplan: '完成执行计划'
})

export function getToolDisplayName(name) {
  const raw = String(name ?? '').trim()
  if (!raw) return '工具调用'
  return TOOL_LABELS[raw.toLowerCase()] ?? raw
}

export function summarizeToolNode(node) {
  if (!node) return ''
  if (node.status === 'running') return '正在执行'
  if (node.status === 'failed' || node.success === false) {
    return compactText(node.error || '调用失败', 56)
  }
  if (node.status !== 'done') return '等待执行'

  const toolName = String(node.name ?? '').toLowerCase()
  if (/harvest|credential|browser|crypto/.test(toolName)) {
    return '已返回敏感信息结果'
  }

  const value = parseResult(node.result)
  if (value == null || value === '') return '调用完成'
  if (Array.isArray(value)) return `${value.length} 项结果`
  if (typeof value !== 'object') return normalizedStatus(value)

  const directText = value.summary ?? value.message ?? value.resultText ?? value.description
  if (directText != null && typeof directText !== 'object') return compactText(directText, 56)

  const openPorts = value.openPorts ?? value.ports
  if (Array.isArray(openPorts)) return `发现 ${openPorts.length} 个端口结果`
  const rows = value.rowCount ?? value.rowsCount
  if (Number.isFinite(Number(rows))) return `返回 ${Number(rows)} 行数据`
  const count = value.count ?? value.total
  if (Number.isFinite(Number(count))) return `返回 ${Number(count)} 项结果`
  if (Array.isArray(value.data)) return `返回 ${value.data.length} 项结果`
  if (value.success === true) return '调用完成'
  return '已返回结果'
}

function normalizedStatus(value) {
  const text = String(value ?? '').trim().toLowerCase()
  if (['ok', 'success', 'done', 'completed', 'true'].includes(text)) return '调用完成'
  return '已返回结果'
}

export function groupConsecutiveToolNodes(nodes) {
  const source = Array.isArray(nodes) ? nodes : []
  const grouped = []

  for (let index = 0; index < source.length;) {
    const current = source[index]
    if (!isGroupableTool(current)) {
      grouped.push(current)
      index += 1
      continue
    }

    const children = [current]
    let cursor = index + 1
    while (
      cursor < source.length &&
      isGroupableTool(source[cursor]) &&
      source[cursor].name === current.name
    ) {
      children.push(source[cursor])
      cursor += 1
    }

    if (children.length === 1) {
      grouped.push(current)
    } else {
      grouped.push({
        kind: 'tool-group',
        id: `tool-group:${children.map(child => child.id).join(':')}`,
        name: current.name,
        status: 'done',
        success: true,
        children,
        seq: current.seq
      })
    }
    index = cursor
  }

  return grouped
}

function isGroupableTool(node) {
  return node?.kind === 'tool' && node.status === 'done' && node.success !== false && node.name
}

function parseResult(result) {
  if (typeof result !== 'string') return result
  const trimmed = result.trim()
  if (!trimmed) return ''
  try {
    return JSON.parse(trimmed)
  } catch {
    return trimmed.split(/\r?\n/).find(Boolean) ?? trimmed
  }
}

function compactText(value, maxLength) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text
}
