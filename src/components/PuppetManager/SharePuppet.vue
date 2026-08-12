<template>
  <el-dialog
    v-model="sharePuppetDialog"
    width="900px"
    top="4vh"
    draggable
    class="puppet-dialog share-puppet-dialog"
    @close="close"
  >
    <template #header>
      <div class="dialog-intro dialog-header-intro">
        <div class="intro-main">
          <div class="intro-title-row">
            <el-icon class="intro-icon">
              <Icon :icon="iconMap.share" />
            </el-icon>
            <div>
              <h3>分享主机配置</h3>
              <p>自动携带祖先依赖，可按需选择子孙主机</p>
            </div>
          </div>
        </div>
      </div>
    </template>

    <el-form
      v-loading="loading"
      :model="puppet"
      label-width="120px"
      label-position="left"
      class="host-form share-content"
    >
      <div class="form-section">
        <div class="section-heading">
          <div>
            <strong>连接信息</strong>
          </div>
        </div>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="主机名称">
              <el-input
                :model-value="puppet.puppetName || '未命名主机'"
                readonly
                :prefix-icon="Monitor"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="连接地址">
              <el-tooltip
                :content="puppet.connLink || '未配置'"
                placement="top"
              >
                <el-input
                  :model-value="puppet.connLink || '未配置'"
                  readonly
                  :prefix-icon="Link"
                />
              </el-tooltip>
            </el-form-item>
          </el-col>
        </el-row>
      </div>

      <div class="form-section dependency-section">
        <div class="section-heading">
          <div>
            <strong>主机依赖链</strong>
            <span>导入时将按以下顺序重新创建并关联</span>
          </div>
          <el-tag
            size="small"
            effect="plain"
          >
            已包含 {{ bundlePuppets.length }} / {{ availablePuppets.length }} 台
          </el-tag>
        </div>
        <div
          v-if="descendantPuppets.length"
          class="descendant-toolbar"
        >
          <span>发现 {{ descendantPuppets.length }} 台子孙主机，可按需加入分享包</span>
          <div>
            <el-button
              text
              type="primary"
              :disabled="selectedDescendantIds.size === descendantPuppets.length"
              @click="selectAllDescendants"
            >
              全部携带
            </el-button>
            <el-button
              text
              :disabled="selectedDescendantIds.size === 0"
              @click="clearDescendants"
            >
              清空选择
            </el-button>
          </div>
        </div>
        <div class="dependency-chain">
          <div
            v-for="(item, index) in availablePuppets"
            :key="item.puppetId"
            class="dependency-item"
            :class="{ 'is-optional': getPuppetRole(item) === '可选后代' }"
            :style="{ paddingLeft: `${8 + getPuppetDepth(item) * 18}px` }"
          >
            <el-checkbox
              v-if="isDescendantPuppet(item)"
              :model-value="selectedDescendantIds.has(item.puppetId)"
              :aria-label="`携带子主机 ${item.puppetName || item.puppetId}`"
              @change="toggleDescendant(item, $event)"
            />
            <span
              v-else
              class="dependency-index"
            >{{ index + 1 }}</span>
            <div class="dependency-info">
              <strong>{{ item.puppetName || '未命名主机' }}</strong>
              <code>{{ item.connLink || '未配置连接地址' }}</code>
            </div>
            <el-tag
              size="small"
              :type="getPuppetRole(item) === '目标主机' || getPuppetRole(item) === '已选后代' ? 'primary' : 'info'"
              effect="light"
            >
              {{ getPuppetRole(item) }}
            </el-tag>
          </div>
        </div>
      </div>

      <div class="form-section">
        <div class="section-heading section-heading--spaced">
          <div>
            <strong>配置代码</strong>
          </div>
        </div>
        <el-form-item label="Base64 配置">
          <el-input
            :model-value="output"
            type="textarea"
            readonly
            :autosize="{ minRows: 8, maxRows: 10 }"
            class="share-code-input"
          />
        </el-form-item>
        <p class="form-tip share-form-tip">
          配置包采用 Base64 编码，不包含原数据库 ID、创建人和团队信息。
        </p>
      </div>
    </el-form>

    <template #footer>
      <div class="dialog-footer-actions">
        <el-button
          type="danger"
          class="cancel-btn"
          @click="close"
        >
          <el-icon><Icon :icon="iconMap.close" /></el-icon>
          关闭
        </el-button>
        <el-button
          type="primary"
          plain
          class="cancel-btn"
          :disabled="!output || loading"
          @click="downloadFile"
        >
          <el-icon><Icon :icon="iconMap.download" /></el-icon>
          下载文件
        </el-button>
        <el-button
          type="primary"
          :loading="copying"
          :disabled="!output || loading"
          class="submit-btn"
          @click="copyToClipboard"
        >
          <el-icon><Icon :icon="iconMap.copyDocument" /></el-icon>
          {{ copying ? '复制中...' : '复制配置' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { Link, Monitor } from '@element-plus/icons-vue'
import { computed, ref } from 'vue'

import { exportPuppetsApi } from '@/services/api.js'
import { PUPPET_DEFAULT_MAX_REQUEST_COUNT } from '@/utils/constants.js'
import { icons } from '@/utils/icons.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'
import {
  buildPuppetTransferBundle,
  encodePuppetTransferPayload
} from '@/utils/puppetTransfer.js'

const iconMap = icons

const sharePuppetDialog = ref(false)
const copying = ref(false)
const loading = ref(false)
const availablePuppets = ref([])
const selectedDescendantIds = ref(new Set())
let shareRequestToken = 0

const puppet = ref({
  puppetId: '',
  puppetName: '',
  createByUserId: '',
  connLink: '',
  reqDisguiseId: '',
  respDisguiseId: '',
  headers: '',
  permission: 'private',
  proxyEnabled: 0,
  maxReqCount: PUPPET_DEFAULT_MAX_REQUEST_COUNT,
  proxyType: 'http',
  proxyHost: '127.0.0.1',
  proxyPort: 8080,
  protocol: 'http',
  type: 'java'
})

const puppetById = computed(() =>
  new Map(availablePuppets.value.map((item) => [item.puppetId, item]))
)

const isDescendantPuppet = (item) => {
  let current = item
  const visited = new Set()
  while (current?.parentPuppetId && current.parentPuppetId !== 'root') {
    if (visited.has(current.puppetId)) return false
    visited.add(current.puppetId)
    if (current.parentPuppetId === puppet.value.puppetId) return true
    current = puppetById.value.get(current.parentPuppetId)
  }
  return false
}

const descendantPuppets = computed(() => availablePuppets.value.filter(isDescendantPuppet))
const selectedTargetIds = computed(() => [
  puppet.value.puppetId,
  ...selectedDescendantIds.value
].filter(Boolean))
const transferBundle = computed(() =>
  buildPuppetTransferBundle(availablePuppets.value, selectedTargetIds.value)
)
const bundlePuppetIds = computed(() =>
  new Set(transferBundle.value.puppets.map((item) => item.transferId))
)
const bundlePuppets = computed(() =>
  availablePuppets.value.filter((item) => bundlePuppetIds.value.has(item.puppetId))
)
const output = computed(() =>
  transferBundle.value.puppets.length ? encodePuppetTransferPayload(transferBundle.value) : ''
)

const getPuppetDepth = (item) => {
  let depth = 0
  let current = item
  const visited = new Set()
  while (current?.parentPuppetId && current.parentPuppetId !== 'root') {
    if (visited.has(current.puppetId)) break
    visited.add(current.puppetId)
    current = puppetById.value.get(current.parentPuppetId)
    if (current) depth += 1
  }
  return depth
}

const getPuppetRole = (item) => {
  if (item.puppetId === puppet.value.puppetId) return '目标主机'
  if (!isDescendantPuppet(item)) return '祖先依赖'
  if (selectedDescendantIds.value.has(item.puppetId)) return '已选后代'
  if (bundlePuppetIds.value.has(item.puppetId)) return '自动依赖'
  return '可选后代'
}

const toggleDescendant = (item, checked) => {
  const next = new Set(selectedDescendantIds.value)
  if (checked) next.add(item.puppetId)
  else next.delete(item.puppetId)
  selectedDescendantIds.value = next
}

const selectAllDescendants = () => {
  selectedDescendantIds.value = new Set(descendantPuppets.value.map((item) => item.puppetId))
}

const clearDescendants = () => {
  selectedDescendantIds.value = new Set()
}

const close = () => {
  shareRequestToken += 1
  sharePuppetDialog.value = false
  loading.value = false
  selectedDescendantIds.value = new Set()
}
const fallbackCopyToClipboard = (text) => {
  try {
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    const successful = document.execCommand('copy')
    document.body.removeChild(textArea)
    if (successful) {
      showSuccess('内容已复制到剪贴板')
    } else {
      showError('复制到剪贴板失败')
    }
  } catch {
    showError('复制到剪贴板失败')
  }
}

const copyToClipboard = async () => {
  copying.value = true
  try {
    const textToCopy = output.value
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(textToCopy)
      showSuccess('内容已复制到剪贴板')
    } else {
      fallbackCopyToClipboard(textToCopy)
    }
  } catch {
    showError('复制到剪贴板失败')
  } finally {
    copying.value = false
  }
}

const downloadFile = () => {
  if (!output.value) return
  const blob = new Blob([output.value], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${puppet.value.puppetName || 'puppet'}_bundle.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  showSuccess('文件下载成功')
}

const openSharePuppet = async (puppetData) => {
  const requestToken = ++shareRequestToken
  sharePuppetDialog.value = true
  puppet.value = { ...puppet.value, ...puppetData }
  availablePuppets.value = []
  selectedDescendantIds.value = new Set()
  loading.value = true
  try {
    const response = await exportPuppetsApi([puppetData.puppetId], { includeDescendants: true })
    if (requestToken !== shareRequestToken) return
    availablePuppets.value = Array.isArray(response.data) ? response.data : []
  } catch (error) {
    if (requestToken === shareRequestToken) {
      showError(error?.message || '准备分享配置失败')
    }
  } finally {
    if (requestToken === shareRequestToken) loading.value = false
  }
}

defineExpose({
  openSharePuppet,
  close
})
</script>

<style scoped>
@import '@/styles/puppet-form-dialog-shared.css';

.share-content {
  padding-right: 0;
}

/* 与新增主机弹窗保持完全相同的标题区留白和扁平样式。 */
:global(.share-puppet-dialog .dialog-header-intro) {
  align-items: center;
  min-height: 42px;
  margin-bottom: 0;
  padding: 0 44px 0 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}

:global(.share-puppet-dialog .dialog-header-intro .intro-title-row) {
  align-items: center;
}

:global(.share-puppet-dialog .dialog-header-intro .intro-icon) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-control);
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 12%, var(--app-control-background));
  border: 1px solid color-mix(in srgb, var(--el-color-primary-light-7) 58%, transparent);
  font-size: 18px;
}

