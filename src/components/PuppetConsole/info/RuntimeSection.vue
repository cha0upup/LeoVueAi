<template>
  <section class="info-section">
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
      v-if="hasMiddlewareInfo(basicInfo)"
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
      v-if="hasJavaInfo(basicInfo)"
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
            :color="getUsageColor(javaHeapUsagePercentage)"
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
            :color="getUsageColor(javaMemoryUsagePercentage)"
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
        class="table-shell"
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
      v-if="hasPhpInfo(basicInfo)"
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
        class="table-shell"
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
import {
  formatMBValue,
  getUsageColor,
  usagePercent,
  hasJavaInfo,
  hasPhpInfo,
  hasMiddlewareInfo
} from './infoModel.js'
import { formatDate as formatDateTime } from '@/utils/format.js'

const props = defineProps({
  basicInfo: {
    type: Object,
    required: true
  }
})

const javaMemoryUsagePercentage = computed(() =>
  usagePercent(
    props.basicInfo.JavaRuntimeInfo?.UsedMemoryMB,
    props.basicInfo.JavaRuntimeInfo?.MaxMemoryMB
  )
)
const javaHeapUsagePercentage = computed(() =>
  usagePercent(
    props.basicInfo.JavaRuntimeInfo?.HeapUsedMB,
    props.basicInfo.JavaRuntimeInfo?.HeapMaxMB
  )
)
const phpExtensions = computed(() => props.basicInfo.PhpRuntimeInfo?.Extensions || [])

const jvmArgs = computed(() =>
  (props.basicInfo.JavaRuntimeInfo?.JVMArguments || []).map((value) => ({ value }))
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
  {
    label: 'open_basedir',
    value: props.basicInfo.PhpRuntimeInfo?.OpenBasedir || '未设置',
    mono: true
  },
  {
    label: '禁用函数',
    value: (props.basicInfo.PhpRuntimeInfo?.DisabledFunctions || []).join(', ') || '无',
    mono: true
  }
])
</script>

<style scoped>
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

.kv-item {
  border-radius: 0;
  border: 0;
  border-bottom: 1px solid var(--info-border);
  background: transparent;
}

.usage-dual-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.usage-panel {
  border-radius: 14px;
  border: 1px solid var(--info-border);
  background: var(--info-surface-soft);
}

.table-shell {
  margin-top: 12px;
}

.table-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  padding: 12px 12px 0;
}

@media (max-width: 980px) {
  .usage-dual-grid {
    grid-template-columns: 1fr;
  }
}
</style>
