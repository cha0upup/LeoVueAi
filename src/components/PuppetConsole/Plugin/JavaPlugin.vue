<template>
  <div
    v-loading="isLoading"
    class="plugin-library"
  >
    <el-empty
      v-if="!isLoading && plugins.length === 0"
      description="暂无可用插件"
    />
    <div
      v-else
      class="plugin-grid"
    >
      <article
        v-for="item in plugins"
        :key="item.pluginId"
        class="plugin-card"
        :aria-label="item.pluginName || item.pluginId"
      >
        <div class="plugin-heading">
          <span
            class="plugin-icon-shell"
            :style="iconStyleFor(item.pluginType)"
            aria-hidden="true"
          >
            <el-icon>
              <Icon :icon="iconForType(item.pluginType)" />
            </el-icon>
          </span>
          <h3 class="plugin-name">
            {{ item.pluginName || item.pluginId }}
          </h3>
        </div>
        <p class="plugin-description">
          {{ item.pluginDescription || '暂无描述' }}
        </p>
        <div class="plugin-meta">
          <span>{{ typeLabelFor(item.pluginType) }}</span>
          <span>v{{ item.version || '1.0' }}</span>
          <span>作者：{{ item.createUserId || '未知' }}</span>
        </div>
        <div class="plugin-actions">
          <el-button
            v-if="isScript(item.pluginType)"
            size="small"
            @click="emitLoad(item)"
          >
            载入编辑器
          </el-button>
          <el-button
            size="small"
            type="primary"
            @click="openInvokeDialog(item)"
          >
            配置执行
          </el-button>
        </div>
      </article>
    </div>

    <!-- 调用弹窗 -->
    <el-dialog
      v-model="showInvokeDialog"
      :close-on-click-modal="false"
      :title="selectedPlugin.pluginName || '插件调用'"
      :width="dialogWidth"
      class="invoke-dialog"
    >
      <div
        v-if="selectedPlugin.pluginId"
        class="dialog-content"
      >
        <div class="plugin-info-section">
          <div class="info-item">
            <span class="info-label">类型：</span>
            <el-tag
              :type="tagTypeFor(selectedPlugin.pluginType)"
              size="small"
            >
              {{ typeLabelFor(selectedPlugin.pluginType) }}
            </el-tag>
          </div>
          <div class="info-item">
            <span class="info-label">描述：</span>
            <span class="info-value">{{ selectedPlugin.pluginDescription || '暂无描述' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">版本：</span>
            <el-tag
              type="info"
              size="small"
            >
              v{{ selectedPlugin.version || '1.0' }}
            </el-tag>
          </div>
        </div>

        <div class="io-section">
          <el-row :gutter="24">
            <!-- java 类型展示 paramsInput；脚本类型隐藏（不支持参数注入） -->
            <el-col :span="isScript(selectedPlugin.pluginType) ? 24 : 12">
              <el-card
                v-if="!isScript(selectedPlugin.pluginType)"
                class="io-card input-card"
                shadow="never"
              >
                <template #header>
                  <div class="card-header-title">
                    <el-icon class="header-icon input-icon">
                      <Icon :icon="iconMap.edit" />
                    </el-icon>
                    <span>入参 JSON</span>
                  </div>
                </template>
                <el-input
                  v-model="paramsInput"
                  :rows="16"
                  placeholder="{&quot;cmd&quot;:&quot;whoami&quot;}"
                  spellcheck="false"
                  type="textarea"
                  class="code-input"
                />
              </el-card>
              <el-card
                v-else
                class="io-card script-hint-card"
                shadow="never"
              >
                <div class="script-hint">
                  <el-icon class="hint-icon">
                    <Icon :icon="iconMap.codeView" />
                  </el-icon>
                  <div class="hint-body">
                    <div class="hint-title">
                      脚本插件
                    </div>
                    <div class="hint-desc">
                      ExecScriptComponent 当前不支持运行时参数注入；执行将直接运行已保存的脚本内容。
                      若需参数化，可点击「载入编辑器」修改后再执行。
                    </div>
                  </div>
                </div>
              </el-card>
            </el-col>

            <!-- 结果区 -->
            <el-col
              v-if="!isScript(selectedPlugin.pluginType)"
              :span="12"
            >
              <el-card
                class="io-card output-card"
                shadow="never"
              >
                <template #header>
                  <div class="card-header-title">
                    <el-icon class="header-icon output-icon">
                      <Icon :icon="iconMap.document" />
                    </el-icon>
                    <span>调用结果</span>
                    <div class="header-actions">
                      <el-button
                        :disabled="!executionResult"
                        size="small"
                        text
                        @click="copyResult"
                      >
                        <el-icon><Icon :icon="iconMap.copyDocument" /></el-icon>
                        复制
                      </el-button>
                      <el-button
                        :disabled="!executionResult"
                        size="small"
                        text
                        @click="clearResult"
                      >
                        <el-icon><Icon :icon="iconMap.delete" /></el-icon>
                        清空
                      </el-button>
                    </div>
                  </div>
                </template>
                <el-input
                  v-model="executionResult"
                  :rows="16"
                  placeholder="调用结果将在此展示"
                  readonly
                  type="textarea"
                  class="code-input result-input"
                />
              </el-card>
            </el-col>
          </el-row>

          <!-- 脚本类型：执行结果单独占一行 -->
          <el-row
            v-if="isScript(selectedPlugin.pluginType)"
            :gutter="24"
            style="margin-top: 16px"
          >
            <el-col :span="24">
              <el-card
                class="io-card output-card"
                shadow="never"
              >
                <template #header>
                  <div class="card-header-title">
                    <el-icon class="header-icon output-icon">
                      <Icon :icon="iconMap.document" />
                    </el-icon>
                    <span>执行结果</span>
                    <div class="header-actions">
                      <el-button
                        :disabled="!executionResult"
                        size="small"
                        text
                        @click="copyResult"
                      >
                        复制
                      </el-button>
                      <el-button
                        :disabled="!executionResult"
                        size="small"
                        text
                        @click="clearResult"
                      >
                        清空
                      </el-button>
                    </div>
                  </div>
                </template>
                <el-input
                  v-model="executionResult"
                  :rows="14"
                  placeholder="点击「发起调用」查看结果"
                  readonly
                  type="textarea"
                  class="code-input result-input"
                />
              </el-card>
            </el-col>
          </el-row>
        </div>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="showInvokeDialog = false">
            取消
          </el-button>
          <el-button
            :loading="isInvoking"
            type="primary"
            @click="invokePlugin"
          >
            <el-icon v-if="!isInvoking">
              <Icon :icon="iconMap.play" />
            </el-icon>
            发起调用
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { inject, ref, reactive, onMounted } from 'vue'

import { icons } from '@/utils/icons.js'
import { getPluginsApi } from '@/services/api/plugins.js'
import { invokePluginApi } from '@/services/api/puppet-tools.js'
import { useResponsiveDialogWidth } from '@/composables/useResponsiveDialogWidth.js'
import { showError, showSuccess, showWarning } from '@/utils/messageUtils.js'
import { formatExecutionResult } from './scriptEditorModel.js'

const iconMap = icons
const puppetRuntime = inject('puppetRuntime', ref('java'))

// 插件类型常量：保持与后端 PLUGIN_TYPE_JAVA / JavaPluginService.PLUGIN_TYPE_JAVA 一致
const TYPE_JAVA = 'java'
const SCRIPT_TYPES = ['js', 'groovy', 'python', 'php']

const props = defineProps({
  sessionId: { type: String, required: true }
})

const emit = defineEmits(['plugin-count-updated', 'load-script'])

const plugins = ref([])
const selectedPlugin = reactive({
  pluginId: '',
  pluginName: '',
  pluginDescription: '',
  version: '',
  paramsDemo: '',
  bytecode: '',
  createUserId: '',
  createTime: '',
  pluginType: TYPE_JAVA
})
const isLoading = ref(false)
const isInvoking = ref(false)
const showInvokeDialog = ref(false)
const paramsInput = ref('')
const executionResult = ref('')

// 调用弹窗宽度按视口分档（比字节码弹窗略窄，因内部是左右两栏布局而非单列代码）
const { dialogWidth } = useResponsiveDialogWidth({
  breakpoints: [
    { minWidth: 2400, width: '1600px' },
    { minWidth: 1920, width: '1300px' },
    { minWidth: 1440, width: '1100px' },
    { minWidth: 1024, width: '1000px' }
  ]
})

// ── 类型工具 ─────────────────────────────────────────────────

const normalizeType = (type) => String(type ?? '').toLowerCase()
const isScript = (type) => SCRIPT_TYPES.includes(normalizeType(type))

const typeLabelFor = (type) => {
  switch (normalizeType(type)) {
    case 'js': return 'JavaScript'
    case 'groovy': return 'Groovy'
    case 'python': return 'Python'
    case 'php': return 'PHP'
    case TYPE_JAVA: return 'Java'
    default: return type || 'Unknown'
  }
}

const iconForType = (type) => {
  switch (normalizeType(type)) {
    case 'js': return iconMap.codeJson || iconMap.code
    case 'groovy': return iconMap.codeView || iconMap.code
    case 'python': return iconMap.codeFile || iconMap.code
    case 'php': return iconMap.codeFile || iconMap.code
    case TYPE_JAVA: return iconMap.coffeeCup
    default: return iconMap.code
  }
}

const tagTypeFor = (type) => {
  switch (normalizeType(type)) {
    case 'js': return 'warning'
    case 'groovy': return 'success'
    case 'python': return 'primary'
    case 'php': return 'success'
    case TYPE_JAVA: return 'info'
    default: return 'info'
  }
}

const iconStyleFor = (type) => {
  const t = normalizeType(type)
  const palette = {
    java: ['var(--el-color-primary)', 'color-mix(in srgb, var(--el-color-primary) 10%, var(--app-control-background))'],
    js: ['var(--el-color-warning)', 'color-mix(in srgb, var(--el-color-warning) 12%, var(--app-control-background))'],
    groovy: ['var(--el-color-success)', 'color-mix(in srgb, var(--el-color-success) 12%, var(--app-control-background))'],
    python: ['var(--el-color-primary)', 'color-mix(in srgb, var(--el-color-primary) 12%, var(--app-control-background))'],
    php: ['var(--el-color-success)', 'color-mix(in srgb, var(--el-color-success) 12%, var(--app-control-background))']
  }
  const [color, bg] = palette[t] || palette.java
  return { color, background: bg }
}

// ── 数据加载 ─────────────────────────────────────────────────

const getPlugins = async () => {
  isLoading.value = true
  try {
    const response = await getPluginsApi()
    const list = Array.isArray(response.data) ? response.data : []
    plugins.value = list
      .filter((item) => item.runtime === puppetRuntime.value)
      .slice()
      .sort((a, b) => (a.pluginName || a.pluginId).localeCompare(b.pluginName || b.pluginId))
    emit('plugin-count-updated', plugins.value.length)
  } catch (error) {
    showError('获取插件列表失败: ' + error.message)
  } finally {
    isLoading.value = false
  }
}

const openInvokeDialog = (plugin) => {
  Object.assign(selectedPlugin, plugin)
  paramsInput.value = plugin.paramsDemo || ''
  executionResult.value = ''
  showInvokeDialog.value = true
}

const emitLoad = (plugin) => {
  emit('load-script', plugin)
}

const invokePlugin = async () => {
  if (!selectedPlugin.pluginId) {
    showWarning('请先选择一个插件')
    return
  }
  isInvoking.value = true
  // 后端 invokePlugin 按 pluginType 路由：java 走 PluginComponent，脚本走 ExecScriptComponent。
  // 脚本类型不接收 pluginParam，但传上去后端会忽略，这里保持单一调用入口。
  const payload = {
    pluginId: selectedPlugin.pluginId,
    sessionId: props.sessionId,
    pluginParam: isScript(selectedPlugin.pluginType) ? '' : paramsInput.value
  }
  try {
    const response = await invokePluginApi(payload)
    executionResult.value = formatExecutionResult(response.data)
    showSuccess('插件调用成功')
  } catch (error) {
    executionResult.value = '调用失败：' + error.message
    showError('插件调用失败: ' + error.message)
  } finally {
    isInvoking.value = false
  }
}

const clearResult = () => {
  executionResult.value = ''
}

const copyResult = async () => {
  if (!executionResult.value) return
  try {
    await navigator.clipboard.writeText(executionResult.value)
    showSuccess('结果已复制到剪贴板')
  } catch {
    showError('复制失败')
  }
}

onMounted(async () => {
  await getPlugins()
})

defineExpose({
  getPlugins
})
</script>

<style scoped>
.plugin-library {
  min-height: 160px;
}

.plugin-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
  gap: 16px;
  align-items: stretch;
}

.plugin-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  padding: 16px;
  border: 1px solid var(--el-border-color-light);
  border-radius: var(--radius-container);
  background: var(--app-surface-background);
  transition: border-color 0.2s ease;
}

