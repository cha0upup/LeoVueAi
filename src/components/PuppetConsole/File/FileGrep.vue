<template>
  <el-dialog
    v-model="visible"
    title="内容搜索"
    width="760px"
    :close-on-click-modal="false"
    :close-on-press-escape="true"
    align-center
    append-to-body
    class="file-grep-dialog file-dialog-shell"
    @close="handleClose"
  >
    <div class="grep-shell file-dialog-content">
      <FileOperationSummary
        :name="summaryName"
        :path="normalizedSearchPath"
        :icon="iconMap.search"
        :badges="summaryBadges"
      />

      <div class="grep-config">
        <el-form
          label-position="top"
          class="grep-form"
          @submit.prevent="doSearch"
        >
          <div class="search-grid">
            <el-form-item
              label="关键词"
              class="keyword-field"
            >
              <el-input
                v-model="keyword"
                placeholder="搜索关键词或正则表达式"
                clearable
                size="large"
                autofocus
                @keyup.enter="doSearch"
              >
                <template #prefix>
                  <el-icon><Icon :icon="iconMap.search" /></el-icon>
                </template>
              </el-input>
            </el-form-item>

            <el-form-item
              label="文件过滤"
              class="include-field"
            >
              <el-input
                v-model="include"
                placeholder="例如 *.java"
                clearable
                size="large"
              >
                <template #prefix>
                  <el-icon><Icon :icon="iconMap.filter" /></el-icon>
                </template>
              </el-input>
            </el-form-item>
          </div>

          <div class="grep-options">
            <el-checkbox v-model="ignoreCase">
              忽略大小写
            </el-checkbox>
            <el-checkbox v-model="useRegex">
              正则模式
            </el-checkbox>
          </div>
        </el-form>
      </div>

      <div class="dialog-footer file-dialog-footer grep-actions">
        <el-button
          :disabled="loading"
          @click="visible = false"
        >
          关闭
        </el-button>
        <el-tooltip
          :disabled="Boolean(keyword.trim())"
          content="请输入搜索关键词"
          placement="top"
        >
          <span>
            <el-button
              type="primary"
              :loading="loading"
              :disabled="!keyword.trim()"
              class="search-button"
              @click="doSearch"
            >
              <el-icon v-if="!loading"><Icon :icon="iconMap.search" /></el-icon>
              {{ loading ? '搜索中...' : '开始搜索' }}
            </el-button>
          </span>
        </el-tooltip>
      </div>

      <section
        v-if="result || error"
        class="grep-result-section"
      >
        <div
          v-if="result"
          class="grep-stats"
        >
          <el-tag
            type="info"
            size="small"
            effect="plain"
          >
            扫描 {{ result.scannedFiles }} 个文件
          </el-tag>
          <el-tag
            :type="result.matchCount > 0 ? 'danger' : 'success'"
            size="small"
            effect="plain"
          >
            {{ result.matchCount }} 个文件命中
          </el-tag>
          <el-tag
            v-if="result.truncated"
            type="warning"
            size="small"
            effect="plain"
          >
            结果已截断
          </el-tag>
        </div>

        <div
          v-if="result?.matches?.length"
          class="grep-results"
        >
          <el-collapse>
            <el-collapse-item
              v-for="(file, i) in result.matches"
              :key="i"
              :name="i"
            >
              <template #title>
                <div class="result-title">
                  <span class="mono path-text">{{ file.path }}</span>
                  <el-tag
                    type="danger"
                    size="small"
                    round
                  >
                    {{ file.hitCount }} 处
                  </el-tag>
                </div>
              </template>
              <div class="hit-list">
                <div
                  v-for="(hit, j) in file.hits"
                  :key="j"
                  class="hit-row"
                >
                  <span class="line-num">L{{ hit.line }}</span>
                  <span class="mono hit-content">{{ hit.content }}</span>
                </div>
              </div>
            </el-collapse-item>
          </el-collapse>
        </div>
        <div
          v-else-if="result && !result.matchCount"
          class="empty-result"
        >
          <el-icon><Icon :icon="iconMap.search" /></el-icon>
          <span>未找到匹配内容</span>
        </div>
        <div
          v-if="error"
          class="error-msg"
        >
          <el-icon><Icon :icon="iconMap.error" /></el-icon>
          <span>{{ error }}</span>
        </div>
      </section>
    </div>
  </el-dialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'
import { fileGrepApi } from '@/services/api/puppet-files.js'
import { formatFilePath } from '@/utils/format.js'
import FileOperationSummary from '@/components/PuppetConsole/File/FileOperationSummary.vue'

const iconMap = icons

const props = defineProps({
  sessionId: { type: String, required: true }
})

const visible    = ref(false)
const loading    = ref(false)
const keyword    = ref('')
const include    = ref('')
const ignoreCase = ref(true)
const useRegex   = ref(false)
const searchPath = ref('/')
const result     = ref(null)
const error      = ref('')

const normalizeDisplayPath = (path) => formatFilePath(path || '/').replace(/\/\.$/, '') || '/'

const normalizedSearchPath = computed(() => normalizeDisplayPath(searchPath.value))

const searchScopeName = computed(() => {
  const parts = normalizedSearchPath.value.split('/').filter(Boolean)
  return parts.at(-1) || '根目录'
})

const summaryName = computed(() => `内容搜索 · ${searchScopeName.value}`)

