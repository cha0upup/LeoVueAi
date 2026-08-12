<template>
  <div class="welcome">
    <section class="welcome-hero">
      <div class="welcome-context">
        <span
          class="welcome-icon-wrap"
          aria-hidden="true"
        >
          <Icon :icon="iconMap.chatAi" />
        </span>
        <div>
          <span class="welcome-kicker">当前节点 · 授权红队作业</span>
          <span
            class="context-status"
            :class="{ 'has-summary': reconSummaryExists }"
          >
            <span class="context-status__dot" />
            {{ reconSummaryExists ? '已有行动上下文' : '等待建立初始落点画像' }}
          </span>
        </div>
      </div>

      <h2 class="welcome-title">
        {{ welcomeTitle }}
      </h2>
      <p class="welcome-description">
        以当前 WebShell 为落点，在授权范围内完成主机侦察、凭据搜集、权限提升分析与内网路径发现。
        AI 会直接调用节点工具推进任务，多步骤行动实时展示计划，高影响操作执行前请求确认。
      </p>

      <div
        class="working-rules"
        aria-label="工作原则"
      >
        <span><Icon icon="lucide:badge-check" />授权范围内</span>
        <span><Icon icon="lucide:crosshair" />围绕当前落点</span>
        <span><Icon icon="lucide:notebook-pen" />关键发现持续沉淀</span>
      </div>
    </section>

    <section
      class="welcome-scenarios"
      aria-labelledby="scenario-heading"
    >
      <div class="scenario-heading-row">
        <div>
          <span class="section-kicker">红队行动</span>
          <h3 id="scenario-heading">
            选择一个目标开始
          </h3>
        </div>
        <span class="scenario-hint">点击后仍可修改</span>
      </div>

      <div class="welcome-grid">
        <button
          v-for="prompt in prompts"
          :key="prompt.title"
          type="button"
          class="prompt-card"
          :class="{ 'prompt-card--accent': prompt.accent }"
          @click="emit('pick-prompt', prompt.value)"
        >
          <span class="prompt-card__top">
            <span class="prompt-icon"><Icon :icon="prompt.icon" /></span>
            <span class="prompt-meta">{{ prompt.meta }}</span>
            <Icon
              icon="lucide:arrow-up-right"
              class="prompt-arrow"
            />
          </span>
          <strong class="prompt-title">{{ prompt.title }}</strong>
          <span class="prompt-desc">{{ prompt.desc }}</span>
        </button>
      </div>
    </section>

    <div class="quick-actions">
      <button
        type="button"
        class="report-prompt"
        @click="emit('pick-prompt', BROWSER_ARTIFACT_PROMPT)"
      >
        <Icon icon="lucide:history" />
        <span>
          <strong>分析浏览器数据</strong>
          <small>采集 Profile 制品到工作空间并生成结构化报告</small>
        </span>
        <Icon
          icon="lucide:chevron-right"
          class="report-prompt__arrow"
        />
      </button>
      <button
        type="button"
        class="report-prompt"
        @click="emit('pick-prompt', CONTAINER_PROMPT)"
      >
        <Icon icon="lucide:container" />
        <span>
          <strong>检查 Web 容器驻留面</strong>
          <small>Filter、Servlet、Valve、Listener 与控制器</small>
        </span>
        <Icon
          icon="lucide:chevron-right"
          class="report-prompt__arrow"
        />
      </button>
      <button
        type="button"
        class="report-prompt"
        @click="emit('pick-prompt', REPORT_PROMPT)"
      >
        <Icon icon="lucide:file-check-2" />
        <span>
          <strong>生成节点行动简报</strong>
          <small>汇总落点、关键发现、已执行动作与后续路径</small>
        </span>
        <Icon
          icon="lucide:chevron-right"
          class="report-prompt__arrow"
        />
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { icons } from '@/utils/icons.js'

const iconMap = icons

const props = defineProps({
  reconSummaryExists: { type: Boolean, default: false },
  basicInfo: { type: Object, default: null }
})

const emit = defineEmits(['pick-prompt'])

