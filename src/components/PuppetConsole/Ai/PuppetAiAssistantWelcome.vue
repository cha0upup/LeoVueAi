<template>
  <section class="welcome">
    <h2>{{ reconSummaryExists ? '继续当前节点任务' : '选择一个任务开始' }}</h2>
    <p class="welcome-description">
      选择建议填入输入框，也可以直接描述任务。
    </p>
    <div class="prompt-list">
      <button
        v-for="prompt in visiblePrompts"
        :key="prompt.title"
        type="button"
        class="prompt-item"
        @click="emit('pick-prompt', prompt.value)"
      >
        <Icon
          :icon="prompt.icon"
          class="prompt-icon"
        />
        <span class="prompt-copy">
          <strong>{{ prompt.title }}</strong>
          <span>{{ prompt.desc }}</span>
        </span>
        <Icon
          icon="lucide:arrow-up-left"
          class="prompt-arrow"
        />
      </button>
    </div>
    <button
      type="button"
      class="more-prompts"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      {{ expanded ? '收起更多操作' : '更多操作' }}
      <Icon :icon="expanded ? 'lucide:chevron-up' : 'lucide:chevron-down'" />
    </button>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  reconSummaryExists: { type: Boolean, default: false },
  basicInfo: { type: Object, default: null },
  activeModule: { type: Object, default: null }
})

const emit = defineEmits(['pick-prompt'])

const BROWSER_ARTIFACT_PROMPT = '请使用 analyze-browser-artifacts skill 分析当前节点的浏览器数据：先识别当前用户可见的浏览器和 Profile，按书签、历史记录、Cookie、表单与登录条目元数据建立最小采集清单；对 SQLite 数据创建一致性快照，将选定制品采集到当前任务工作空间，使用工作空间命令和文件工具解析为 JSONL 或 CSV，并输出带来源路径、哈希、覆盖范围和盲区的结构化报告。默认掩码秘密值。'
const CONTAINER_PROMPT = '请检查当前节点的 Java Web Runtime 与应用框架驻留面：识别 Runtime 类型，枚举 Filter、Servlet、Valve、Listener、Controller、Interceptor 等已挂载组件，标记来源异常、命名可疑或行为高风险的组件，并结合 classpath 与运行时信息给出进一步验证路径。先完成只读检查，不卸载或修改组件。'
const REPORT_PROMPT = '请基于当前会话的侦察摘要和操作记录生成节点行动简报，包含：当前落点与权限、已确认资产、获取的高价值线索、已执行动作及结果、受阻点、尚未验证的攻击路径，以及按优先级排列的下一步行动建议。严格区分事实与推断。'

const containerPrompt = { title: '检查 Web 运行时', desc: '查看已挂载组件及异常线索', value: CONTAINER_PROMPT, icon: 'lucide:container' }
const reportPrompt = { title: '生成节点简报', desc: '汇总已有发现与操作结果', value: REPORT_PROMPT, icon: 'lucide:file-check-2' }

const generalPrompts = computed(() => {
  const osName = props.basicInfo?.OSInfo?.OSName ?? props.basicInfo?.osName ?? props.basicInfo?.os ?? ''
  const isWindows = /windows/i.test(osName)
  const isLinux = /linux/i.test(osName)

  return [
    props.reconSummaryExists
      ? {
          title: '沿高价值线索推进',
          desc: '读取已有侦察结果，识别最值得验证的攻击路径',
          value: '请读取当前侦察摘要和已有操作记录，以红队视角评估现有发现的利用价值。按优先级推进最有价值的线索，主动补齐关键证据；涉及写入、持久化或可能影响业务的动作前先向我确认，并持续更新侦察摘要。',
          icon: 'lucide:route'
        }
      : {
          title: '开展初始落点侦察',
          desc: '确认系统、权限、运行时、进程、网络和关键资产',
          value: '请围绕当前 WebShell 开展初始落点侦察：确认操作系统、主机名、当前身份与权限、Java/JVM、Java Web Runtime、关键进程、网络接口、路由和监听端口。并行完成低影响检查，识别最有价值的后续方向，最后保存侦察摘要。',
          icon: 'lucide:radar'
        },
    {
      title: '搜集凭据与敏感配置',
      desc: '定位数据库口令、密钥、令牌、连接串和运维凭据',
      value: '请在授权范围内搜集当前节点的凭据与敏感配置：优先检查应用配置、classpath 资源、环境变量、启动参数、常见密钥文件、数据库与缓存连接信息，以及可用的浏览器或运行时凭据。避免无边界全盘扫描；对发现内容标注来源、有效性和可用于后续行动的场景，并写入侦察摘要。',
      icon: 'lucide:key-round'
    },
    isWindows
      ? {
          title: '排查提权路径',
          desc: '分析令牌特权、服务、计划任务与可利用配置',
          value: '请排查当前 Windows 节点的权限提升路径：检查当前身份与用户组、令牌特权、UAC、服务权限、计划任务、可写路径和版本漏洞面。对候选路径给出利用前提、成功概率、影响和验证方案；可能改变系统状态的验证前先向我确认。',
          icon: 'lucide:shield-alert'
        }
      : isLinux
        ? {
          title: '排查提权路径',
          desc: '分析 sudo、SUID、Capabilities、服务与定时任务',
          value: '请排查当前 Linux 节点的权限提升路径：检查当前身份与用户组、sudo、SUID/SGID、Capabilities、服务配置、可写路径、环境变量和定时任务。对候选路径给出利用前提、成功概率、影响和验证方案；可能改变系统状态的验证前先向我确认。',
          icon: 'lucide:shield-alert'
        }
        : {
            title: '排查提权路径',
            desc: '识别系统类型、当前权限和可利用的错误配置',
            value: '请先识别当前节点的操作系统与权限上下文，再系统排查可行的权限提升路径。对候选路径给出利用前提、成功概率、影响和验证方案；可能改变系统状态的验证前先向我确认。',
            icon: 'lucide:shield-alert'
          },
    {
      title: '探测内网与横向入口',
      desc: '发现可达网段、存活主机、关键服务与复用凭据场景',
      value: '请以当前节点为探测点梳理内网与横向入口：确认网络接口、路由、DNS 和代理环境，识别可达网段；先做低影响主机存活探测，再对高价值目标扫描常见端口并关联服务。结合已有凭据评估横向路径，不执行登录或利用，除非我明确确认。',
      icon: 'lucide:network'
    },
    { title: '分析浏览器数据', desc: '整理浏览器制品与已有记录', value: BROWSER_ARTIFACT_PROMPT, icon: 'lucide:history' },
    containerPrompt,
    reportPrompt
  ]
})

