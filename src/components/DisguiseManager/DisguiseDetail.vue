<template>
  <section class="detail-card">
    <div
      v-if="loading"
      class="detail-loading"
    >
      <el-skeleton
        :rows="10"
        animated
      />
    </div>

    <div
      v-else-if="disguise"
      class="detail-content"
    >
      <div class="detail-topbar">
        <div class="identity-block">
          <div class="identity-title">
            <el-icon class="identity-icon">
              <Icon :icon="iconMap.mask" />
            </el-icon>
            <h2>{{ disguise.disguiseName || disguise.disguiseId }}</h2>
            <el-tag
              :type="isBuiltIn ? 'success' : 'primary'"
              effect="plain"
              class="disguise-type-tag workbench-type-tag"
            >
              {{ isBuiltIn ? '内置' : '自定义' }}
            </el-tag>
          </div>
          <p>{{ disguise.description || '未填写描述。' }}</p>
          <div class="identity-id">
            <span>ID</span>
            <code>{{ disguise.disguiseId }}</code>
          </div>
        </div>

        <div class="detail-actions">
          <el-button
            v-if="canManage"
            :loading="testing"
            @click="$emit('test', disguise)"
          >
            <el-icon><Icon :icon="iconMap.test" /></el-icon>
            测试
          </el-button>
          <el-button
            :loading="exporting"
            @click="$emit('export', disguise)"
          >
            <el-icon><Icon :icon="iconMap.download" /></el-icon>
            导出
          </el-button>
          <el-button
            v-if="canManage"
            type="primary"
            plain
            @click="$emit('edit', disguise)"
          >
            <el-icon><Icon :icon="iconMap.edit" /></el-icon>
            编辑
          </el-button>
          <el-dropdown
            v-if="canManage"
            trigger="click"
            @command="handleActionCommand"
          >
            <el-button
              class="more-btn"
              aria-label="更多伪装操作"
            >
              <el-icon><Icon :icon="iconMap.more" /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  command="delete"
                  :disabled="isBuiltIn || deleting"
                  divided
                  class="danger-item"
                >
                  <el-icon><Icon :icon="iconMap.delete" /></el-icon>
                  删除
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>

      <div class="meta-strip">
        <span>版本 {{ disguise.version || '1.0.0' }}</span>
        <span>运行时 {{ runtimeLabels }}</span>
        <span>协议 v{{ disguise.protocolVersion || 1 }}</span>
        <span>Headers {{ headerEntries.length }}</span>
        <span>创建用户 {{ disguise.createUserId || '-' }}</span>
        <span>更新 {{ formatTime(disguise.updateTime || disguise.createTime) }}</span>
      </div>

      <div class="overview-grid">
        <article class="panel meta-panel">
          <div class="panel-header">
            元数据
          </div>
          <div class="kv-list">
            <div class="kv-item">
              <label>Disguise ID</label>
              <code>{{ disguise.disguiseId }}</code>
            </div>
            <div class="kv-item">
              <label>伪装名称</label>
              <span>{{ disguise.disguiseName || '-' }}</span>
            </div>
            <div class="kv-item">
              <label>版本号</label>
              <span>{{ disguise.version || '1.0.0' }}</span>
            </div>
            <div class="kv-item">
              <label>创建时间</label>
              <span>{{ formatTime(disguise.createTime) }}</span>
            </div>
            <div class="kv-item">
              <label>更新时间</label>
              <span>{{ formatTime(disguise.updateTime) }}</span>
            </div>
            <div class="kv-item">
              <label>备注</label>
              <span>{{ disguise.remark || '暂无备注' }}</span>
            </div>
          </div>
        </article>

        <article class="panel headers-panel">
          <div class="panel-header panel-header-with-actions">
            <span>Headers</span>
            <button
              type="button"
              class="panel-tool-btn"
              :disabled="!headerEntries.length"
              title="复制 Headers"
              @click="copyText(headersText, 'Headers 已复制')"
            >
              <el-icon><Icon :icon="iconMap.copy" /></el-icon>
            </button>
          </div>
          <pre
            v-if="headerEntries.length"
            class="header-code"
          ><code><span
            v-for="([key, value], index) in headerEntries"
            :key="key"
            class="header-code-line"
          ><span class="line-no">{{ index + 1 }}</span><span class="header-key">{{ key }}</span><span class="header-colon">:</span><span class="header-value">{{ value || '-' }}</span></span></code></pre>
          <div
            v-else
            class="empty-block"
          >
            未配置 headers
          </div>
        </article>
      </div>

      <div class="code-grid">
        <article class="code-panel">
          <div class="panel-header panel-header-with-actions">
            <span>encodeBody</span>
            <div class="code-actions">
              <span>Java</span>
              <button
                type="button"
                class="panel-tool-btn"
                :disabled="!disguise.encodeBody"
                title="复制 encodeBody"
                @click="copyText(disguise.encodeBody, 'encodeBody 已复制')"
              >
                <el-icon><Icon :icon="iconMap.copy" /></el-icon>
              </button>
            </div>
          </div>
          <pre><code>{{ disguise.encodeBody || '暂无代码' }}</code></pre>
        </article>

        <article class="code-panel">
          <div class="panel-header panel-header-with-actions">
            <span>decodeBody</span>
            <div class="code-actions">
              <span>Java</span>
              <button
                type="button"
                class="panel-tool-btn"
                :disabled="!disguise.decodeBody"
                title="复制 decodeBody"
                @click="copyText(disguise.decodeBody, 'decodeBody 已复制')"
              >
                <el-icon><Icon :icon="iconMap.copy" /></el-icon>
              </button>
            </div>
          </div>
          <pre><code>{{ disguise.decodeBody || '暂无代码' }}</code></pre>
        </article>

        <article
          v-if="disguise.phpEncodeBody"
          class="code-panel"
        >
          <div class="panel-header panel-header-with-actions">
            <span>phpEncodeBody</span>
            <div class="code-actions">
              <span>PHP</span>
              <button
                type="button"
                class="panel-tool-btn"
                title="复制 phpEncodeBody"
                @click="copyText(disguise.phpEncodeBody, 'phpEncodeBody 已复制')"
              >
                <el-icon><Icon :icon="iconMap.copy" /></el-icon>
              </button>
            </div>
          </div>
          <pre><code>{{ disguise.phpEncodeBody }}</code></pre>
        </article>

        <article
          v-if="disguise.phpDecodeBody"
          class="code-panel"
        >
          <div class="panel-header panel-header-with-actions">
            <span>phpDecodeBody</span>
            <div class="code-actions">
              <span>PHP</span>
              <button
                type="button"
                class="panel-tool-btn"
                title="复制 phpDecodeBody"
                @click="copyText(disguise.phpDecodeBody, 'phpDecodeBody 已复制')"
              >
                <el-icon><Icon :icon="iconMap.copy" /></el-icon>
              </button>
            </div>
          </div>
          <pre><code>{{ disguise.phpDecodeBody }}</code></pre>
        </article>
      </div>
    </div>

    <div
      v-else
      class="detail-empty"
    >
      <EmptyState
        workbench
        title="选择一个伪装"
        description="左侧列表支持搜索和切换，右侧会加载完整字段与编解码实现。"
        :icon="iconMap.mask"
      />
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { icons } from '@/utils/icons.js'
import { formatDate } from '@/utils/format.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'

