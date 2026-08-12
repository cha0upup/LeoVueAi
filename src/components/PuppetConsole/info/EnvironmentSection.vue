<template>
  <section class="content-grid">
    <article class="content-card">
      <div class="card-header">
        <div>
          <div class="section-eyebrow">
            操作系统
          </div>
          <h3>主机基础环境</h3>
        </div>
      </div>
      <div class="kv-grid">
        <div
          v-for="item in osFacts"
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

    <article class="content-card">
      <div class="card-header">
        <div>
          <div class="section-eyebrow">
            用户环境
          </div>
          <h3>当前用户与目录</h3>
        </div>
      </div>
      <div class="kv-grid">
        <div
          v-for="item in userFacts"
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

    <article class="content-card content-card-wide">
      <div class="card-header">
        <div>
          <div class="section-eyebrow">
            环境变量
          </div>
          <h3>运行上下文与路径配置</h3>
        </div>
        <el-button
          v-if="envVars.length > ENV_PREVIEW_LIMIT"
          text
          size="small"
          @click="envExpanded = !envExpanded"
        >
          {{ envExpanded ? '收起' : `展开全部（${envVars.length}）` }}
        </el-button>
      </div>
      <div class="table-shell">
        <el-table
          :data="visibleEnvVars"
          stripe
          max-height="420"
        >
          <el-table-column
            prop="key"
            label="变量名"
            min-width="220"
          >
            <template #default="{ row }">
              <span class="mono-text">{{ row.key }}</span>
            </template>
          </el-table-column>
          <el-table-column
            prop="value"
            label="变量值"
            min-width="320"
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
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { formatDate as formatDateTime } from '@/utils/format.js'

const ENV_PREVIEW_LIMIT = 24

const props = defineProps({
  basicInfo: {
    type: Object,
    required: true
  }
})

const envExpanded = ref(false)


const mapEntries = (source) =>
  Object.entries(source || {}).map(([key, value]) => ({
    key,
    value
  }))

const envVars = computed(() => mapEntries(props.basicInfo.EnvironmentInfo))
const visibleEnvVars = computed(() =>
  envExpanded.value ? envVars.value : envVars.value.slice(0, ENV_PREVIEW_LIMIT)
)

const osFacts = computed(() => [
  { label: '操作系统', value: props.basicInfo.OSInfo?.OSName || '-' },
  { label: '系统版本', value: props.basicInfo.OSInfo?.OSVersion || '-' },
  { label: '系统架构', value: props.basicInfo.OSInfo?.OSArch || '-' },
  { label: '主机名', value: props.basicInfo.OSInfo?.HostName || '-' },
  { label: '系统运行时间', value: props.basicInfo.OSInfo?.SystemUptime || '-' },
  { label: '启动时间', value: formatDateTime(props.basicInfo.OSInfo?.StartTime) }
])

const userFacts = computed(() => [
  { label: '用户名', value: props.basicInfo.UserInfo?.UserName || '-' },
  { label: '用户目录', value: props.basicInfo.UserInfo?.UserDir || '-', mono: true },
  { label: '用户主目录', value: props.basicInfo.UserInfo?.UserHome || '-', mono: true },
  { label: '语言', value: props.basicInfo.UserInfo?.UserLanguage || '-' },
  { label: '时区', value: props.basicInfo.UserInfo?.UserTimezone || '-' }
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

.content-card-wide {
  grid-column: 1 / -1;
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

.table-shell {
  border: 1px solid var(--info-border);
  border-radius: 14px;
  overflow: hidden;
  background: var(--info-surface-soft);
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
  .kv-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .content-card,
  .content-card-wide {
    padding-left: 12px;
    padding-right: 12px;
  }
}
</style>
