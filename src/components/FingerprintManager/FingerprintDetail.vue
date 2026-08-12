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
              v-if="detail.protocol"
              :type="detail.protocol === 'http' ? 'primary' : 'info'"
              effect="light"
              class="detail-protocol-tag"
            >
              {{ detail.protocol }}
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
        <span>{{ (detail.protocol || '-').toUpperCase() }}</span>
        <span>{{ detail.tags?.length || 0 }} 标签</span>
        <span>{{ requestList.length }} 请求</span>
        <span>版本 {{ detail.info?.version || '-' }}</span>
        <span
          class="risk-pill"
          :class="{ 'has-vulns': vulnerabilityList.length }"
        >
          {{ vulnerabilityList.length ? `已知漏洞 ${vulnerabilityList.length}` : '暂无已知漏洞' }}
        </span>
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
              <span>{{ detail.protocol || '-' }}</span>
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

      <div
        v-if="vulnerabilityList.length"
        class="vulnerability-panel panel"
      >
        <div class="panel-header">
          已知漏洞情报
          <el-tag
            type="danger"
            size="small"
            effect="plain"
            class="vuln-count-tag"
          >
            {{ vulnerabilityList.length }}
          </el-tag>
        </div>
        <div class="vulnerability-list">
          <article
            v-for="(vuln, index) in vulnerabilityList"
            :key="index"
            class="vulnerability-card"
            :class="`severity-${vuln.severity || 'unknown'}`"
          >
            <div class="vuln-header">
              <el-tag
                :type="severityTagType(vuln.severity)"
                size="small"
                effect="dark"
                class="vuln-severity-tag"
              >
                {{ severityLabel(vuln.severity) }}
              </el-tag>
              <h4 class="vuln-title">
                {{ vuln.title || '未命名漏洞' }}
              </h4>
              <el-tag
                v-if="vuln.cve"
                size="small"
                type="warning"
                effect="plain"
              >
                {{ vuln.cve }}
              </el-tag>
              <el-tag
                v-if="vuln.exploitSkill"
                size="small"
                type="success"
                effect="plain"
              >
                skill: {{ vuln.exploitSkill }}
              </el-tag>
            </div>
            <p
              v-if="vuln.description"
              class="vuln-description"
            >
              {{ vuln.description }}
            </p>
            <div
              v-if="vuln.references && vuln.references.length"
              class="vuln-references"
            >
              <template
                v-for="ref in vuln.references"
                :key="ref"
              >
                <a
                  v-if="isSafeUrl(ref)"
                  :href="ref"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {{ ref }}
                </a>
                <span
                  v-else
                  class="vuln-reference-invalid"
                  :title="'非 http(s) 协议,已禁用跳转'"
                >
                  {{ ref }}
                </span>
              </template>
            </div>
          </article>
        </div>
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
              <template v-if="isHttp">
                <el-tag
                  v-if="req.method"
                  size="small"
                  effect="plain"
                >
                  {{ req.method }}
                </el-tag>
                <code class="request-path">{{ req.path || req.uri || '/' }}</code>
              </template>
            </div>

            <div class="request-card-body">
              <template v-if="isHttp">
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
              </template>
              <template v-else>
                <div
                  v-if="req.body != null"
                  class="request-row block"
                >
                  <label>发送内容</label>
                  <pre>{{ req.body }}</pre>
                </div>
                <div
                  v-if="req.timeout != null"
                  class="request-row"
                >
                  <label>超时</label>
                  <span>{{ req.timeout }} ms</span>
                </div>
              </template>
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
          命中脚本
        </div>
        <pre class="script-block">{{ detail.rule?.script || '—' }}</pre>
      </div>
    </div>

    <div
      v-else
      class="detail-empty"
    >
      <EmptyState
        workbench
        title="选择一个指纹"
        description="左侧列表支持搜索和协议筛选，右侧展示元信息、请求列表和命中脚本。"
        :icon="iconMap.fingerprint"
      />
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { icons } from '@/utils/icons.js'

const emit = defineEmits(['edit', 'export', 'delete'])

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
const isHttp = computed(() => (props.detail?.protocol || '').toLowerCase() === 'http')
const requestList = computed(() =>
  Array.isArray(props.detail?.rule?.requests) ? props.detail.rule.requests : []
)

