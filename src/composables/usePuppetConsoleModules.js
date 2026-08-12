import { defineAsyncComponent } from 'vue'

// ATT&CK-aligned phase definitions for CommandPalette grouping
export const ATTACK_PHASES = [
  { key: 'recon',       label: '侦察',     icon: 'mdi:radar' },
  { key: 'operation',   label: '操作',     icon: 'mdi:console-line' },
  { key: 'lateral',     label: '横向移动', icon: 'mdi:transit-connection-variant' },
  { key: 'persistence', label: '持久化',   icon: 'mdi:shield-lock-outline' },
  { key: 'credentials', label: '凭据与资产', icon: 'mdi:key-outline' }
]

export function supportsCapabilityRequirements(definition, capabilities) {
  const list = Array.isArray(capabilities) ? capabilities : []
  if (!list.length) return true

  const supported = new Set(list)
  const requiredAll = Array.isArray(definition?.requiredCapabilities)
    ? definition.requiredCapabilities
    : []
  const requiredAny = Array.isArray(definition?.requiredAnyCapabilities)
    ? definition.requiredAnyCapabilities
    : []

  if (requiredAll.some((name) => !supported.has(name))) return false
  if (requiredAny.length && !requiredAny.some((name) => supported.has(name))) return false
  return true
}

