<template>
  <section class="info-section">
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
          <span class="kv-value">{{ item.value }}</span>
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

const envVars = computed(() =>
  Object.entries(props.basicInfo.EnvironmentInfo || {}).map(([key, value]) => ({ key, value }))
)
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
.kv-item {
  border-radius: 0;
  border: 0;
  border-bottom: 1px solid var(--info-border);
  background: transparent;
}

@media (max-width: 640px) {
  .content-card {
    padding-left: 12px;
    padding-right: 12px;
  }
}
</style>
