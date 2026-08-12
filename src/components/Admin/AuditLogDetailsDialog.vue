<template>
  <el-dialog
    v-model="visible"
    title="日志详情"
    width="800px"
    class="log-details-dialog"
  >
    <div
      v-if="log"
      v-loading="loading"
      class="log-details"
    >
      <el-descriptions
        :column="2"
        border
      >
        <el-descriptions-item
          label="日志ID"
          :span="2"
        >
          <span class="log-id-text">{{ log.logId }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="用户ID">
          {{ log.userId || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="用户名">
          {{ log.userName || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="主机ID">
          {{ log.puppetId || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="主机名">
          {{ log.puppetName || '-' }}
        </el-descriptions-item>
        <el-descriptions-item
          label="会话ID"
          :span="2"
        >
          <span class="session-id-text">{{ log.sessionId || '-' }}</span>
        </el-descriptions-item>
        <el-descriptions-item
          label="操作类型"
          :span="2"
        >
          <el-tag :type="getOperationTagType(log.operationType)">
            {{ log.operationName || log.operationType }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item
          label="操作路径"
          :span="2"
        >
          <span class="path-text">{{ log.operationPath || '-' }}</span>
        </el-descriptions-item>
        <el-descriptions-item
          label="状态"
          :span="2"
        >
          <el-tag :type="getStatusTagType(log.status)">
            {{ getStatusLabel(log.status) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="响应码">
          {{ log.responseCode || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="响应消息">
          <span :class="{ 'error-text': log.status !== 'SUCCESS' }">
            {{ log.responseMessage || '-' }}
          </span>
        </el-descriptions-item>
        <el-descriptions-item
          v-if="log.errorMessage"
          label="错误信息"
          :span="2"
        >
          <span class="error-text">{{ log.errorMessage }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="客户端IP">
          {{ log.clientIp || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="操作时间">
          {{ formatDateTime(log.createTime) }}
        </el-descriptions-item>
        <el-descriptions-item
          v-if="log.requestParams"
          label="请求参数"
          :span="2"
        >
          <pre class="params-text">{{ formatAuditJson(log.requestParams) }}</pre>
        </el-descriptions-item>
        <el-descriptions-item
          v-if="log.remark"
          label="备注"
          :span="2"
        >
          {{ log.remark }}
        </el-descriptions-item>
      </el-descriptions>
    </div>
  </el-dialog>
</template>

<script setup>
import { formatDate as formatDateTime } from '@/utils/format.js'
import {
  formatAuditJson,
  getOperationTagType,
  getStatusLabel,
  getStatusTagType
} from './auditManagerModel.js'

const visible = defineModel({ type: Boolean, default: false })

defineProps({
  log: { type: Object, default: null },
  loading: { type: Boolean, default: false }
})
</script>

<style>
.log-details-dialog {
  border-radius: var(--radius-overlay);
  box-shadow: var(--shadow-overlay);
}

.log-details-dialog .el-dialog__header {
  margin: 0;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--app-divider-color);
}

.log-details-dialog .el-dialog__title {
  color: var(--el-text-color-primary);
  font-size: var(--el-font-size-large);
  font-weight: 600;
}

.log-details-dialog .el-dialog__body {
  padding: var(--space-4);
}

.log-details-dialog .log-details {
  max-height: 70vh;
  overflow-y: auto;
}

.log-details-dialog .log-id-text,
.log-details-dialog .session-id-text,
.log-details-dialog .path-text,
.log-details-dialog .params-text {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.log-details-dialog .log-id-text,
.log-details-dialog .session-id-text {
  color: var(--el-text-color-regular);
  font-size: var(--el-font-size-extra-small);
}

.log-details-dialog .path-text {
  color: var(--el-text-color-regular);
  font-size: var(--el-font-size-small);
}

.log-details-dialog .params-text {
  max-height: 200px;
  margin: 0;
  padding: 8px;
  overflow-y: auto;
  border-radius: var(--el-border-radius-small);
  background: var(--el-bg-color-page);
  font-size: var(--el-font-size-extra-small);
  white-space: pre-wrap;
  word-break: break-all;
}

.log-details-dialog .error-text {
  color: var(--el-color-danger);
}

@media (max-width: 840px) {
  .log-details-dialog {
    width: calc(100vw - 32px) !important;
  }
}
</style>
