<template>
  <div class="sql-query">
    <div class="query-toolbar">
      <div class="toolbar-left">
        <el-button
          type="primary"
          size="small"
          :loading="loading"
          @click="executeQuery"
        >
          <el-icon><Icon :icon="iconMap.play" /></el-icon>
          执行 (Ctrl+Enter)
        </el-button>
        <el-button
          v-if="loading"
          type="warning"
          plain
          size="small"
          @click="cancelQuery"
        >
          停止等待
        </el-button>
        <el-button
          size="small"
          @click="clearQuery"
        >
          <el-icon><Icon :icon="iconMap.close" /></el-icon>
          清空
        </el-button>
        <el-button
          size="small"
          @click="formatSql"
        >
          <el-icon><Icon :icon="iconMap.format" /></el-icon>
          格式化
        </el-button>
      </div>
      <div class="toolbar-right">
        <span class="timeout-label">查询超时</span>
        <el-input-number
          v-model="queryTimeoutSeconds"
          :min="1"
          :max="300"
          :controls="false"
          size="small"
          class="timeout-input"
          aria-label="SQL 查询超时秒数"
        />
        <span class="timeout-label">秒</span>
        <el-tag
          v-if="currentDatabase"
          type="success"
        >
          {{ currentDatabase }}
        </el-tag>
        <el-tag v-if="executionTime">
          执行时间: {{ executionTime }}ms
        </el-tag>
      </div>
    </div>

    <div class="editor-container">
      <el-input
        v-model="sqlText"
        type="textarea"
        :rows="12"
        placeholder="输入SQL查询语句...&#10;&#10;示例:&#10;SELECT * FROM table_name WHERE id = 1;&#10;&#10;快捷键:&#10;Ctrl+Enter: 执行查询"
        @keydown="handleKeydown"
      />
    </div>

    <div
      v-if="hasResult"
      class="query-result"
    >
      <el-tabs
        v-model="activeTab"
        type="card"
      >
        <el-tab-pane
          label="查询结果"
          name="result"
        >
          <div class="result-info">
            <el-alert
              :title="executionSummary"
              type="success"
              :closable="false"
            />
            <el-alert
              v-if="executionResult?.truncated"
              class="truncation-alert"
              :title="truncationMessage"
              type="warning"
              :closable="false"
              show-icon
            />
          </div>
          <el-table
            v-loading="loading"
            :data="resultRows"
            border
            stripe
            max-height="300"
            style="width: 100%"
          >
            <el-table-column
              v-for="(header, index) in resultHeaders"
              :key="index"
              :prop="`col_${index}`"
              :label="header"
              min-width="120"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                {{ formatCellValue(row[index]) }}
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
        <el-tab-pane
          label="SQL语句"
          name="sql"
        >
          <el-input
            :value="executedSql"
            type="textarea"
            :rows="10"
            readonly
          />
        </el-tab-pane>
      </el-tabs>
    </div>

    <div
      v-if="errorMessage"
      class="query-error"
    >
      <el-alert
        :title="errorMessage"
        type="error"
        :closable="false"
        show-icon
      />
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'

import { icons } from '@/utils/icons.js'
import sqlEngine from './SqlEngine.js'
import { showError, showSuccess, showWarning } from '@/utils/messageUtils.js'
import { formatDatabaseError } from '@/utils/databaseError.js'
import {
  getDatabaseTruncationMessage,
  isCanceledDatabaseRequest,
  normalizeDatabaseQueryTimeout
} from './database-query-status.js'

const iconMap = icons

const props = defineProps({
  sessionId: {
    type: String,
    required: true
  },
  connection: {
    type: Object,
    required: true
  },
  connected: {
    type: Boolean,
    default: false
  },
  currentDatabase: {
    type: String,
    default: ''
  }
})

const sqlText = ref('')
const loading = ref(false)
const executionTime = ref(0)
const resultHeaders = ref([])
const resultRows = ref([])
const executedSql = ref('')
const errorMessage = ref('')
const activeTab = ref('result')
const executionResult = ref(null)
const queryTimeoutSeconds = ref(normalizeDatabaseQueryTimeout(props.connection.timeoutSeconds))
let activeController = null

watch(
  () => [props.connection.connectionId, props.connection.timeoutSeconds],
  () => {
    if (!loading.value) {
      queryTimeoutSeconds.value = normalizeDatabaseQueryTimeout(props.connection.timeoutSeconds)
    }
  }
)

const hasResult = computed(() => executionResult.value !== null)
const truncationMessage = computed(() => getDatabaseTruncationMessage(executionResult.value || {}))
const executionSummary = computed(() => {
  if (!executionResult.value) return ''
  if (resultHeaders.value.length > 0) {
    return `查询成功，返回 ${resultRows.value.length} 行记录`
  }
  const affectedRows = executionResult.value.affectedRows
  if (affectedRows !== null && affectedRows !== undefined) {
    return `执行成功，影响 ${affectedRows} 行`
  }
  const statementType = executionResult.value.statementType || 'SQL'
  return `${statementType} 执行成功`
})

const handleKeydown = (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault()
    executeQuery()
  }
}

