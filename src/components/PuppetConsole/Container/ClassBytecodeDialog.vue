<template>
  <el-dialog
    v-model="dialogVisible"
    title="类字节码"
    :width="dialogWidth"
    top="4vh"
    destroy-on-close
    class="class-bytecode-dialog"
    @close="handleClose"
  >
    <div
      v-loading="loading"
      class="bytecode-content"
    >
      <!-- 类信息 -->
      <div
        v-if="bytecodeData"
        class="class-info"
      >
        <el-descriptions
          :column="3"
          border
          size="small"
        >
          <el-descriptions-item label="类名">
            <span class="mono-text">{{ bytecodeData.className }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="字节码大小">
            {{ formatByteSize(bytecodeData.bytecodeSize) }}
          </el-descriptions-item>
          <el-descriptions-item label="反编译状态">
            <el-tag
              :type="bytecodeData.javaCode ? 'success' : 'warning'"
              size="small"
            >
              {{ bytecodeData.javaCode ? '已反编译' : '反编译失败' }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <!-- Java源代码（如果反编译成功） -->
      <div
        v-if="bytecodeData && bytecodeData.javaCode"
        class="code-container"
      >
        <div class="code-header">
          <span class="code-title">Java源代码（反编译）</span>
          <div class="code-actions">
            <el-button
              title="下载原始 class 文件"
              aria-label="下载原始 class 文件"
              type="primary"
              size="small"
              circle
              @click="downloadClassFile"
            >
              <el-icon>
                <Icon :icon="iconMap.download" />
              </el-icon>
            </el-button>
            <el-button
              title="复制代码"
              aria-label="复制代码"
              size="small"
              circle
              @click="copyCode"
            >
              <el-icon>
                <Icon :icon="iconMap.copy" />
              </el-icon>
            </el-button>
          </div>
        </div>
        <div
          ref="monacoEditorContainer"
          class="code-editor"
        />
      </div>

      <!-- 反编译失败提示 -->
      <div
        v-else-if="bytecodeData && !bytecodeData.javaCode"
        class="no-code-tip"
      >
        <el-result
          icon="warning"
          title="反编译失败"
          sub-title="无法反编译该类字节码，可能的原因：字节码损坏、反编译工具异常等"
        >
          <template #extra>
            <el-alert
              type="info"
              show-icon
              :closable="false"
              style="margin-top: 16px"
            >
              <template #default>
                <div>
                  <p>字节码已成功获取，但反编译失败。</p>
                  <p>字节码大小: {{ formatByteSize(bytecodeData.bytecodeSize) }}</p>
                  <p>如需查看原始字节码，请联系管理员。</p>
                </div>
              </template>
            </el-alert>
          </template>
        </el-result>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, computed, nextTick, onUnmounted, watch } from 'vue'

import { icons } from '@/utils/icons.js'
import { getClassBytecodeApi } from '@/services/api.js'
import { executeRequest } from '@/utils/apiUtils.js'
import { useMonacoEditorInstance } from '@/composables/useMonacoEditorInstance.js'
import { createMonacoEditorOptions } from '@/composables/useMonacoEditorOptions.js'
import { useMonacoTheme } from '@/composables/useMonacoTheme.js'
import { useResponsiveDialogWidth } from '@/composables/useResponsiveDialogWidth.js'
import { showError, showSuccess, showWarning } from '@/utils/messageUtils.js'

const iconMap = icons

// Props
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  sessionId: {
    type: String,
    required: true
  },
  className: {
    type: String,
    required: true
  }
})

// Emits
const emit = defineEmits(['update:modelValue', 'close'])

// 响应式数据
const dialogVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const loading = ref(false)
const bytecodeData = ref(null)
const monacoEditor = ref(null)
const monacoEditorContainer = ref(null)

// 响应式 dialog 宽度：复用 composable，宽屏不漂浮、移动端 92vw
const { dialogWidth } = useResponsiveDialogWidth()

const { monacoTheme, watchMonacoTheme } = useMonacoTheme()
const { disposeEditorInstance, recreateEditorInstance } = useMonacoEditorInstance()

// 方法
/**
 * 格式化字节大小
 */
