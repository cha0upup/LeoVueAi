<template>
  <div class="resource-browser">
    <!-- 顶栏：模式 + 输入 + 提交 -->
    <div class="rb-toolbar">
      <div class="toolbar-left">
        <el-radio-group
          v-model="mode"
          size="default"
          :disabled="loading"
        >
          <el-radio-button value="class">
            类名
          </el-radio-button>
          <el-radio-button value="path">
            资源路径
          </el-radio-button>
        </el-radio-group>

        <el-input
          v-if="mode === 'class'"
          v-model="className"
          class="rb-input"
          size="default"
          placeholder="完整类名，例如 com.example.Foo（会自动转为 com/example/Foo.class）"
          clearable
          spellcheck="false"
          :disabled="loading"
          @keydown.enter="onFetch"
        >
          <template #prefix>
            <el-icon><Icon :icon="iconMap.coffeeCup" /></el-icon>
          </template>
        </el-input>
        <el-input
          v-else
          v-model="resourcePath"
          class="rb-input"
          size="default"
          placeholder="相对 classpath 的路径，例如 application.yml、META-INF/MANIFEST.MF"
          clearable
          spellcheck="false"
          :disabled="loading"
          @keydown.enter="onFetch"
        >
          <template #prefix>
            <el-icon><Icon :icon="iconMap.codeFile" /></el-icon>
          </template>
        </el-input>

        <el-button
          type="primary"
          :loading="loading"
          :disabled="!canFetch"
          @click="onFetch"
        >
          <el-icon v-if="!loading">
            <Icon :icon="iconMap.search" />
          </el-icon>
          获取
        </el-button>
      </div>

      <div class="toolbar-actions">
        <el-button
          :disabled="!result"
          size="default"
          @click="onCopy"
        >
          <el-icon><Icon :icon="iconMap.copy" /></el-icon>
          复制
        </el-button>
        <el-button
          :disabled="!result"
          size="default"
          @click="onDownload"
        >
          <el-icon><Icon :icon="iconMap.download" /></el-icon>
          下载
        </el-button>
        <el-button
          :disabled="!result"
          size="default"
          @click="onClear"
        >
          <el-icon><Icon :icon="iconMap.delete" /></el-icon>
          清空
        </el-button>
      </div>
    </div>

    <!-- 历史快捷入口 -->
    <div
      v-if="history.length"
      class="rb-history"
    >
      <span class="hint">最近：</span>
      <el-tag
        v-for="item in history"
        :key="item.key"
        size="small"
        type="info"
        effect="plain"
        class="history-tag"
        @click="loadHistory(item)"
      >
        {{ item.label }}
      </el-tag>
    </div>

    <!-- 结果区 -->
    <div class="rb-body">
      <el-result
        v-if="!result && !loading && !error"
        icon="info"
        title="尚未获取资源"
        :sub-title="emptyHint"
      />
      <el-result
        v-else-if="error"
        icon="error"
        :title="error.title"
        :sub-title="error.detail"
      >
        <template #extra>
          <el-button
            type="primary"
            @click="onFetch"
          >
            重试
          </el-button>
        </template>
      </el-result>

      <div
        v-else-if="result"
        class="result-shell"
      >
        <el-descriptions
          :column="3"
          border
          size="small"
          class="result-meta"
        >
          <el-descriptions-item label="路径">
            <span class="mono">{{ result.resourcePath }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="大小">
            {{ formatBytes(result.size) }}
          </el-descriptions-item>
          <el-descriptions-item label="类型">
            <el-tag
              :type="previewTagType"
              size="small"
            >
              {{ previewTagLabel }}
            </el-tag>
            <el-tag
              v-if="result.textTruncated"
              type="warning"
              size="small"
              style="margin-left: 6px"
            >
              已截断
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>

        <div
          v-if="result.decompileError"
          class="decompile-warn"
        >
          <el-icon><Icon :icon="iconMap.codeView" /></el-icon>
          反编译失败，已退化为十六进制预览：{{ result.decompileError }}
        </div>

        <div class="preview-pane">
          <template v-if="result.preview === 'java' && result.javaCode">
            <CodePreview
              :model-value="result.javaCode"
              language="java"
            />
          </template>
          <template v-else-if="result.preview === 'text' && result.text">
            <CodePreview
              :model-value="result.text"
              :language="textLanguage"
            />
          </template>
          <template v-else>
            <el-input
              :model-value="hexPreview"
              type="textarea"
              :rows="22"
              readonly
              spellcheck="false"
              class="code-input mono"
            />
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

import { icons } from '@/utils/icons.js'
import { fetchResourceApi } from '@/services/api/resource.js'
import { showError, showSuccess, showWarning } from '@/utils/messageUtils.js'
import CodePreview from '@/components/PuppetConsole/Common/CodePreview.vue'

const iconMap = icons

const props = defineProps({
  sessionId: {
    type: String,
    required: true
  }
})

const mode = ref('class')
const className = ref('')
const resourcePath = ref('')
const loading = ref(false)
const result = ref(null)
const error = ref(null)

// 最近查询历史：本地内存即可，不持久化
const HISTORY_MAX = 6
const history = ref([])

const emptyHint = computed(() =>
  mode.value === 'class'
    ? '输入完整类名后获取字节码，自动反编译为 Java 源码'
    : '输入相对 classpath 的资源路径（application.yml、META-INF/MANIFEST.MF 等）'
)

const canFetch = computed(() =>
  mode.value === 'class'
    ? !!className.value.trim()
    : !!resourcePath.value.trim()
)

const previewTagType = computed(() => {
  switch (result.value?.preview) {
    case 'java': return 'success'
    case 'text': return 'primary'
    case 'hex': return 'info'
    default: return 'info'
  }
})
const previewTagLabel = computed(() => {
  switch (result.value?.preview) {
    case 'java': return 'Java 反编译'
    case 'text': return '文本'
    case 'hex': return '二进制（十六进制）'
    default: return '未知'
  }
})

// 文本资源按扩展名推断 monaco 语言，常见配置文件给点高亮
const textLanguage = computed(() => {
  const path = (result.value?.resourcePath || '').toLowerCase()
  const ext = path.split('.').pop()
  switch (ext) {
    case 'json': return 'json'
    case 'xml': return 'xml'
    case 'yml':
    case 'yaml': return 'yaml'
    case 'properties': return 'ini'
    case 'sql': return 'sql'
    case 'sh':
    case 'bash': return 'shell'
    case 'js':
    case 'mjs':
    case 'cjs': return 'javascript'
    case 'ts': return 'typescript'
    case 'html':
    case 'htm': return 'html'
    case 'css': return 'css'
    case 'md': return 'markdown'
    case 'py': return 'python'
    case 'java': return 'java'
    case 'mf': return 'plaintext'  // META-INF/MANIFEST.MF
    default: return 'plaintext'
  }
})

// 仅在二进制时渲染十六进制，最多展示前 4KB 以免 textarea 卡顿
const hexPreview = computed(() => {
  if (!result.value?.base64) return ''
  const raw = atob(result.value.base64)
  const cap = Math.min(raw.length, 4096)
  const out = []
  for (let i = 0; i < cap; i += 16) {
    const slice = raw.slice(i, i + 16)
    const hex = []
    const ascii = []
    for (let j = 0; j < slice.length; j++) {
      const code = slice.charCodeAt(j)
      hex.push(code.toString(16).padStart(2, '0'))
      ascii.push(code >= 0x20 && code < 0x7f ? slice[j] : '.')
    }
    while (hex.length < 16) hex.push('  ')
    const addr = i.toString(16).padStart(8, '0')
    out.push(addr + '  ' + hex.join(' ') + '  ' + ascii.join(''))
  }
  if (raw.length > cap) {
    out.push('… 仅展示前 4KB，完整内容请下载查看')
  }
  return out.join('\n')
})

// ── 操作 ────────────────────────────────────────────────────

const onFetch = async () => {
  if (!canFetch.value) {
    showWarning(mode.value === 'class' ? '请输入类名' : '请输入资源路径')
    return
  }
  loading.value = true
  error.value = null
  result.value = null
  try {
    const payload = {
      sessionId: props.sessionId,
      mode: mode.value
    }
    if (mode.value === 'class') {
      payload.className = className.value.trim()
    } else {
      payload.resourcePath = resourcePath.value.trim()
    }
    const response = await fetchResourceApi(payload)
    result.value = response.data || null
    pushHistory()
  } catch (err) {
    error.value = {
      title: '读取资源失败',
      detail: err?.response?.data?.msg || err?.message || String(err)
    }
  } finally {
    loading.value = false
  }
}

const pushHistory = () => {
  const entry = mode.value === 'class'
    ? { key: `c:${className.value.trim()}`, label: className.value.trim(), mode: 'class', value: className.value.trim() }
    : { key: `p:${resourcePath.value.trim()}`, label: resourcePath.value.trim(), mode: 'path', value: resourcePath.value.trim() }
  const next = [entry, ...history.value.filter((h) => h.key !== entry.key)]
  history.value = next.slice(0, HISTORY_MAX)
}

const loadHistory = (item) => {
  mode.value = item.mode
  if (item.mode === 'class') {
    className.value = item.value
  } else {
    resourcePath.value = item.value
  }
  onFetch()
}

const onCopy = async () => {
  if (!result.value) return
  let toCopy
  if (result.value.preview === 'java' && result.value.javaCode) toCopy = result.value.javaCode
  else if (result.value.preview === 'text' && result.value.text) toCopy = result.value.text
  else toCopy = result.value.base64
  try {
    await navigator.clipboard.writeText(toCopy)
    showSuccess('已复制到剪贴板')
  } catch {
    showError('复制失败')
  }
}

const onDownload = () => {
  if (!result.value?.base64) return
  try {
    const raw = atob(result.value.base64)
    const bytes = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
    const blob = new Blob([bytes], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    // 用资源路径最后一段作为文件名
    const path = result.value.resourcePath || 'resource'
    link.download = path.split('/').pop()
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (err) {
    showError('下载失败：' + (err?.message || err))
  }
}

const onClear = () => {
  result.value = null
  error.value = null
}

const formatBytes = (n) => {
  if (!n) return '0 B'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}
</script>

<style scoped>
.resource-browser {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
  padding: 16px;
  box-sizing: border-box;
}

.rb-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: var(--radius-container);
  background: var(--app-control-background-soft);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  flex-wrap: wrap;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.rb-input {
  flex: 1;
  min-width: 240px;
}

.toolbar-actions {
  display: flex;
  gap: 8px;
}

.rb-history {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 0 4px;
}

.hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.history-tag {
  cursor: pointer;
  user-select: none;
}

.history-tag:hover {
  color: var(--el-color-primary);
}

.history-tag:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--el-color-primary) 36%, transparent);
  outline-offset: 2px;
}

.rb-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.result-shell {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.result-meta {
  flex-shrink: 0;
}

.mono {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
}

.decompile-warn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--radius-tag);
  font-size: 12px;
  color: var(--el-color-warning);
  background: color-mix(in srgb, var(--el-color-warning) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--el-color-warning) 30%, transparent);
}

.preview-pane {
  flex: 1;
  min-height: 360px;
  border: 1px solid var(--el-border-color);
  border-radius: var(--radius-container);
  overflow: hidden;
  background: var(--app-control-background);
}

.code-input :deep(.el-textarea__inner) {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 12.5px;
  line-height: 1.6;
  background: var(--app-control-background);
  border: 1px solid var(--el-border-color);
  border-radius: var(--radius-control);
  padding: 12px;
  resize: vertical;
}

.code-input.mono :deep(.el-textarea__inner) {
  white-space: pre;
}
</style>