.plugin-card:focus-within {
  border-color: var(--el-color-primary);
}

.plugin-heading {
  display: flex;
  align-items: center;
  gap: 10px;
}

.plugin-icon-shell {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-control);
  flex-shrink: 0;
  font-size: 18px;
}

.plugin-name {
  min-width: 0;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--el-text-color-primary);
  overflow-wrap: anywhere;
}

.plugin-description {
  margin: 0 0 4px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--el-text-color-regular);
  overflow-wrap: anywhere;
}

.plugin-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  margin-top: auto;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.plugin-meta span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.plugin-meta span + span::before {
  content: '·';
  margin-right: 8px;
}

.plugin-actions,
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.plugin-actions .el-button + .el-button {
  margin-left: 0;
}

:deep(.invoke-dialog) {
  .el-dialog__body {
    padding: 20px 24px;
  }
}

.dialog-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.plugin-info-section {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  padding: 16px 20px;
  background: var(--app-control-background-soft);
  border-radius: var(--radius-container);
  border: 1px solid var(--el-border-color);
}

.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-label {
  font-weight: 500;
  color: var(--el-text-color-regular);
  font-size: 14px;
}

.info-value {
  color: var(--el-text-color-primary);
  font-size: 14px;
}

.io-section {
  margin-top: 8px;
}

