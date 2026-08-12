<template>
  <section class="content-grid">
    <article class="content-card">
      <div class="card-header">
        <div>
          <div class="section-eyebrow">
            进程
          </div>
          <h3>当前接管进程</h3>
        </div>
      </div>
      <div class="kv-grid">
        <div
          v-for="item in processFacts"
          :key="item.label"
          class="kv-item"
        >
          <span class="kv-label">{{ item.label }}</span>
          <span
            class="kv-value"
            :class="{ mono: item.mono }"
          >{{ item.value }}</span>
        </div>
      </div>
    </article>

    <article
      v-if="hasMiddlewareInfo"
      class="content-card"
    >
      <div class="card-header">
        <div>
          <div class="section-eyebrow">
            中间件
          </div>
          <h3>容器与部署目录</h3>
        </div>
      </div>
      <div class="kv-grid">
        <div
          v-for="item in middlewareFacts"
          :key="item.label"
          class="kv-item"
        >
          <span class="kv-label">{{ item.label }}</span>
          <span
            class="kv-value"
            :class="{ mono: item.mono }"
          >{{ item.value }}</span>
        </div>
      </div>
    </article>

    <article
      v-if="hasJavaInfo"
      class="content-card content-card-wide"
    >
      <div class="card-header">
        <div>
          <div class="section-eyebrow">
            Java 运行时
          </div>
          <h3>JVM 资源与版本信息</h3>
        </div>
      </div>
      <div class="usage-dual-grid">
        <div class="usage-panel">
          <div class="usage-title">
            堆内存使用
          </div>
          <el-progress
            :percentage="javaHeapUsagePercentage"
            :color="javaMemoryColor"
            :stroke-width="10"
          />
          <div class="usage-meta">
            <span>已用 {{ formatMBValue(basicInfo.JavaRuntimeInfo?.HeapUsedMB) }}</span>
            <span>最大 {{ formatMBValue(basicInfo.JavaRuntimeInfo?.HeapMaxMB) }}</span>
          </div>
        </div>
        <div class="usage-panel">
          <div class="usage-title">
            总内存使用
          </div>
          <el-progress
            :percentage="javaMemoryUsagePercentage"
            :color="javaMemoryColor"
            :stroke-width="10"
          />
          <div class="usage-meta">
            <span>已用 {{ formatMBValue(basicInfo.JavaRuntimeInfo?.UsedMemoryMB) }}</span>
            <span>最大 {{ formatMBValue(basicInfo.JavaRuntimeInfo?.MaxMemoryMB) }}</span>
          </div>
        </div>
      </div>
      <div class="kv-grid">
        <div
          v-for="item in javaFacts"
          :key="item.label"
          class="kv-item"
        >
          <span class="kv-label">{{ item.label }}</span>
          <span
            class="kv-value"
            :class="{ mono: item.mono }"
          >{{ item.value }}</span>
        </div>
      </div>
      <div
        v-if="jvmArgs.length"
        class="table-shell compact-table"
      >
        <div class="table-title">
          JVM 参数
        </div>
        <el-table
          :data="jvmArgs"
          stripe
          max-height="220"
        >
          <el-table-column
            prop="value"
            label="参数"
            min-width="260"
          >
            <template #default="{ row }">
              <el-tooltip
                :content="row.value"
                placement="top"
              >
                <span class="mono-text truncate-text">{{ row.value }}</span>
              </el-tooltip>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </article>

    <article
      v-if="hasPhpInfo"
      class="content-card content-card-wide"
    >
      <div class="card-header">
        <div>
          <div class="section-eyebrow">
            PHP 运行时
          </div>
          <h3>PHP 版本与执行环境</h3>
        </div>
      </div>
      <div class="kv-grid">
        <div
          v-for="item in phpFacts"
          :key="item.label"
          class="kv-item"
        >
          <span class="kv-label">{{ item.label }}</span>
          <span
            class="kv-value"
            :class="{ mono: item.mono }"
          >{{ item.value }}</span>
        </div>
      </div>
      <div
        v-if="phpExtensions.length"
        class="table-shell compact-table"
      >
        <div class="table-title">
          已加载扩展（{{ phpExtensions.length }}）
        </div>
        <div class="extension-list">
          <el-tag
            v-for="extension in phpExtensions"
            :key="extension"
            size="small"
            effect="plain"
          >
            {{ extension }}
          </el-tag>
        </div>
      </div>
    </article>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { formatDate as formatDateTime } from '@/utils/format.js'