function handleActionCommand(command) {
  if (command === 'delete') {
    emit('delete')
  }
}

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 }
const vulnerabilityList = computed(() => {
  const list = props.detail?.info?.vulnerabilities
  if (!Array.isArray(list)) return []
  return [...list].sort((a, b) => {
    const aw = SEVERITY_ORDER[(a?.severity || '').toLowerCase()] ?? 99
    const bw = SEVERITY_ORDER[(b?.severity || '').toLowerCase()] ?? 99
    return aw - bw
  })
})

function severityTagType(severity) {
  const s = (severity || '').toLowerCase()
  if (s === 'critical') return 'danger'
  if (s === 'high') return 'warning'
  if (s === 'medium') return 'primary'
  if (s === 'low') return 'info'
  return 'info'
}

function severityLabel(severity) {
  const s = (severity || '').toLowerCase()
  if (s === 'critical') return '严重'
  if (s === 'high') return '高危'
  if (s === 'medium') return '中危'
  if (s === 'low') return '低危'
  return '未分级'
}

function isSafeUrl(url) {
  return /^https?:\/\//i.test(String(url || '').trim())
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

:deep(.detail-protocol-tag.el-tag--info) {
  background: color-mix(in srgb, var(--el-color-info-light-8) 80%, white);
  border-color: color-mix(in srgb, var(--el-color-info) 34%, transparent);
  color: var(--el-color-info-dark-2);
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

.risk-pill {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: var(--radius-tag);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 40%, transparent);
  background: var(--detail-surface-muted);
  font-weight: 700;
}

.risk-pill.has-vulns {
  color: var(--el-color-danger);
  border-color: color-mix(in srgb, var(--el-color-danger) 30%, transparent);
  background: color-mix(in srgb, var(--el-color-danger) 8%, var(--detail-surface-muted));
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

.summary-chip.has-vulns {
  border-color: color-mix(in srgb, var(--el-color-danger) 36%, transparent);
  background: color-mix(in srgb, var(--el-color-danger-light-9) 75%, var(--detail-surface-raised));
}

.summary-chip.has-vulns strong {
  color: var(--el-color-danger);
}

.vulnerability-panel .panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.vulnerability-panel,
.request-panel,
.script-panel {
  margin-left: 18px;
  margin-right: 18px;
}

.script-panel {
  margin-bottom: 18px;
}

.vuln-count-tag {
  margin-left: 4px;
}

.vulnerability-list {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.vulnerability-card {
  padding: 12px 14px;
  border-radius: var(--radius-control);
  background: var(--detail-surface-muted);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  border-left-width: 3px;
}

.vulnerability-card.severity-critical {
  border-left-color: var(--el-color-danger);
}

.vulnerability-card.severity-high {
  border-left-color: var(--el-color-warning);
}

.vulnerability-card.severity-medium {
  border-left-color: var(--el-color-primary);
}

.vulnerability-card.severity-low {
  border-left-color: var(--el-color-info);
}

.vulnerability-card.severity-unknown {
  border-left-color: color-mix(in srgb, var(--el-border-color) 60%, transparent);
}

.vuln-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.vuln-title {
  margin: 0;
  font-size: 14px;
  line-height: 1.4;
  font-weight: 600;
  flex: 1 1 auto;
  min-width: 0;
  word-break: break-word;
}

.vuln-severity-tag {
  flex-shrink: 0;
}

.vuln-description {
  margin: 0 0 8px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-regular);
  word-break: break-word;
}

.vuln-description:last-child {
  margin-bottom: 0;
}

.vuln-references {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 6px;
  border-top: 1px dashed color-mix(in srgb, var(--el-border-color) 40%, transparent);
}

.vuln-references a {
  font-size: 12px;
  font-family: var(--el-font-family-mono);
  color: var(--el-color-primary);
  text-decoration: none;
  word-break: break-all;
}

.vuln-references a:hover {
  text-decoration: underline;
}

.vuln-reference-invalid {
  font-size: 12px;
  font-family: var(--el-font-family-mono);
  color: var(--el-text-color-secondary);
  text-decoration: line-through;
  word-break: break-all;
  cursor: not-allowed;
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