const summaryBadges = computed(() => [
  { label: '递归搜索', type: 'info' }
])

function openDialog(path) {
  searchPath.value = path || '/'
  keyword.value    = ''
  include.value    = ''
  result.value     = null
  error.value      = ''
  visible.value    = true
}

async function doSearch() {
  if (!keyword.value.trim()) return
  loading.value = true
  error.value   = ''
  result.value  = null
  try {
    const res = await fileGrepApi({
      sessionId:  props.sessionId,
      path:       searchPath.value,
      keyword:    keyword.value,
      include:    include.value || undefined,
      ignoreCase: ignoreCase.value,
      regex:      useRegex.value,
      maxResults: 300
    })
    const payload = res.data
    if (payload?.code === 200 || payload?.matches !== undefined) {
      result.value = payload
    } else {
      error.value = res?.data?.msg || '搜索失败'
    }
  } catch (e) {
    error.value = e?.response?.data?.msg || e.message || '请求失败'
  } finally {
    loading.value = false
  }
}

function handleClose() {
  result.value = null
  error.value  = ''
}

defineExpose({ openDialog })
</script>

<style scoped>
@import '@/styles/file-operation-dialog-shared.css';

.file-grep-dialog {
  --file-grep-panel-surface: color-mix(in srgb, var(--app-control-background-soft) 86%, var(--el-bg-color));
  --file-grep-raised-surface: color-mix(in srgb, var(--el-bg-color-overlay) 92%, var(--app-control-background-soft));
  --file-dialog-soft-border: color-mix(in srgb, var(--el-border-color) 28%, transparent);
}

:global(html:not(.dark) .file-grep-dialog),
:global(html[data-theme='light'] .file-grep-dialog) {
  --file-grep-panel-surface: #f7f9fc;
  --file-grep-raised-surface: #ffffff;
  --file-dialog-soft-border: rgba(30, 41, 59, 0.1);
}

.grep-shell {
  padding: 0;
}

.grep-config,
.grep-result-section {
  padding: 12px;
  border-radius: 12px;
  background: var(--file-grep-panel-surface);
  border: 1px solid color-mix(in srgb, var(--file-dialog-soft-border) 88%, transparent);
}

.grep-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.search-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(160px, 210px);
  gap: 10px;
  align-items: start;
}

.keyword-field,
.include-field {
  margin-bottom: 0 !important;
}

.grep-options {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 26px;
  flex-wrap: wrap;
}

.file-grep-dialog :deep(.grep-form .el-form-item__label) {
  margin-bottom: 5px;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-regular);
}

.file-grep-dialog :deep(.grep-form .el-input__wrapper) {
  min-height: 38px;
  border-radius: 10px;
}

.grep-actions {
  margin-top: 0;
  padding-top: 2px;
  align-items: center;
}

.grep-actions > span {
  display: inline-flex;
}

.search-button {
  min-width: 96px;
}

.search-button .el-icon {
  margin-right: 4px;
}

.grep-stats {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.grep-results {
  max-height: 360px;
  overflow-y: auto;
  border: 1px solid color-mix(in srgb, var(--file-dialog-soft-border) 88%, transparent);
  border-radius: 10px;
  padding: 4px 6px;
  background: var(--file-grep-raised-surface);
}

.file-grep-dialog :deep(.el-collapse) {
  border-top: 0;
  border-bottom: 0;
}

.file-grep-dialog :deep(.el-collapse-item__header) {
  min-height: 38px;
  border-bottom-color: color-mix(in srgb, var(--file-dialog-soft-border) 74%, transparent);
}

.file-grep-dialog :deep(.el-collapse-item__wrap) {
  border-bottom-color: color-mix(in srgb, var(--file-dialog-soft-border) 74%, transparent);
}

.result-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  min-width: 0;
  flex: 1;
}

.path-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.hit-list { display: flex; flex-direction: column; gap: 3px; padding: 4px 0; }

.hit-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 7px;
  background: color-mix(in srgb, var(--app-control-background-soft) 66%, transparent);
  font-size: 11px;
}

.line-num {
  flex-shrink: 0;
  color: var(--el-text-color-placeholder);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  min-width: 36px;
}

.hit-content {
  color: var(--el-text-color-primary);
  word-break: break-all;
  white-space: pre-wrap;
}

.empty-result,
.error-msg {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 64px;
  border-radius: 10px;
  background: var(--file-grep-raised-surface);
  border: 1px solid color-mix(in srgb, var(--file-dialog-soft-border) 88%, transparent);
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.error-msg {
  min-height: 40px;
  justify-content: flex-start;
  padding: 8px 10px;
  color: var(--el-color-danger);
  background: color-mix(in srgb, var(--el-color-danger) 6%, var(--file-grep-raised-surface));
  border-color: color-mix(in srgb, var(--el-color-danger) 18%, transparent);
}

.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }

.grep-results::-webkit-scrollbar { width: 4px; }
.grep-results::-webkit-scrollbar-track { background: transparent; }
.grep-results::-webkit-scrollbar-thumb { background: var(--el-border-color); border-radius: 999px; }

.file-grep-dialog :deep(.el-dialog__footer) {
  display: none;
}

@media (max-width: 768px) {
  .file-grep-dialog {
    width: 92vw !important;
  }

  .search-grid {
    grid-template-columns: 1fr;
  }

  .grep-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .grep-actions > span,
  .grep-actions .el-button {
    width: 100%;
  }
}
</style>