const formatByteSize = (bytes) => {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/**
 * 初始化Monaco编辑器
 */
const initMonacoEditor = async () => {
  if (!monacoEditorContainer.value || !bytecodeData.value?.javaCode) return

  await nextTick()

  try {
    recreateEditorInstance(
      monacoEditor,
      monacoEditorContainer,
      createMonacoEditorOptions({
        value: bytecodeData.value.javaCode,
        language: 'java',
        theme: monacoTheme.value,
        readOnly: true,
        fontSize: 14,
        minimapEnabled: false,
        wordWrap: 'on',
        lineNumbers: 'on',
        folding: true,
        renderWhitespace: 'selection'
      }),
      {
        disposeModel: true
      }
    )
  } catch {
    showError('代码编辑器初始化失败')
  }
}

/**
 * 复制代码
 */
const copyCode = async () => {
  if (!bytecodeData.value?.javaCode) {
    showWarning('没有可复制的代码')
    return
  }

  try {
    await navigator.clipboard.writeText(bytecodeData.value.javaCode)
    showSuccess('代码已复制到剪贴板')
  } catch {
    showError('复制失败，请手动选择复制')
  }
}

/**
 * 下载原始class文件
 */
const downloadClassFile = () => {
  if (!bytecodeData.value?.bytecode) {
    showError('字节码数据不存在')
    return
  }

  try {
    // bytecode是Base64编码的字符串，需要解码为二进制数据
    const base64String = bytecodeData.value.bytecode
    // 解码Base64字符串
    const binaryString = atob(base64String)
    // 转换为字节数组
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    // 创建Blob对象
    const blob = new Blob([bytes], { type: 'application/java-vm' })

    // 生成文件名（使用类名）
    const className = bytecodeData.value.className || 'UnknownClass'
    const fileName = className.split('.').pop() + '.class'

    // 创建下载链接
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    showSuccess('class文件下载成功')
  } catch (error) {
    showError('下载class文件失败：' + (error.message || '未知错误'))
  }
}

/**
 * 获取类字节码
 */
const fetchBytecode = async () => {
  if (!props.sessionId || !props.className) {
    showError('会话ID或类名不能为空')
    return
  }

  loading.value = true
  bytecodeData.value = null

  // 销毁现有编辑器
  disposeEditorInstance(monacoEditor, { disposeModel: true })

  await executeRequest(
    async () => {
      const response = await getClassBytecodeApi({
        sessionId: props.sessionId,
        className: props.className
      })

      // http拦截器已经处理了响应格式，response.data 就是实际数据
      if (response.data) {
        bytecodeData.value = response.data

        // 如果有Java代码，初始化编辑器
        if (bytecodeData.value.javaCode) {
          await nextTick()
          await initMonacoEditor()
        }
      } else {
        showError('获取类字节码失败：响应数据为空')
      }

      return response
    },
    {
      loadingRef: null,
      successMessage: null,
      errorMessage: '获取类字节码失败'
    }
  )

  loading.value = false
}

/**
 * 清理资源
 */
const cleanup = () => {
  // 销毁编辑器
  disposeEditorInstance(monacoEditor, { disposeModel: true })
  bytecodeData.value = null
}

/**
 * 关闭对话框
 */
const handleClose = () => {
  cleanup()
  emit('close')
}

// 监听对话框显示状态
watch(dialogVisible, (visible) => {
  if (visible) {
    fetchBytecode()
  } else {
    cleanup()
  }
})

const stopMonacoThemeWatch = watchMonacoTheme(() => monacoEditor.value)

// 生命周期
onUnmounted(() => {
  stopMonacoThemeWatch()
  disposeEditorInstance(monacoEditor, { disposeModel: true })
})
</script>

<style scoped>
.class-bytecode-dialog {
  --el-dialog-padding-primary: 10px;
}

.class-bytecode-dialog :deep(.el-dialog) {
  --el-dialog-border-radius: 8px;
}

.class-bytecode-dialog :deep(.el-dialog__header) {
  padding: 12px 14px 8px;
  margin-right: 0;
  flex-shrink: 0;
}

.class-bytecode-dialog :deep(.el-dialog__body) {
  padding: 4px 14px 14px;
}

.class-bytecode-dialog :deep(.el-dialog__headerbtn) {
  top: 8px;
  right: 10px;
  width: 28px;
  height: 28px;
}

.bytecode-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.class-info {
  flex-shrink: 0;
}

.mono-text {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
}

.code-container {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--el-border-color);
  border-radius: var(--el-border-radius-base);
  overflow: hidden;
}

.code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 38px;
  padding: 6px 10px;
  background: var(--el-bg-color-page);
  border-bottom: 1px solid var(--el-border-color);
  flex-shrink: 0;
}

.code-title {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.code-actions {
  display: flex;
  gap: 6px;
}

.code-editor {
  height: 500px;
}

.no-code-tip {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 320px;
}
</style>