.io-card {
  height: 100%;
  border-radius: var(--radius-container);
  border: 1px solid var(--el-border-color);
  transition: all 0.3s ease;
}

.io-card:hover {
  box-shadow: none;
}

.input-card {
  border-left: 3px solid color-mix(in srgb, var(--el-color-primary) 72%, transparent);
}

.output-card {
  border-left: 3px solid color-mix(in srgb, var(--el-color-info) 72%, transparent);
}

.script-hint-card {
  border-left: 3px solid color-mix(in srgb, var(--el-color-warning) 72%, transparent);
}

.script-hint {
  display: flex;
  gap: 12px;
  padding: 12px 4px;
}

.hint-icon {
  font-size: 24px;
  color: var(--el-color-warning);
  flex-shrink: 0;
  margin-top: 2px;
}

.hint-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.hint-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.hint-desc {
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.card-header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 15px;
  color: var(--el-text-color-primary);
}

.header-icon {
  font-size: clamp(1rem, 1.125vw, 1.125rem);
}

.input-icon {
  color: var(--el-color-primary);
}

.output-icon {
  color: var(--el-color-info);
}

.header-actions {
  margin-left: auto;
  display: flex;
  gap: 4px;
}

.code-input {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
}

.code-input :deep(.el-textarea__inner) {
  background: var(--app-control-background);
  border: 1px solid var(--el-border-color);
  border-radius: 10px;
  padding: 12px;
  line-height: 1.6;
  resize: none;
}

.code-input :deep(.el-textarea__inner):focus {
  border-color: color-mix(in srgb, var(--el-color-primary) 36%, var(--el-border-color));
  background: var(--el-bg-color);
}

.result-input :deep(.el-textarea__inner) {
  background: var(--app-control-background-soft);
  color: var(--el-text-color-primary);
}

.result-input :deep(.el-textarea__inner):focus {
  border-color: color-mix(in srgb, var(--el-color-info) 36%, var(--el-border-color));
}
</style>