const props = defineProps({
  disguise: {
    type: Object,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  },
  deleting: {
    type: Boolean,
    default: false
  },
  testing: {
    type: Boolean,
    default: false
  },
  exporting: {
    type: Boolean,
    default: false
  },
  canManage: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['edit', 'delete', 'test', 'export'])

const iconMap = icons
const isBuiltIn = computed(() => props.disguise?.disguiseId?.startsWith('inner_'))
const headerEntries = computed(() => Object.entries(props.disguise?.headers || {}))
const headersText = computed(() =>
  headerEntries.value.map(([key, value]) => `${key}: ${value || '-'}`).join('\n')
)
const runtimeLabels = computed(() => {
  const runtimes = Array.isArray(props.disguise?.supportedRuntimes)
    ? props.disguise.supportedRuntimes
    : ['java']
  return runtimes.map((runtime) => String(runtime).toUpperCase()).join(' / ')
})

function handleActionCommand(command) {
  if (command === 'delete') {
    emit('delete', props.disguise)
  }
}

async function copyText(text, successMessage) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    showSuccess(successMessage)
  } catch {
    try {
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      showSuccess(successMessage)
    } catch {
      showError('复制失败，请手动复制')
    }
  }
}

function formatTime(timestamp) {
  if (!timestamp) {
    return '-'
  }
  return formatDate(timestamp)
}
</script>

<style scoped>
@import '@/styles/workbench-toolbar-shared.css';
@import '@/styles/detail-card-shared.css';
@import '@/styles/workbench-detail-actions-shared.css';

.detail-card {
  height: 100%;
  min-height: 0;
  border-radius: var(--radius-container);
  border: 1px solid
    var(--detail-border-soft, color-mix(in srgb, var(--el-border-color) 42%, transparent));
  background: var(--app-container-background);
  overflow: auto;
  --detail-surface-raised: color-mix(
    in srgb,
    var(--app-control-background-soft) 88%,
    var(--el-bg-color-overlay)
  );
  --detail-surface-raised-strong: color-mix(
    in srgb,
    var(--app-control-background-hover) 92%,
    var(--el-bg-color-overlay)
  );
  --detail-surface-muted: color-mix(
    in srgb,
    var(--app-control-background) 94%,
    var(--el-bg-color-overlay)
  );
  --detail-border-soft: color-mix(in srgb, var(--el-border-color) 42%, transparent);
  --workbench-surface-muted: var(--detail-surface-muted);
  --workbench-border-soft: var(--detail-border-soft);
  --detail-card-surface-raised: var(--detail-surface-raised);
  --detail-card-surface-muted: var(--detail-surface-muted);
  --detail-card-border-soft: var(--detail-border-soft);
}