const props = defineProps({
  basicInfo: {
    type: Object,
    required: true
  }
})

const formatMemory = (bytes) => {
  if (!bytes || bytes === 0) return '0 MB'
  const mb = bytes / 1024 / 1024
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)} GB`
  }
  return `${Math.round(mb)} MB`
}

const formatMBValue = (value) => formatMemory((value || 0) * 1024 * 1024)


const getUsageColor = (usage) => {
  if (usage > 90) return '#cf4e57'
  if (usage > 75) return '#c27a1f'
  return '#3f9a57'
}

const javaMemoryUsagePercentage = computed(() => {
  const total = props.basicInfo.JavaRuntimeInfo?.MaxMemoryMB
  const used = props.basicInfo.JavaRuntimeInfo?.UsedMemoryMB
  if (!total || used === undefined) return 0
  return Math.round((used / total) * 100)
})

const javaHeapUsagePercentage = computed(() => {
  const total = props.basicInfo.JavaRuntimeInfo?.HeapMaxMB
  const used = props.basicInfo.JavaRuntimeInfo?.HeapUsedMB
  if (!total || used === undefined) return 0
  return Math.round((used / total) * 100)
})

const javaMemoryColor = computed(() => getUsageColor(javaMemoryUsagePercentage.value))

const hasJavaInfo = computed(() =>
  Boolean(props.basicInfo.JavaRuntimeInfo?.JVMName || props.basicInfo.JavaRuntimeInfo?.JavaVersion)
)

const hasPhpInfo = computed(() => Boolean(props.basicInfo.PhpRuntimeInfo?.PHPVersion))
const phpExtensions = computed(() => props.basicInfo.PhpRuntimeInfo?.Extensions || [])

const hasMiddlewareInfo = computed(() =>
  Boolean(
    props.basicInfo.MiddlewareInfo?.MiddlewareType || props.basicInfo.MiddlewareInfo?.Version
  )
)

const jvmArgs = computed(() =>
  (props.basicInfo.JavaRuntimeInfo?.JVMArguments || []).map((value, index) => ({ index, value }))
)

const processFacts = computed(() => [
  { label: '进程名称', value: props.basicInfo.ProcessInfo?.ProcessName || '-' },
  { label: '进程 ID', value: props.basicInfo.ProcessInfo?.ProcessId || '-', mono: true },
  { label: '启动时间', value: formatDateTime(props.basicInfo.ProcessInfo?.StartTime) },
  { label: '运行时间', value: props.basicInfo.ProcessInfo?.Uptime || '-' }
])

const middlewareFacts = computed(() => [
  { label: '中间件类型', value: props.basicInfo.MiddlewareInfo?.MiddlewareType || '-' },
  { label: '版本', value: props.basicInfo.MiddlewareInfo?.Version || '-' },
  { label: 'Home', value: props.basicInfo.MiddlewareInfo?.Home || '-', mono: true },
  { label: 'Base', value: props.basicInfo.MiddlewareInfo?.Base || '-', mono: true }
])

const javaFacts = computed(() => [
  { label: 'JVM 名称', value: props.basicInfo.JavaRuntimeInfo?.JVMName || '-' },
  { label: 'JVM 版本', value: props.basicInfo.JavaRuntimeInfo?.JVMVersion || '-' },
  { label: 'Java 版本', value: props.basicInfo.JavaRuntimeInfo?.JavaVersion || '-' },
  { label: 'Java 供应商', value: props.basicInfo.JavaRuntimeInfo?.JavaVendor || '-' },
  { label: 'Java Home', value: props.basicInfo.JavaRuntimeInfo?.JavaHome || '-', mono: true },
  { label: '线程数', value: props.basicInfo.JavaRuntimeInfo?.ThreadCount || '-' }
])

const phpFacts = computed(() => [
  { label: 'PHP 版本', value: props.basicInfo.PhpRuntimeInfo?.PHPVersion || '-' },
  { label: 'SAPI', value: props.basicInfo.PhpRuntimeInfo?.SAPI || '-' },
  { label: '内存限制', value: props.basicInfo.PhpRuntimeInfo?.MemoryLimit || '-' },
  { label: '最长执行时间', value: `${props.basicInfo.PhpRuntimeInfo?.MaxExecutionTime || 0}s` },
  { label: 'open_basedir', value: props.basicInfo.PhpRuntimeInfo?.OpenBasedir || '未设置', mono: true },
  {
    label: '禁用函数',
    value: (props.basicInfo.PhpRuntimeInfo?.DisabledFunctions || []).join(', ') || '无',
    mono: true
  }
])
</script>

<style scoped>
.content-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.content-card {
  padding: 16px;
  min-width: 0;
  border: 1px solid var(--info-border);
  border-radius: var(--radius-container);
  background: var(--info-surface);
  box-shadow: none;
}

.extension-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 12px;
  min-width: 0;
}

.extension-list :deep(.el-tag) {
  max-width: 100%;
  height: auto;
  white-space: normal;
  word-break: break-all;
  overflow-wrap: anywhere;
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.card-header h3 {
  margin: 2px 0 0;
  font-size: 16px;
  line-height: 1.3;
  color: var(--el-text-color-primary);
}

.section-eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--el-color-primary);
}

.kv-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.kv-item {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 6px;
  padding: 12px 13px;
  border-radius: 0;
  border: 0;
  border-bottom: 1px solid var(--info-border);
  background: transparent;
}

.kv-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--el-text-color-secondary);
  text-transform: uppercase;
}

.kv-value {
  font-size: 14px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  word-break: break-word;
  overflow-wrap: anywhere;
}

.kv-value.mono {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
}

.content-card-wide {
  grid-column: 1 / -1;
}

.usage-dual-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.usage-panel {
  padding: 12px 13px;
  border-radius: 14px;
  border: 1px solid var(--info-border);
  background: var(--info-surface-soft);
}

.usage-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--el-text-color-secondary);
  text-transform: uppercase;
  margin-bottom: 8px;
}

.usage-meta {
  margin-top: 8px;
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.usage-meta > span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.table-shell {
  border: 1px solid var(--info-border);
  border-radius: 14px;
  overflow: hidden;
  background: var(--info-surface-soft);
  margin-top: 12px;
}

.compact-table {
  margin-top: 12px;
}

.compact-table .table-title {
  padding: 12px 12px 0;
  margin-bottom: 0;
}

.table-title {
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  padding: 12px 12px 0;
}

.mono-text {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
}

.truncate-text {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.table-shell :deep(.el-table) {
  --el-table-border-color: transparent;
  --el-table-header-bg-color: var(--info-surface);
  --el-table-row-hover-bg-color: color-mix(in srgb, var(--el-color-primary) 5%, var(--info-surface-soft));
}

.table-shell :deep(.el-table),
.table-shell :deep(.el-table__inner-wrapper),
.table-shell :deep(.el-table tr),
.table-shell :deep(.el-table td),
.table-shell :deep(.el-table th) {
  background: transparent;
}

.table-shell :deep(.el-table__inner-wrapper::before) {
  background: transparent;
}

.table-shell :deep(.el-table td),
.table-shell :deep(.el-table th) {
  padding-top: 7px;
  padding-bottom: 7px;
}

.table-shell :deep(.cell) {
  min-width: 0;
  overflow-wrap: anywhere;
}

@media (max-width: 980px) {
  .content-grid,
  .kv-grid,
  .usage-dual-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .usage-meta {
    flex-direction: column;
  }
}
</style>