export function usePuppetConsoleModules(iconMap) {
  const moduleDefinitions = [
    {
      key: 'ai',
      title: 'AI 助理',
      description: '基于当前会话与模型对话，可查询主机基础信息',
      icon: iconMap.chatAi,
      iconClass: 'ai-icon',
      phase: null,
      component: defineAsyncComponent(
        () => import('@/components/PuppetConsole/Ai/PuppetAiAssistant.vue')
      )
    },
    {
      key: 'info',
      title: '基础信息',
      description: '查看主机基本信息和连接状态',
      icon: iconMap.info,
      iconClass: 'info-icon',
      phase: 'recon',
      requiredCapabilities: ['basicInfo'],
      component: defineAsyncComponent(() => import('@/components/PuppetConsole/PuppetInfo.vue'))
    },
    {
      key: 'recon-summary',
      title: '侦察摘要',
      description: '记录并管理目标节点关键情报，AI 对话时自动注入上下文',
      icon: iconMap.document,
      iconClass: 'info-icon',
      phase: 'recon',
      component: defineAsyncComponent(
        () => import('@/components/PuppetConsole/ReconSummary/ReconSummary.vue')
      )
    },
    {
      key: 'scan',
      title: '扫描探测',
      description: '端口扫描和主机探活',
      icon: iconMap.scan,
      iconClass: 'scan-icon',
      phase: 'recon',
      requiredCapabilities: ['scan'],
      component: defineAsyncComponent(() => import('@/components/PuppetConsole/Scan/PortScan.vue'))
    },
    {
      key: 'network-connection',
      title: '网络连接',
      description: '采集实时 TCP/UDP 连接，关联进程名，按状态/IP/进程聚合统计',
      icon: iconMap.networkConnection,
      iconClass: 'netconn-icon',
      phase: 'recon',
      requiredCapabilities: ['networkConnection'],
      component: defineAsyncComponent(
        () => import('@/components/PuppetConsole/NetworkConnection/NetworkConnectionManager.vue')
      )
    },
    {
      key: 'file',
      title: '文件管理',
      description: '管理远程主机文件系统',
      icon: iconMap.folder,
      iconClass: 'file-icon',
      phase: 'operation',
      requiredCapabilities: ['file'],
      component: defineAsyncComponent(
        () => import('@/components/PuppetConsole/File/FileManager.vue')
      )
    },
    {
      key: 'terminal',
      title: '虚拟终端',
      description: '远程命令行终端操作',
      icon: iconMap.terminal,
      iconClass: 'terminal-icon',
      phase: 'operation',
      requiredCapabilities: ['terminal'],
      component: defineAsyncComponent(
        () => import('@/components/PuppetConsole/terminal/TerminalConsole.vue')
      )
    },
    {
      key: 'database',
      title: '数据库管理',
      description: '管理远程数据库连接和操作',
      icon: iconMap.database,
      iconClass: 'database-icon',
      phase: 'operation',
      requiredCapabilities: ['sql'],
      component: defineAsyncComponent(
        () => import('@/components/PuppetConsole/Database/Database.vue')
      )
    },
    {
      key: 'http-sender',
      title: 'HTTP 发包',
      description: 'Repeater 单包调试 + Fuzzer 批量变量发包',
      icon: iconMap.connection,
      iconClass: 'http-sender-icon',
      phase: 'operation',
      requiredCapabilities: ['httpSender'],
      component: defineAsyncComponent(
        () => import('@/components/PuppetConsole/HttpPacketSender/HttpPacketSender.vue')
      )
    },
    {
      key: 'proxy',
      title: '网络代理',
      description: '配置和管理网络代理设置',
      icon: iconMap.proxy,
      iconClass: 'proxy-icon',
      phase: 'lateral',
      requiredAnyCapabilities: ['socks5Proxy', 'httpProxy', 'localForward', 'reverseTunnel'],
      component: defineAsyncComponent(() => import('@/components/PuppetConsole/Proxy/Proxy.vue'))
    },
    {
      key: 'system-manage-hub',
      title: '系统管理',
      description: '进程管理、事件日志、服务管理、计划任务、注册表、持久化枚举',
      icon: iconMap.grid,
      iconClass: 'service-icon',
      phase: 'persistence',
      requiredAnyCapabilities: ['process', 'eventLog', 'service', 'scheduledTask', 'registry', 'persistence'],
      component: defineAsyncComponent(
        () => import('@/components/PuppetConsole/Hub/SystemManageHub.vue')
      )
    },
    {
      key: 'security-asset-hub',
      title: '安全与资产',
      description: '用户与组、防火墙、网络共享、SUID/Caps、已装软件、Docker、屏幕截图',
      icon: iconMap.userAccount,
      iconClass: 'useraccount-icon',
      phase: 'credentials',
      requiredAnyCapabilities: [
        'userAccount',
        'firewall',
        'networkShare',
        'suidCapability',
        'installedSoftware',
        'docker',
        'componentInvoke'
      ],
      component: defineAsyncComponent(
        () => import('@/components/PuppetConsole/Hub/SecurityAssetHub.vue')
      )
    },
    {
      key: 'task-manager',
      title: '任务管理',
      description: '后台 Shell 任务与异步任务管理',
      icon: iconMap.task,
      iconClass: 'task-icon',
      phase: 'operation',
      component: defineAsyncComponent(
        () => import('@/components/PuppetConsole/TaskManager/TaskManager.vue')
      )
    },
    {
      key: 'plugin',
      title: '脚本与插件',
      description: '临时执行 JS/Groovy/Python 脚本与 Java 字节码，浏览/调用已保存插件',
      icon: iconMap.plugin,
      iconClass: 'plugin-icon',
      phase: 'operation',
      requiredAnyCapabilities: ['script', 'componentInvoke', 'javaPlugin'],
      component: defineAsyncComponent(
        () => import('@/components/PuppetConsole/Plugin/Plugin.vue')
      )
    },
    {
      key: 'container',
      title: '容器管理',
      description: '按版本画像查看并管理 Java Web Runtime、Context 与框架组件',
      icon: iconMap.server,
      iconClass: 'server-icon',
      phase: 'persistence',
      requiredCapabilities: ['webRuntimeManage'],
      component: defineAsyncComponent(
        () => import('@/components/PuppetConsole/Container/ContainerManage.vue')
      )
    },
    {
      key: 'resource',
      title: '类与资源',
      description: '按类名或路径读取 puppet 进程的 classpath 资源（jar 内 .class、application.yml 等），自动反编译',
      icon: iconMap.codeFile,
      iconClass: 'resource-icon',
      phase: 'operation',
      requiredCapabilities: ['resource'],
      component: defineAsyncComponent(
        () => import('@/components/PuppetConsole/Resource/ResourceBrowser.vue')
      )
    },
    {
      key: 'settings',
      title: '主机设置',
      description: '调整控制台通用参数与组件管理能力',
      icon: iconMap.setting,
      iconClass: 'info-icon',
      phase: null,
      component: defineAsyncComponent(() => import('@/components/PuppetConsole/HostSettings.vue'))
    }
  ]

  const moduleMap = Object.fromEntries(moduleDefinitions.map((module) => [module.key, module]))

  return {
    moduleDefinitions,
    moduleMap
  }
}