.detail-loading,
.detail-empty {
  padding: 24px;
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0;
}

.detail-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: var(--space-4) var(--space-4) var(--space-3);
  background: var(--app-container-background);
  border-bottom: 1px solid var(--detail-border-soft);
}

.identity-block {
  min-width: 0;
  flex: 1 1 auto;
}

.identity-title {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.identity-icon {
  font-size: 18px;
  color: var(--el-color-primary);
}

.identity-title h2 {
  margin: 0;
  font-size: var(--font-size-page-title);
  line-height: 1.15;
}

.identity-block p {
  margin: 0 0 12px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.identity-id {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 9px;
  border-radius: var(--radius-control);
  background: var(--detail-surface-muted);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
}

.identity-id span {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.identity-id code {
  font-family: var(--el-font-family-mono);
  font-size: 12px;
}

.meta-strip {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 14px;
  padding: 0 18px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.meta-strip span {
  position: relative;
  line-height: 1.5;
}

.meta-strip span + span::before {
  content: '';
  position: absolute;
  left: -8px;
  top: 50%;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--el-text-color-secondary) 42%, transparent);
}

.overview-grid,
.code-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding: 0 18px;
}

.code-grid {
  padding-bottom: 18px;
}

.panel,
.code-panel {
  border-radius: var(--radius-container);
  border: 1px solid var(--detail-border-soft);
  background: var(--app-container-background);
}

.panel-header {
  min-height: 42px;
  display: flex;
  align-items: center;
  padding: 10px 12px;
  font-size: 13px;
}

.panel-header-with-actions {
  justify-content: space-between;
  gap: 10px;
}

.panel-tool-btn {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 42%, transparent);
  border-radius: 6px;
  background: var(--detail-surface-muted);
  color: var(--el-text-color-secondary);
  cursor: pointer;
}

.panel-tool-btn:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--el-color-primary) 42%, transparent);
  color: var(--el-color-primary);
}

.panel-tool-btn:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.code-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.code-actions span {
  color: var(--el-text-color-secondary);
  font-size: 11px;
  font-weight: 700;
}

.header-code {
  min-height: 168px;
  max-height: 260px;
  margin: 12px;
  padding: 12px 14px;
  overflow: auto;
  border-radius: var(--radius-control);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 28%, transparent);
  background: color-mix(in srgb, var(--detail-surface-muted) 86%, var(--el-bg-color-overlay));
  color: var(--el-text-color-primary);
  box-shadow: none;
}

.header-code code {
  display: block;
  font-family: var(--el-font-family-mono);
  font-size: 12px;
  line-height: 1.75;
  white-space: pre-wrap;
}

.header-code-line {
  display: block;
  min-width: 0;
}

.line-no {
  display: inline-block;
  width: 24px;
  margin-right: 12px;
  color: color-mix(in srgb, var(--app-code-text-muted) 66%, transparent);
  text-align: right;
  user-select: none;
}

.header-key {
  color: var(--el-color-primary);
  font-weight: 700;
}

.header-colon {
  margin: 0 6px 0 1px;
  color: var(--el-text-color-secondary);
}

.header-value {
  color: var(--el-text-color-primary);
  word-break: break-all;
}

.code-panel pre {
  margin: 0;
  overflow: auto;
  height: 330px;
}

.kv-list {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 12px;
  max-height: 260px;
}

.kv-item {
  padding: 9px 10px;
  border-radius: var(--radius-control);
}

.kv-item label {
  margin-bottom: 4px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.kv-item span,
.kv-item code {
  font-size: 12px;
}

.code-panel code {
  display: block;
  min-height: 100%;
  padding: 14px;
  font-family: var(--el-font-family-mono);
  font-size: 12px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
  background: color-mix(in srgb, var(--detail-surface-muted) 86%, var(--el-bg-color-overlay));
  color: var(--el-text-color-primary);
}

.empty-block {
  padding: 14px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.detail-empty {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 1200px) {
  .overview-grid,
  .code-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .detail-content {
    padding: 0;
  }

  .detail-topbar,
  .kv-list {
    grid-template-columns: 1fr;
  }

  .detail-topbar {
    flex-direction: column;
    padding: 14px;
  }

  .detail-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .detail-actions :deep(.el-button) {
    margin: 0;
  }

  .overview-grid,
  .code-grid,
  .meta-strip {
    padding-left: 12px;
    padding-right: 12px;
  }

  .kv-list {
    grid-template-columns: 1fr;
  }

}
</style>