const executeQuery = async () => {
  if (!sqlText.value.trim()) {
    showWarning('请输入SQL查询语句')
    return
  }

  if (!props.connected) {
    showWarning('数据库连接未配置')
    return
  }

  activeController?.abort()
  const controller = new AbortController()
  activeController = controller
  loading.value = true
  errorMessage.value = ''
  resultHeaders.value = []
  resultRows.value = []
  executionResult.value = null
  executedSql.value = sqlText.value.trim()

  const startTime = Date.now()

  try {
    const params = {
      sessionId: props.sessionId,
      connection: props.connection,
      sql: executedSql.value,
      queryTimeoutSeconds: normalizeDatabaseQueryTimeout(queryTimeoutSeconds.value),
      signal: controller.signal
    }

    const response = await sqlEngine.executeQuery(params)
    const result = response?.data || {}
    const columns = Array.isArray(result.columns) ? result.columns : []
    const rows = Array.isArray(result.rows) ? result.rows : []

    if (columns.length > 0) {
      resultHeaders.value = columns.map((column) => column.label || column.name || '')
      resultRows.value = rows.map((row) =>
        columns.map((column) => {
          const key = column.name || column.label
          return row && key in row ? row[key] : null
        })
      )
    }
    executionResult.value = result
    activeTab.value = 'result'
    if (result.truncated) showWarning(truncationMessage.value)
    else showSuccess(executionSummary.value)

    executionTime.value = Date.now() - startTime
  } catch (error) {
    if (!isCanceledDatabaseRequest(error)) {
      errorMessage.value = formatDatabaseError(error, '查询执行失败')
      showError(errorMessage.value)
    }
  } finally {
    if (activeController === controller) {
      activeController = null
      loading.value = false
    }
  }
}

const cancelQuery = () => {
  activeController?.abort()
}

const clearQuery = () => {
  cancelQuery()
  sqlText.value = ''
  resultHeaders.value = []
  resultRows.value = []
  executionResult.value = null
  errorMessage.value = ''
  executionTime.value = 0
}

onBeforeUnmount(cancelQuery)

const formatSql = () => {
  if (!sqlText.value.trim()) {
    return
  }
  // 简单的SQL格式化
  let formatted = sqlText.value
    .replace(/\s+/g, ' ')
    .replace(/,/g, ',\n  ')
    .replace(/\bFROM\b/gi, '\nFROM')
    .replace(/\bWHERE\b/gi, '\nWHERE')
    .replace(/\bAND\b/gi, '\n  AND')
    .replace(/\bOR\b/gi, '\n  OR')
    .replace(/\bORDER BY\b/gi, '\nORDER BY')
    .replace(/\bGROUP BY\b/gi, '\nGROUP BY')
    .replace(/\bJOIN\b/gi, '\nJOIN')
    .replace(/\bLEFT JOIN\b/gi, '\nLEFT JOIN')
    .replace(/\bRIGHT JOIN\b/gi, '\nRIGHT JOIN')
    .trim()

  sqlText.value = formatted
  showSuccess('SQL格式化完成')
}

const formatCellValue = (value) => {
  if (value === null || value === undefined) {
    return '(NULL)'
  }
  return String(value)
}
</script>

<style scoped>
.sql-query {
  --sql-query-panel-surface: var(--app-card-background);
  --sql-query-muted-surface: var(--app-control-background-soft);
  --sql-query-strong-surface: var(--app-control-background);
  --sql-query-soft-border: color-mix(in srgb, var(--el-border-color) 72%, transparent);
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--sql-query-panel-surface);
}

:global(html:not(.dark) .sql-query),
:global(html[data-theme='light'] .sql-query) {
  --sql-query-panel-surface: var(--app-surface-background);
  --sql-query-muted-surface: #f2f2f2;
  --sql-query-strong-surface: var(--app-control-background);
  --sql-query-soft-border: color-mix(in srgb, var(--el-border-color) 68%, transparent);
}

:global(html.dark .sql-query),
:global(html[data-theme='dark'] .sql-query) {
  --sql-query-panel-surface: color-mix(
    in srgb,
    var(--app-card-background) 82%,
    var(--app-surface-background)
  );
  --sql-query-muted-surface: color-mix(
    in srgb,
    var(--app-control-background-soft) 76%,
    var(--app-card-background)
  );
  --sql-query-strong-surface: color-mix(
    in srgb,
    var(--app-control-background) 84%,
    var(--app-card-background)
  );
  --sql-query-soft-border: color-mix(in srgb, var(--el-border-color) 52%, transparent);
}

.query-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  min-height: 40px;
  padding: 6px 10px;
  background: var(--sql-query-muted-surface);
  border-bottom: 1px solid var(--sql-query-soft-border);
  flex-shrink: 0;
}

.toolbar-left {
  display: flex;
  gap: 6px;
}

.toolbar-right {
  display: flex;
  gap: var(--el-spacing-base);
  align-items: center;
}

.timeout-label {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.timeout-input {
  width: 64px;
}

.editor-container {
  flex-shrink: 0;
  padding: 8px 10px;
  background: var(--sql-query-panel-surface);
}

.editor-container :deep(.el-textarea__inner) {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
  font-size: 0.875rem;
  line-height: 1.6;
  border: 1px solid color-mix(in srgb, var(--app-code-border) 72%, transparent);
  border-radius: 6px;
  background: var(--app-code-background);
  color: var(--app-code-foreground, #e6edf3);
  box-shadow: none;
}

.query-result {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 8px 10px;
  background: var(--sql-query-panel-surface);
}

.result-info {
  margin-bottom: var(--el-spacing-base);
}

.truncation-alert {
  margin-top: var(--el-spacing-small);
}

.query-error {
  padding: var(--el-spacing-large);
  background: var(--sql-query-panel-surface);
}

:deep(.el-tabs__content) {
  overflow: auto;
}
</style>