const BROWSER_ARTIFACT_PROMPT = '请使用 analyze-browser-artifacts skill 分析当前节点的浏览器数据：先识别当前用户可见的浏览器和 Profile，按书签、历史记录、Cookie、表单与登录条目元数据建立最小采集清单；对 SQLite 数据创建一致性快照，将选定制品采集到当前任务工作空间，使用工作空间命令和文件工具解析为 JSONL 或 CSV，并输出带来源路径、哈希、覆盖范围和盲区的结构化报告。默认掩码秘密值。'
const CONTAINER_PROMPT = '请检查当前节点的 Web 容器与应用框架驻留面：识别容器类型，枚举 Filter、Servlet、Valve、Listener、Controller、Interceptor 等已挂载组件，标记来源异常、命名可疑或行为高风险的组件，并结合 classpath 与运行时信息给出进一步验证路径。先完成只读检查，不卸载或修改组件。'
const REPORT_PROMPT = '请基于当前会话的侦察摘要和操作记录生成节点行动简报，包含：当前落点与权限、已确认资产、获取的高价值线索、已执行动作及结果、受阻点、尚未验证的攻击路径，以及按优先级排列的下一步行动建议。严格区分事实与推断。'

const welcomeTitle = computed(() => (
  props.reconSummaryExists ? '沿当前落点继续推进' : '从当前落点开始侦察'
))

const prompts = computed(() => {
  const osName = props.basicInfo?.osName ?? props.basicInfo?.os ?? ''
  const isWindows = /windows/i.test(osName)
  const isLinux = /linux/i.test(osName)

  return [
    props.reconSummaryExists
      ? {
          title: '沿高价值线索推进',
          desc: '读取已有侦察结果，识别最值得验证的攻击路径',
          value: '请读取当前侦察摘要和已有操作记录，以红队视角评估现有发现的利用价值。按优先级推进最有价值的线索，主动补齐关键证据；涉及写入、持久化或可能影响业务的动作前先向我确认，并持续更新侦察摘要。',
          icon: 'lucide:route',
          meta: '继续行动',
          accent: true
        }
      : {
          title: '开展初始落点侦察',
          desc: '确认系统、权限、容器、进程、网络和关键资产',
          value: '请围绕当前 WebShell 开展初始落点侦察：确认操作系统、主机名、当前身份与权限、Java/JVM、Web 容器、关键进程、网络接口、路由和监听端口。并行完成低影响检查，识别最有价值的后续方向，最后保存侦察摘要。',
          icon: 'lucide:radar',
          meta: '推荐起点',
          accent: true
        },
    {
      title: '搜集凭据与敏感配置',
      desc: '定位数据库口令、密钥、令牌、连接串和运维凭据',
      value: '请在授权范围内搜集当前节点的凭据与敏感配置：优先检查应用配置、classpath 资源、环境变量、启动参数、常见密钥文件、数据库与缓存连接信息，以及可用的浏览器或运行时凭据。避免无边界全盘扫描；对发现内容标注来源、有效性和可用于后续行动的场景，并写入侦察摘要。',
      icon: 'lucide:key-round',
      meta: '凭据搜集'
    },
    isWindows
      ? {
          title: '排查提权路径',
          desc: '分析令牌特权、服务、计划任务与可利用配置',
          value: '请排查当前 Windows 节点的权限提升路径：检查当前身份与用户组、令牌特权、UAC、服务权限、计划任务、可写路径和版本漏洞面。对候选路径给出利用前提、成功概率、影响和验证方案；可能改变系统状态的验证前先向我确认。',
          icon: 'lucide:shield-alert',
          meta: 'Windows'
        }
      : isLinux
        ? {
          title: '排查提权路径',
          desc: '分析 sudo、SUID、Capabilities、服务与定时任务',
          value: '请排查当前 Linux 节点的权限提升路径：检查当前身份与用户组、sudo、SUID/SGID、Capabilities、服务配置、可写路径、环境变量和定时任务。对候选路径给出利用前提、成功概率、影响和验证方案；可能改变系统状态的验证前先向我确认。',
          icon: 'lucide:shield-alert',
          meta: 'Linux'
        }
        : {
            title: '排查提权路径',
            desc: '识别系统类型、当前权限和可利用的错误配置',
            value: '请先识别当前节点的操作系统与权限上下文，再系统排查可行的权限提升路径。对候选路径给出利用前提、成功概率、影响和验证方案；可能改变系统状态的验证前先向我确认。',
            icon: 'lucide:shield-alert',
            meta: '权限提升'
          },
    {
      title: '探测内网与横向入口',
      desc: '发现可达网段、存活主机、关键服务与复用凭据场景',
      value: '请以当前节点为探测点梳理内网与横向入口：确认网络接口、路由、DNS 和代理环境，识别可达网段；先做低影响主机存活探测，再对高价值目标扫描常见端口并关联服务。结合已有凭据评估横向路径，不执行登录或利用，除非我明确确认。',
      icon: 'lucide:network',
      meta: '横向路径'
    }
  ]
})
</script>

