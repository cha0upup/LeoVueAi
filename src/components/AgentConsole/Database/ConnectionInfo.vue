<template>
  <div class="connection-overview database-info-shell">
    <div class="overview-header database-info-header">
      <h2 class="database-info-title">
        <el-icon class="database-info-title-icon">
          <Icon :icon="iconMap.database" />
        </el-icon>
        连接信息
      </h2>
      <el-button
        size="small"
        :loading="status === 'connecting'"
        @click="emit('retry')"
      >
        <el-icon><Icon :icon="iconMap.refresh" /></el-icon>
        {{ status === 'error' ? '重新连接' : '测试连接' }}
      </el-button>
    </div>

    <el-alert
      v-if="status === 'error'"
      class="connection-error"
      type="error"
      :title="errorMessage || '数据库连接失败'"
      :closable="false"
      show-icon
    />

    <el-descriptions
      :column="2"
      border
      class="database-info-descriptions"
    >
      <el-descriptions-item label="连接状态">
        <el-tag :type="statusPresentation.type">
          {{ statusPresentation.label }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="SQL 方言">
        {{ dialectDisplay }}
      </el-descriptions-item>
      <el-descriptions-item label="数据库版本">
        {{ details.databaseVersion || '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="连接用户">
        {{ details.user || connection.username || '-' }}
      </el-descriptions-item>
      <el-descriptions-item
        label="连接地址"
        :span="2"
      >
        <span class="connection-target">{{ connectionTarget }}</span>
      </el-descriptions-item>
      <el-descriptions-item
        v-if="details.driverVersion"
        label="驱动版本"
        :span="2"
      >
        {{ details.driverVersion }}
      </el-descriptions-item>
    </el-descriptions>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'
import { formatDatabaseConnectionTarget } from '@/utils/database.js'
import sqlEngine from './SqlEngine.js'
import { getDatabaseConnectionStatusPresentation } from './useDatabaseConnectionState.js'

const iconMap = icons

const props = defineProps({
  connection: {
    type: Object,
    required: true
  },
  status: {
    type: String,
    default: 'idle'
  },
  errorMessage: {
    type: String,
    default: ''
  },
  details: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['retry'])

const statusPresentation = computed(() =>
  getDatabaseConnectionStatusPresentation(props.status)
)

const dialectDisplay = computed(() => sqlEngine.getDialectName(props.connection.dialect))

const connectionTarget = computed(() => formatDatabaseConnectionTarget(props.connection))
</script>

<style scoped>
@import '@/styles/database-info-shared.css';

.connection-overview {
  padding: var(--el-spacing-xl);
}

.overview-header {
  margin-bottom: var(--el-spacing-large);
}

.connection-error {
  margin-bottom: var(--el-spacing-large);
}

.connection-target {
  font-family: var(--el-font-family-mono, monospace);
  color: var(--el-text-color-regular);
  word-break: break-all;
}
</style>