const modulePrompts = {
  database: [
    { title: '检查数据库连接条件', desc: '确认地址、驱动和节点访问条件', icon: 'lucide:database', value: '请帮我梳理当前节点连接数据库所需的地址、端口、驱动与权限条件，说明常见配置错误。缺少目标信息时先列出需要补充的内容。' },
    { title: '分析数据库连接错误', desc: '根据错误定位配置或网络问题', icon: 'lucide:search', value: '请帮我分析数据库连接失败的原因。我会补充错误信息，请区分地址、网络、驱动和认证问题，并给出排查顺序。' }
  ],
  file: [
    { title: '排查文件访问问题', desc: '检查路径、权限和文件操作错误', icon: 'lucide:folder-search', value: '请帮我排查当前节点的文件访问问题，结合我提供的路径和错误信息，分析路径、权限及文件占用原因。' },
    { title: '梳理目录结构', desc: '明确目录用途和后续查看范围', icon: 'lucide:folder-tree', value: '请帮我梳理当前节点指定目录的结构与用途。我会补充目录路径，请先明确查看范围，再给出整理建议。' }
  ],
  info: [
    { title: '分析主机资源', desc: '解读内存、磁盘和网络指标', icon: 'lucide:activity', value: '请读取当前节点基础信息，分析内存、磁盘、进程与网络接口状态，解释异常指标，并区分已确认的问题和仍需验证的判断。' },
    { title: '检查运行环境', desc: '确认系统、运行时与进程信息', icon: 'lucide:cpu', value: '请汇总当前节点的操作系统、运行时版本、当前进程和用户环境，说明需要关注的兼容性或配置问题。' }
  ],
  terminal: [
    { title: '解释命令与输出', desc: '理解命令作用和报错原因', icon: 'lucide:terminal', value: '请解释我接下来提供的命令及输出，说明执行环境、命令作用和报错原因。' },
    { title: '整理排查步骤', desc: '根据问题生成清晰的命令清单', icon: 'lucide:list-checks', value: '请根据我接下来描述的问题整理终端排查步骤，说明每条命令的用途和预期输出，先给出清单。' }
  ],
  scan: [
    { title: '检查扫描配置', desc: '核对目标、阶段和端口策略', icon: 'lucide:settings-2', value: '请帮我检查网络资产发现的目标格式、扫描阶段与端口策略。先根据我提供的配置指出问题和调整建议。' },
    { title: '解读扫描结果', desc: '分析主机、端口和服务识别结果', icon: 'lucide:search', value: '请解读我提供的网络资产发现结果，区分主机探活、端口开放和服务识别的含义，并说明结果的不确定性。' }
  ],
  container: [
    containerPrompt,
    { title: '解释运行时组件', desc: '理清 Context 与组件之间的关系', icon: 'lucide:workflow', value: '请说明当前节点 Java Web Runtime 中 Context、Servlet、Filter、Listener 和框架组件之间的关系，并解释采集信息中的未知项。' }
  ],
  'system-manage-hub': [
    { title: '梳理系统运行状态', desc: '分析进程、服务及任务状态', icon: 'lucide:monitor', value: '请梳理当前节点的系统运行状态，汇总关键进程、服务和计划任务，指出需要进一步检查的异常。' },
    { title: '分析系统错误', desc: '结合日志和现象定位问题', icon: 'lucide:search', value: '请根据我提供的系统日志和问题现象，分析可能原因并给出按优先级排列的排查步骤。' }
  ],
  'task-manager': [
    { title: '分析任务失败', desc: '根据任务状态和日志定位原因', icon: 'lucide:list-checks', value: '请帮我分析任务失败的原因。我会提供任务状态和错误日志，请解释失败阶段并给出恢复建议。' },
    { title: '汇总任务进度', desc: '整理已完成事项与待处理问题', icon: 'lucide:clipboard-list', value: '请根据当前节点已有任务记录汇总执行进度、已完成事项、失败原因和待处理问题。' }
  ]
}
const expanded = ref(false)
watch(() => props.activeModule?.key, () => { expanded.value = false })
const primaryPrompts = computed(() => [
  ...(modulePrompts[props.activeModule?.key] || [generalPrompts.value[0], containerPrompt]),
  reportPrompt
])
const extraPrompts = computed(() => generalPrompts.value.filter(prompt =>
  !primaryPrompts.value.some(primary => primary.title === prompt.title)
))
const visiblePrompts = computed(() => expanded.value
  ? [...primaryPrompts.value, ...extraPrompts.value]
  : primaryPrompts.value)
</script>

<style scoped src="@/styles/ai-welcome-shared.css" />