<style scoped>
.welcome {
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 100%;
  max-width: min(860px, 100%);
  min-height: clamp(420px, 68vh, 680px);
  margin: 0 auto;
  padding: clamp(28px, 6vh, 52px) 20px 24px;
  color: var(--el-text-color-regular);
}

.welcome-hero { max-width: 680px; }

.welcome-context {
  display: flex;
  align-items: center;
  gap: 11px;
  margin-bottom: 18px;
}

.welcome-icon-wrap {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  border-radius: 12px;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 10%, var(--app-control-background));
  font-size: 20px;
}

.welcome-context > div { display: grid; gap: 4px; }
.welcome-kicker { color: var(--el-text-color-primary); font-size: 12px; font-weight: 650; }

.context-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.context-status__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--el-text-color-placeholder);
}

.context-status.has-summary .context-status__dot { background: var(--el-color-success); }

.welcome-title {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: clamp(23px, 3.5cqi, 30px);
  font-weight: 650;
  line-height: 1.2;
  letter-spacing: -.02em;
}

.welcome-description {
  max-width: 42rem;
  margin: 10px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.7;
}

.working-rules { display: flex; flex-wrap: wrap; gap: 8px 16px; margin-top: 14px; }
.working-rules span { display: inline-flex; align-items: center; gap: 5px; color: var(--el-text-color-secondary); font-size: 11px; }
.working-rules svg { color: var(--el-color-primary); font-size: 13px; }

.welcome-scenarios { margin-top: 28px; }
.scenario-heading-row { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 11px; }
.section-kicker { color: var(--el-text-color-placeholder); font-size: 10px; font-weight: 650; letter-spacing: .08em; text-transform: uppercase; }
.scenario-heading-row h3 { margin: 3px 0 0; color: var(--el-text-color-primary); font-size: 14px; font-weight: 650; }
.scenario-hint { color: var(--el-text-color-placeholder); font-size: 10px; white-space: nowrap; }

.welcome-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }

.prompt-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 13px 14px 14px;
  border: 0;
  border-radius: 12px;
  color: inherit;
  background: color-mix(in srgb, var(--el-text-color-primary) 3.5%, transparent);
  text-align: left;
  cursor: pointer;
  transition: background .16s ease, transform .16s ease;
}

.prompt-card:hover { background: color-mix(in srgb, var(--el-color-primary) 7%, transparent); transform: translateY(-1px); }
.prompt-card--accent { background: color-mix(in srgb, var(--el-color-primary) 6%, transparent); }
.prompt-card__top { display: flex; align-items: center; min-width: 0; margin-bottom: 10px; }

.prompt-icon {
  display: grid;
  place-items: center;
  width: 27px;
  height: 27px;
  flex: 0 0 auto;
  border-radius: 8px;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 9%, transparent);
  font-size: 14px;
}

.prompt-meta { margin-left: 8px; color: var(--el-text-color-placeholder); font-size: 10px; }
.prompt-arrow { margin-left: auto; color: var(--el-text-color-placeholder); font-size: 14px; }
.prompt-title { margin-bottom: 5px; color: var(--el-text-color-primary); font-size: 13px; font-weight: 650; }
.prompt-desc { color: var(--el-text-color-secondary); font-size: 11px; line-height: 1.55; }

.quick-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; margin-top: 9px; }

.report-prompt {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 13px;
  border: 0;
  border-radius: 10px;
  color: var(--el-text-color-secondary);
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background .16s ease, color .16s ease;
}

.report-prompt:hover { color: var(--el-text-color-primary); background: color-mix(in srgb, var(--el-text-color-primary) 3.5%, transparent); }
.report-prompt > svg:first-child { flex: 0 0 auto; color: var(--el-color-primary); font-size: 17px; }
.report-prompt span { display: grid; gap: 2px; }
.report-prompt strong { color: var(--el-text-color-primary); font-size: 11px; font-weight: 600; }
.report-prompt small { color: var(--el-text-color-placeholder); font-size: 10px; }
.report-prompt__arrow { margin-left: auto; flex: 0 0 auto; }

@container (max-width: 390px) {
  .welcome { min-height: auto; padding: 26px 14px 20px; }
  .welcome-context { margin-bottom: 15px; }
  .welcome-scenarios { margin-top: 22px; }
  .welcome-grid { grid-template-columns: 1fr; }
  .scenario-hint { display: none; }
  .prompt-card { padding: 12px 13px; }
  .quick-actions { grid-template-columns: 1fr; }
}

@media (prefers-reduced-motion: reduce) {
  .prompt-card { transition: none; }
  .prompt-card:hover { transform: none; }
}
</style>
