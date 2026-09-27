<template>
  <section class="detail-card">
    <div
      v-if="detailLoading"
      class="detail-loading"
    >
      <el-skeleton
        :rows="10"
        animated
      />
    </div>

    <div
      v-else-if="detail"
      class="detail-content"
    >
      <div class="detail-topbar">
        <div class="identity-block">
          <div class="identity-title">
            <el-icon class="identity-icon">
              <Icon :icon="iconMap.fingerprint" />
            </el-icon>
            <h2>{{ detail.name || detail.fingerprintId }}</h2>
            <el-tag
              type="primary"
              effect="light"
              class="detail-protocol-tag"
            >
              HTTP
            </el-tag>
            <el-tag
              v-if="detail.info?.version"
              type="info"
              effect="plain"
            >
              v{{ detail.info.version }}
            </el-tag>
          </div>
          <p>{{ detail.info?.remark || '未填写备注。' }}</p>
          <div class="identity-id">
            <span>Fingerprint ID</span>
            <code>{{ detail.fingerprintId }}</code>
          </div>
        </div>

        <div class="detail-actions">
          <el-button @click="$emit('debug')">
            调试
          </el-button>
          <el-button
            :loading="exportLoading"
            @click="$emit('export')"
          >
            <el-icon><Icon :icon="iconMap.download" /></el-icon>
            导出
          </el-button>
          <el-button
            v-if="canManage"
            type="primary"
            plain
            @click="$emit('edit')"
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
              aria-label="更多指纹操作"
            >
              <el-icon><Icon :icon="iconMap.more" /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  command="delete"
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
        <span>HTTP</span>
        <span>{{ detail.tags?.length || 0 }} 标签</span>
        <span>{{ requestList.length }} 请求</span>
        <span>版本 {{ detail.info?.version || '-' }}</span>
      </div>

      <div class="info-grid">
        <article class="panel">
          <div class="panel-header">
            基础信息
          </div>
          <div class="kv-list">
            <div class="kv-item">
              <label>Fingerprint ID</label>
              <code>{{ detail.fingerprintId }}</code>
            </div>
            <div class="kv-item">
              <label>名称</label>
              <span>{{ detail.name || '-' }}</span>
            </div>
            <div class="kv-item">
              <label>协议</label>
              <span>HTTP</span>
            </div>
            <div class="kv-item">
              <label>版本</label>
              <span>{{ detail.info?.version || '-' }}</span>
            </div>
            <div class="kv-item span-2">
              <label>标签</label>
              <div class="tags-wrap">
                <template v-if="detail.tags?.length">
                  <el-tag
                    v-for="tag in detail.tags"
                    :key="tag"
                    size="small"
                    type="info"
                    effect="plain"
                  >
                    {{ tag }}
                  </el-tag>
                </template>
                <span v-else>—</span>
              </div>
            </div>
          </div>
        </article>

        <article class="panel">
          <div class="panel-header">
            元信息
          </div>
          <div class="kv-list single-column">
            <div class="kv-item">
              <label>作者</label>
              <span>{{ detail.info?.author || '-' }}</span>
            </div>
            <div class="kv-item">
              <label>备注</label>
              <span>{{ detail.info?.remark || '暂无备注' }}</span>
            </div>
          </div>
        </article>
      </div>

      <div class="request-panel panel">
        <div class="panel-header">
          请求列表
        </div>
        <div
          v-if="requestList.length"
          class="request-list"
        >
          <article
            v-for="(req, index) in requestList"
            :key="index"
            class="request-card"
          >
            <div class="request-card-header">
              <el-tag
                size="small"
                type="primary"
                effect="plain"
              >
                请求 {{ index + 1 }}
              </el-tag>
              <el-tag
                v-if="req.method"
                size="small"
                effect="plain"
              >
                {{ req.method }}
              </el-tag>
              <code class="request-path">{{ req.path || '/' }}</code>
            </div>

            <div class="request-card-body">
              <div
                v-if="req.timeout != null"
                class="request-row"
              >
                <label>超时</label>
                <span>{{ req.timeout }} ms</span>
              </div>
              <div
                v-if="req.headers && Object.keys(req.headers).length"
                class="request-row block"
              >
                <label>Headers</label>
                <pre>{{ formatHeaders(req.headers) }}</pre>
              </div>
              <div
                v-if="req.body"
                class="request-row block"
              >
                <label>Body</label>
                <pre>{{ req.body }}</pre>
              </div>
            </div>
          </article>
        </div>
        <div
          v-else
          class="empty-block"
        >
          无请求配置
        </div>
      </div>

      <div class="script-panel panel">
        <div class="panel-header">
          命中条件
        </div>
        <pre class="script-block">{{ formattedMatch }}</pre>
      </div>
      <div
        v-if="detail.rule?.version"
        class="script-panel panel"
      >
        <div class="panel-header">
          版本提取
        </div>
        <pre class="script-block">{{ JSON.stringify(detail.rule.version, null, 2) }}</pre>
      </div>
    </div>

    <div
      v-else
      class="detail-empty"
    >
      <EmptyState
        workbench
        title="选择一个指纹"
        description="左侧列表支持搜索，右侧展示元信息、请求列表和命中条件。"
        :icon="iconMap.fingerprint"
      />
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { icons } from '@/utils/icons.js'