:global(.share-puppet-dialog .dialog-header-intro h3) {
  margin-bottom: 0;
  font-size: 17px;
}

:global(.share-puppet-dialog .dialog-header-intro p) {
  margin: 2px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.dependency-section {
  border-top: 1px solid var(--app-divider-color);
}

.section-heading span {
  margin-left: 8px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
  font-weight: 400;
}

.dependency-chain {
  max-height: 280px;
  overflow: auto;
  display: grid;
  gap: 4px;
}

.descendant-toolbar {
  min-height: 36px;
  padding: 4px 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-top: 1px solid var(--app-divider-color);
  border-bottom: 1px solid var(--app-divider-color);
  background: var(--app-control-background-soft);
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.descendant-toolbar > div {
  display: flex;
  align-items: center;
}

.descendant-toolbar :deep(.el-button) {
  height: 26px;
  padding: 0 6px;
}

.dependency-item {
  min-height: 42px;
  padding: 6px 8px;
  display: flex;
  align-items: center;
  gap: 9px;
  border-bottom: 1px solid var(--app-divider-color);
}

.dependency-item.is-optional {
  color: var(--el-text-color-secondary);
  background: var(--app-control-background-soft);
}

.dependency-index {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: var(--radius-tag);
  background: var(--app-control-background-soft);
  color: var(--el-text-color-secondary);
  font-family: var(--font-family-code);
  font-size: 10px;
}

.dependency-info {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dependency-info strong {
  color: var(--el-text-color-primary);
  font-size: 12px;
}

.dependency-info code {
  overflow: hidden;
  color: var(--el-text-color-secondary);
  font-family: var(--font-family-code);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.share-content :deep(.el-input__inner) {
  color: var(--el-text-color-primary);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.share-code-input :deep(.el-textarea__inner) {
  min-height: 176px !important;
  line-height: 1.6;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
}

.share-form-tip {
  margin: -6px 0 0 120px;
}

@media (max-width: 768px) {
  .share-form-tip {
    margin-left: 0;
  }
}
</style>
