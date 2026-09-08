<template>
  <el-drawer
    :model-value="modelValue"
    title="证据详情"
    size="50%"
    direction="rtl"
    @close="handleClose"
  >
    <div v-if="endpoint" class="evidence-drawer">
      <!-- 基本信息 -->
      <el-card shadow="never" class="info-card">
        <template #header>
          <div class="card-header">
            <el-icon><InfoFilled /></el-icon>
            <span>基本信息</span>
          </div>
        </template>

        <el-descriptions :column="2" border>
          <el-descriptions-item label="目标">
            <span class="mono">{{ endpoint.host }}:{{ endpoint.port }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getStateTagType(endpoint.state)">
              {{ getStateLabel(endpoint.state) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="服务">
            <span v-if="endpoint.service">{{ endpoint.service }}</span>
            <span v-else class="empty">未识别</span>
          </el-descriptions-item>
          <el-descriptions-item label="协议">
            <span v-if="endpoint.protocol">{{ endpoint.protocol }}</span>
            <span v-else class="empty">-</span>
          </el-descriptions-item>
          <el-descriptions-item label="响应时间">
            <span v-if="endpoint.responseTime" class="response-time">
              {{ endpoint.responseTime }}ms
            </span>
            <span v-else class="empty">-</span>
          </el-descriptions-item>
          <el-descriptions-item label="发现时间">
            {{ formatTime(endpoint.discoveredAt) }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- 服务指纹 -->
      <el-card v-if="endpoint.fingerprint" shadow="never" class="info-card">
        <template #header>
          <div class="card-header">
            <el-icon><Key /></el-icon>
            <span>服务指纹</span>
            <el-tag
              v-if="endpoint.fingerprint.confidence"
              size="small"
              :type="getConfidenceType(endpoint.fingerprint.confidence)"
            >
              置信度 {{ confidencePercent(endpoint.fingerprint.confidence).toFixed(0) }}%
            </el-tag>
          </div>
        </template>

        <el-descriptions :column="1" border>
          <el-descriptions-item v-if="endpoint.fingerprint.product" label="产品">
            {{ endpoint.fingerprint.product }}
          </el-descriptions-item>
          <el-descriptions-item v-if="endpoint.fingerprint.version" label="版本">
            {{ endpoint.fingerprint.version }}
          </el-descriptions-item>
          <el-descriptions-item v-if="endpoint.fingerprint.vendor" label="厂商">
            {{ endpoint.fingerprint.vendor }}
          </el-descriptions-item>
          <el-descriptions-item v-if="endpoint.fingerprint.os" label="操作系统">
            {{ endpoint.fingerprint.os }}
          </el-descriptions-item>
          <el-descriptions-item v-if="endpoint.fingerprint.raw" label="原始信息">
            <div class="raw-fingerprint">
              <pre>{{ endpoint.fingerprint.raw }}</pre>
            </div>
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- HTTP信息 -->
      <el-card v-if="httpEvidence" shadow="never" class="info-card">
        <template #header>
          <div class="card-header">
            <el-icon><Link /></el-icon>
            <span>HTTP信息</span>
          </div>
        </template>

        <el-descriptions :column="1" border>
          <el-descriptions-item v-if="httpEvidence.url" label="URL">
            <a :href="httpEvidence.url" target="_blank" class="external-link">
              {{ httpEvidence.url }}
              <el-icon><TopRight /></el-icon>
            </a>
          </el-descriptions-item>
          <el-descriptions-item v-if="httpEvidence.statusCode" label="状态码">
            <el-tag :type="getStatusCodeType(httpEvidence.statusCode)">
              {{ httpEvidence.statusCode }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item v-if="httpEvidence.title" label="标题">
            {{ httpEvidence.title }}
          </el-descriptions-item>
          <el-descriptions-item v-if="httpEvidence.server" label="Server">
            <code>{{ httpEvidence.server }}</code>
          </el-descriptions-item>
          <el-descriptions-item v-if="httpEvidence.contentType" label="Content-Type">
            <code>{{ httpEvidence.contentType }}</code>
          </el-descriptions-item>
          <el-descriptions-item v-if="httpEvidence.contentLength" label="Content-Length">
            {{ formatBytes(httpEvidence.contentLength) }}
          </el-descriptions-item>
        </el-descriptions>

        <!-- HTTP响应头 -->
        <el-collapse v-if="httpEvidence.headers" class="evidence-collapse">
          <el-collapse-item title="响应头" name="headers">
            <div class="headers-list">
              <div
                v-for="(value, key) in httpEvidence.headers"
                :key="key"
                class="header-item"
              >
                <span class="header-key">{{ key }}:</span>
                <span class="header-value">{{ value }}</span>
              </div>
            </div>
          </el-collapse-item>
        </el-collapse>

        <!-- HTTP响应体预览 -->
        <el-collapse v-if="httpEvidence.bodyPreview" class="evidence-collapse">
          <el-collapse-item title="响应体预览" name="body">
            <div class="body-preview">
              <pre>{{ httpEvidence.bodyPreview }}</pre>
            </div>
          </el-collapse-item>
        </el-collapse>
      </el-card>

      <!-- TLS证书 -->
      <el-card v-if="tlsEvidence" shadow="never" class="info-card">
        <template #header>
          <div class="card-header">
            <el-icon><Lock /></el-icon>
            <span>TLS证书</span>
          </div>
        </template>

        <el-descriptions :column="1" border>
          <el-descriptions-item v-if="tlsEvidence.subject" label="主题">
            {{ tlsEvidence.subject }}
          </el-descriptions-item>
          <el-descriptions-item v-if="tlsEvidence.issuer" label="颁发者">
            {{ tlsEvidence.issuer }}
          </el-descriptions-item>
          <el-descriptions-item v-if="tlsEvidence.notBefore" label="生效时间">
            {{ formatTime(tlsEvidence.notBefore) }}
          </el-descriptions-item>
          <el-descriptions-item v-if="tlsEvidence.notAfter" label="过期时间">
            <span :class="{ 'expired': isExpired(tlsEvidence.notAfter) }">
              {{ formatTime(tlsEvidence.notAfter) }}
            </span>
          </el-descriptions-item>
          <el-descriptions-item v-if="tlsEvidence.protocol" label="协议版本">
            {{ tlsEvidence.protocol }}
          </el-descriptions-item>
          <el-descriptions-item v-if="tlsEvidence.cipher" label="加密套件">
            <code>{{ tlsEvidence.cipher }}</code>
          </el-descriptions-item>
        </el-descriptions>

        <!-- 证书详情 -->
        <el-collapse v-if="tlsEvidence.certChain" class="evidence-collapse">
          <el-collapse-item title="证书链" name="certChain">
            <div class="cert-chain">
              <div
                v-for="(cert, idx) in tlsEvidence.certChain"
                :key="idx"
                class="cert-item"
              >
                <div class="cert-index">证书 {{ idx + 1 }}</div>
                <pre>{{ cert }}</pre>
              </div>
            </div>
          </el-collapse-item>
        </el-collapse>
      </el-card>

      <!-- Banner信息 -->
      <el-card v-if="bannerEvidence" shadow="never" class="info-card">
        <template #header>
          <div class="card-header">
            <el-icon><Document /></el-icon>
            <span>Banner信息</span>
          </div>
        </template>

        <div class="banner-content">
          <pre>{{ bannerEvidence }}</pre>
        </div>
      </el-card>

      <!-- 原始证据 -->
      <el-card v-if="loading" shadow="never" class="info-card">
        <el-skeleton :rows="5" animated />
      </el-card>

      <!-- 操作按钮 -->
      <div class="drawer-footer">
        <el-button @click="handleCopyAll">
          <el-icon><CopyDocument /></el-icon>
          复制全部
        </el-button>
        <el-button @click="handleExport">
          <el-icon><Download /></el-icon>
          导出证据
        </el-button>
        <el-button type="primary" @click="handleRescan">
          <el-icon><Refresh /></el-icon>
          重新扫描
        </el-button>
      </div>
    </div>

    <el-empty v-else description="无数据" />
  </el-drawer>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import {
  InfoFilled, Key, Link, Lock, Document,
  TopRight, CopyDocument, Download, Refresh
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { queryNetworkProbeWorkflowEvidenceApi } from '@/services/api.js'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  endpoint: {
    type: Object,
    default: null
  },
  taskId: {
    type: String,
    required: true
  },
  sessionId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['update:modelValue'])

// 状态
const loading = ref(false)
const evidenceData = ref(null)

// 计算属性
const rawEvidence = computed(() => {
  const value = evidenceData.value || props.endpoint?.evidence
  return value && typeof value === 'object' ? value : {}
})

const httpEvidence = computed(() => {
  const nested = evidenceData.value?.http || props.endpoint?.httpInfo
  if (nested && typeof nested === 'object') return nested

  const endpoint = props.endpoint || {}
  const source = rawEvidence.value
  const hasHttpEvidence = [
    'url', 'statusCode', 'title', 'server', 'contentType', 'contentLength',
    'body', 'bodyPreview', 'responseHeaders', 'headers'
  ].some(key => source[key] != null || endpoint[key] != null)
  if (!hasHttpEvidence) return null

  const headers = source.responseHeaders && typeof source.responseHeaders === 'object'
    ? source.responseHeaders
    : source.headers && typeof source.headers === 'object'
      ? source.headers
      : null
  return {
    url: source.url || endpoint.url,
    statusCode: source.statusCode ?? endpoint.statusCode,
    title: source.title || endpoint.title,
    server: source.server || endpoint.server,
    contentType: source.contentType || endpoint.contentType,
    contentLength: source.contentLength ?? source.bodyLength ?? endpoint.contentLength,
    bodyPreview: source.bodyPreview ?? source.body ?? endpoint.bodyPreview,
    headers
  }
})

const tlsEvidence = computed(() => {
  const nested = evidenceData.value?.tls || props.endpoint?.tlsInfo
  if (nested && typeof nested === 'object') return nested

  const source = rawEvidence.value
  const hasTlsEvidence = [
    'subject', 'issuer', 'notBefore', 'notAfter', 'protocol', 'cipherSuite', 'cipher', 'certChain'
  ].some(key => source[key] != null)
  if (!hasTlsEvidence) return null
  return {
    subject: source.subject,
    issuer: source.issuer,
    notBefore: source.notBefore,
    notAfter: source.notAfter,
    protocol: source.protocol,
    cipher: source.cipher || source.cipherSuite,
    certChain: source.certChain
  }
})

const bannerEvidence = computed(() => {
  return evidenceData.value?.banner || rawEvidence.value.banner || props.endpoint?.banner || null
})

// 监听
watch(() => [props.endpoint, props.modelValue], ([newEndpoint, isOpen]) => {
  if (newEndpoint && isOpen) loadEvidence()
}, { immediate: true })

// 方法
async function loadEvidence() {
  evidenceData.value = null
  if (!props.endpoint?.endpointId && !props.endpoint?.id) return
  loading.value = true
  try {
    const response = await queryNetworkProbeWorkflowEvidenceApi({
      sessionId: props.sessionId,
      taskId: props.taskId,
      endpointId: props.endpoint.endpointId || props.endpoint.id
    })
    const payload = response?.data || {}
    const records = Array.isArray(payload.evidence) ? payload.evidence : []
    const merged = records.reduce((result, record) => {
      const content = record?.content
      if (content && typeof content === 'object' && !Array.isArray(content)) {
        Object.assign(result, content)
      }
      return result
    }, {})
    evidenceData.value = {
      ...merged,
      records,
      endpointId: payload.endpointId || props.endpoint?.endpointId || props.endpoint?.id
    }
  } catch (error) {
    ElMessage.error('加载证据失败: ' + (error.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

function handleClose() {
  emit('update:modelValue', false)
}

function handleCopyAll() {
  const text = JSON.stringify(
    {
      endpoint: props.endpoint,
      evidence: evidenceData.value
    },
    null,
    2
  )

  navigator.clipboard.writeText(text).then(() => {
    ElMessage.success('已复制到剪贴板')
  })
}

function handleExport() {
  const payload = JSON.stringify({
    endpoint: props.endpoint,
    evidence: evidenceData.value
  }, null, 2)
  const blob = new Blob([payload], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `network-evidence-${props.endpoint?.host || 'endpoint'}-${props.endpoint?.port || ''}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
  ElMessage.success('证据已导出')
}

function handleRescan() {
  ElMessage.info('请在新建扫描中添加该目标')
}

function getStateLabel(state) {
  const normalized = String(state || '').toUpperCase()
  const labels = {
    'OPEN': '开放',
    'CLOSED': '关闭',
    'FILTERED': '过滤',
    'UNKNOWN': '未知'
  }
  return labels[normalized] || state || '未知'
}

function getStateTagType(state) {
  const normalized = String(state || '').toUpperCase()
  const types = {
    'OPEN': 'success',
    'CLOSED': 'info',
    'FILTERED': 'warning',
    'UNKNOWN': 'info'
  }
  return types[normalized] || 'info'
}

function getConfidenceType(confidence) {
  const percent = confidencePercent(confidence)
  if (percent >= 90) return 'success'
  if (percent >= 70) return 'warning'
  return 'info'
}

function confidencePercent(confidence) {
  const value = Number(confidence)
  if (!Number.isFinite(value)) return 0
  return value >= 0 && value <= 1 ? value * 100 : value
}

function getStatusCodeType(code) {
  if (code >= 200 && code < 300) return 'success'
  if (code >= 300 && code < 400) return 'warning'
  if (code >= 400) return 'danger'
  return 'info'
}

function formatTime(timestamp) {
  if (!timestamp) return '-'
  return new Date(timestamp).toLocaleString('zh-CN')
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}

function isExpired(timestamp) {
  return new Date(timestamp) < new Date()
}
</script>

<style scoped lang="scss">
.evidence-drawer {
  padding: 0 20px 20px;

  .info-card {
    margin-bottom: 20px;

    &:last-of-type {
      margin-bottom: 0;
    }

    .card-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
    }
  }

  .mono {
    font-family: monospace;
    font-weight: 600;
  }

  .empty {
    color: #c0c4cc;
  }

  .response-time {
    font-family: monospace;
    color: #67c23a;
  }

  .raw-fingerprint {
    pre {
      margin: 0;
      padding: 12px;
      background: #f5f7fa;
      border-radius: 4px;
      font-size: 12px;
      line-height: 1.6;
      overflow-x: auto;
    }
  }

  .external-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: #409eff;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  .evidence-collapse {
    margin-top: 16px;

    .headers-list {
      .header-item {
        padding: 8px 0;
        border-bottom: 1px solid #e4e7ed;
        font-size: 13px;

        &:last-child {
          border-bottom: none;
        }

        .header-key {
          font-weight: 600;
          color: #606266;
          margin-right: 8px;
        }

        .header-value {
          color: #909399;
          word-break: break-all;
        }
      }
    }

    .body-preview {
      pre {
        margin: 0;
        padding: 12px;
        background: #f5f7fa;
        border-radius: 4px;
        font-size: 12px;
        line-height: 1.6;
        overflow-x: auto;
        max-height: 300px;
      }
    }

    .cert-chain {
      .cert-item {
        margin-bottom: 16px;

        &:last-child {
          margin-bottom: 0;
        }

        .cert-index {
          font-weight: 600;
          margin-bottom: 8px;
          color: #606266;
        }

        pre {
          margin: 0;
          padding: 12px;
          background: #f5f7fa;
          border-radius: 4px;
          font-size: 11px;
          line-height: 1.4;
          overflow-x: auto;
        }
      }
    }
  }

  .banner-content {
    pre {
      margin: 0;
      padding: 12px;
      background: #f5f7fa;
      border-radius: 4px;
      font-size: 12px;
      line-height: 1.6;
      overflow-x: auto;
    }
  }

  .expired {
    color: #f56c6c;
    font-weight: 600;
  }

  .drawer-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid #e4e7ed;
  }
}
</style>
