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
        <span>版本 {{ disguise.version }}</span>
        <span>运行时 {{ runtimeLabels }}</span>
        <span>协议 v{{ disguise.protocolVersion }}</span>
        <span>Headers {{ headerEntries.length }}</span>
        <span>创建用户 {{ disguise.createUserId || '-' }}</span>
      </div>

      <div class="overview-grid">
        <article class="panel meta-panel">
          <div class="panel-header">
            元数据
          </div>
          <div class="kv-list single-column">
            <div class="kv-item">
              <label>创建时间</label>
              <span>{{ formatDate(disguise.createTime) }}</span>
            </div>
            <div class="kv-item">
              <label>更新时间</label>
              <span>{{ formatDate(disguise.updateTime) }}</span>
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
            <span>trafficEncodeBody</span>
            <div class="code-actions">
              <span>Java</span>
              <button
                type="button"
                class="panel-tool-btn"
                :disabled="!disguise.trafficEncodeBody"
                title="复制 trafficEncodeBody"
                @click="copyText(disguise.trafficEncodeBody, 'trafficEncodeBody 已复制')"
              >
                <el-icon><Icon :icon="iconMap.copy" /></el-icon>
              </button>
            </div>
          </div>
          <pre><code>{{ disguise.trafficEncodeBody || '暂无代码' }}</code></pre>
        </article>

        <article class="code-panel">
          <div class="panel-header panel-header-with-actions">
            <span>trafficDecodeBody</span>
            <div class="code-actions">
              <span>Java</span>
              <button
                type="button"
                class="panel-tool-btn"
                :disabled="!disguise.trafficDecodeBody"
                title="复制 trafficDecodeBody"
                @click="copyText(disguise.trafficDecodeBody, 'trafficDecodeBody 已复制')"
              >
                <el-icon><Icon :icon="iconMap.copy" /></el-icon>
              </button>
            </div>
          </div>
          <pre><code>{{ disguise.trafficDecodeBody || '暂无代码' }}</code></pre>
        </article>

        <article
          v-if="disguise.phpTrafficEncodeBody"
          class="code-panel"
        >
          <div class="panel-header panel-header-with-actions">
            <span>phpTrafficEncodeBody</span>
            <div class="code-actions">
              <span>PHP</span>
              <button
                type="button"
                class="panel-tool-btn"
                title="复制 phpTrafficEncodeBody"
                @click="copyText(disguise.phpTrafficEncodeBody, 'phpTrafficEncodeBody 已复制')"
              >
                <el-icon><Icon :icon="iconMap.copy" /></el-icon>
              </button>
            </div>
          </div>
          <pre><code>{{ disguise.phpTrafficEncodeBody }}</code></pre>
        </article>

        <article
          v-if="disguise.phpTrafficDecodeBody"
          class="code-panel"
        >
          <div class="panel-header panel-header-with-actions">
            <span>phpTrafficDecodeBody</span>
            <div class="code-actions">
              <span>PHP</span>
              <button
                type="button"
                class="panel-tool-btn"
                title="复制 phpTrafficDecodeBody"
                @click="copyText(disguise.phpTrafficDecodeBody, 'phpTrafficDecodeBody 已复制')"
              >
                <el-icon><Icon :icon="iconMap.copy" /></el-icon>
              </button>
            </div>
          </div>
          <pre><code>{{ disguise.phpTrafficDecodeBody }}</code></pre>
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
import { icons as iconMap } from '@/utils/icons.js'
import { formatDate } from '@/utils/format.js'
import { copyTextWithFeedback } from '@/utils/clipboard.js'

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

const isBuiltIn = computed(() => props.disguise?.disguiseId?.startsWith('inner_'))
const headerEntries = computed(() => Object.entries(props.disguise?.headers || {}))
const headersText = computed(() =>
  headerEntries.value.map(([key, value]) => `${key}: ${value || '-'}`).join('\n')
)
const runtimeLabels = computed(() => {
  return props.disguise?.supportedRuntimes?.map(runtime => runtime.toUpperCase()).join(' / ') || '-'
})

function handleActionCommand(command) {
  if (command === 'delete') {
    emit('delete', props.disguise)
  }
}

function copyText(text, successMessage) {
  if (!text) return
  return copyTextWithFeedback(text, successMessage)
}
</script>

<style scoped>
@import '@/styles/workbench-toolbar-shared.css';
@import '@/styles/workbench-detail-actions-shared.css';
@import '@/styles/detail-card-shared.css';

.detail-card {
  border: 1px solid
    var(--detail-border-soft, color-mix(in srgb, var(--el-border-color) 42%, transparent));
  --workbench-surface-muted: var(--detail-surface-muted);
  --workbench-border-soft: var(--detail-border-soft);
}

.detail-topbar {
  padding: var(--space-4) var(--space-4) var(--space-3);
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

.panel-header {
  min-height: 40px;
  display: flex;
  align-items: center;
  padding: 10px 12px;
}

.code-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.code-actions span {
  color: var(--el-text-color-secondary);
  font-size: var(--font-size-helper);
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

@media (max-width: 1200px) {
  .overview-grid,
  .code-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .detail-topbar {
    grid-template-columns: 1fr;
    padding: 14px;
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
}
</style>