const emit = defineEmits(['edit', 'export', 'delete', 'debug'])

const props = defineProps({
  detail: {
    type: Object,
    default: null
  },
  detailLoading: {
    type: Boolean,
    default: false
  },
  exportLoading: {
    type: Boolean,
    default: false
  },
  canManage: {
    type: Boolean,
    default: false
  }
})

const iconMap = icons
const requestList = computed(() =>
  Array.isArray(props.detail?.rule?.requests) ? props.detail.rule.requests : []
)
const formattedMatch = computed(() => props.detail?.rule?.match
  ? JSON.stringify(props.detail.rule.match, null, 2)
  : '—')

function handleActionCommand(command) {
  if (command === 'delete') {
    emit('delete')
  }
}

function formatHeaders(headers) {
  if (!headers || typeof headers !== 'object') return '—'
  return Object.entries(headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')
}
</script>

<style scoped>
@import '@/styles/workbench-detail-actions-shared.css';

.detail-card {
  height: 100%;
  min-height: 0;
  border-radius: var(--radius-container);
  border: 1px solid
    var(--detail-border-soft, color-mix(in srgb, var(--el-border-color) 34%, transparent));
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
  padding: 16px 18px 14px;
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

:deep(.detail-protocol-tag) {
  border: 1px solid var(--detail-border-soft);
  background: color-mix(in srgb, var(--detail-surface-muted) 78%, white);
  color: var(--el-text-color-primary);
  font-weight: 700;
}

:deep(.detail-protocol-tag.el-tag--primary) {
  background: color-mix(in srgb, var(--el-color-primary-light-8) 82%, white);
  border-color: color-mix(in srgb, var(--el-color-primary) 36%, transparent);
  color: var(--el-color-primary-dark-2);
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

.meta-strip > span + span::before {
  content: '';
  position: absolute;
  left: -8px;
  top: 50%;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--el-text-color-secondary) 42%, transparent);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding: 0 18px;
}

.panel {
  overflow: hidden;
  border: 1px solid var(--detail-border-soft);
  border-radius: var(--radius-container);
  background: var(--app-container-background);
}

.panel-header {
  padding: 12px 14px;
  border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  font-size: 13px;
  font-weight: 700;
}

.kv-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 14px;
}

.single-column {
  grid-template-columns: 1fr;
}

.kv-item {
  min-width: 0;
  padding: 10px 12px;
  border-radius: var(--radius-control);
  background: var(--detail-surface-muted);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
}

.span-2 {
  grid-column: 1 / -1;
}

.kv-item label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.kv-item span,
.kv-item code {
  display: block;
  font-size: 13px;
  line-height: 1.6;
  word-break: break-word;
}

.tags-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.request-panel,
.script-panel {
  margin-left: 18px;
  margin-right: 18px;
}

.script-panel {
  margin-bottom: 18px;
}

.request-list {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.request-card {
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  background: var(--detail-surface-muted);
  overflow: hidden;
}

.request-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 10px 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
}

.request-path {
  font-family: var(--el-font-family-mono);
  font-size: 12px;
}

.request-card-body {
  padding: 12px;
}

.request-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 12px;
}

.request-row.block {
  display: block;
}

.request-row:last-child {
  margin-bottom: 0;
}

.request-row label {
  display: inline-block;
  min-width: 56px;
  margin-bottom: 6px;
  color: var(--el-text-color-secondary);
}

.request-row pre,
.script-block {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  line-height: 1.7;
  font-family: var(--el-font-family-mono);
}

.script-block {
  padding: 14px;
  background: var(--app-code-background);
  color: var(--app-code-text);
  min-height: 180px;
  overflow: auto;
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
  .summary-strip,
  .info-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .detail-content {
    padding: 12px;
  }

  .detail-topbar {
    flex-direction: column;
    padding-bottom: 14px;
  }

  .detail-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .summary-strip,
  .kv-list {
    grid-template-columns: 1fr;
  }
}
</style>
