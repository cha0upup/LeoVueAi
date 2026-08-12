<template>
  <div
    class="skill-file-tree"
    :class="{ 'is-drag-over': dragOver }"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent="onDragOver"
    @dragleave="onDragLeave"
    @drop.prevent="onDrop"
  >
    <div class="tree-header">
      <span class="tree-title">
        <el-icon><Icon :icon="iconMap.folderOpened" /></el-icon>
        文件
        <em>{{ files.length }}</em>
      </span>
      <div class="tree-actions">
        <el-tooltip
          v-if="!readOnly"
          content="新建文件"
          placement="top"
        >
          <button
            class="tree-icon-btn"
            type="button"
            aria-label="新建文件"
            @click="openCreateDialog('file')"
          >
            <el-icon><Icon icon="mdi:file-plus-outline" /></el-icon>
          </button>
        </el-tooltip>
        <el-tooltip
          v-if="!readOnly"
          content="新建文件夹"
          placement="top"
        >
          <button
            class="tree-icon-btn"
            type="button"
            aria-label="新建文件夹"
            @click="openCreateDialog('folder')"
          >
            <el-icon><Icon icon="mdi:folder-plus-outline" /></el-icon>
          </button>
        </el-tooltip>
        <el-tooltip
          v-if="!readOnly"
          content="上传文件"
          placement="top"
        >
          <button
            class="tree-icon-btn"
            type="button"
            aria-label="上传文件"
            @click="triggerUpload"
          >
            <el-icon><Icon :icon="iconMap.upload" /></el-icon>
          </button>
        </el-tooltip>
        <el-tooltip
          content="刷新"
          placement="top"
        >
          <button
            class="tree-icon-btn"
            type="button"
            aria-label="刷新文件列表"
            @click="$emit('refresh')"
          >
            <el-icon><Icon :icon="iconMap.refresh" /></el-icon>
          </button>
        </el-tooltip>
      </div>
    </div>

    <input
      ref="fileInput"
      type="file"
      style="display: none"
      multiple
      @change="handleUpload"
    >

    <div
      v-if="loading"
      class="tree-loading"
    >
      <el-skeleton
        :rows="4"
        animated
      />
    </div>
    <el-tree
      v-else-if="treeData.length"
      :data="treeData"
      node-key="path"
      :expand-on-click-node="false"
      :default-expand-all="true"
      :current-node-key="currentPath"
      highlight-current
      class="file-tree"
      @node-click="handleNodeClick"
    >
      <template #default="{ node, data }">
        <div
          class="tree-node"
          :class="{
            'is-dirty': dirtySet.has(data.path),
            'is-skill-md': data.path === 'SKILL.md' || data.path === 'manifest.yaml'
          }"
        >
          <el-icon class="node-icon">
            <Icon :icon="getNodeIcon(data)" />
          </el-icon>
          <span
            class="node-label"
            :title="data.path"
          >{{ node.label }}</span>
          <span
            v-if="data.type === 'file' && !data.isText"
            class="node-tag"
          >bin</span>
          <span
            v-if="dirtySet.has(data.path)"
            class="node-dot"
          />
          <div
            v-if="
              !readOnly &&
                data.type === 'file' &&
                data.path !== 'SKILL.md' &&
                data.path !== 'manifest.yaml'
            "
            class="node-actions"
            @click.stop
          >
            <el-tooltip
              content="重命名"
              placement="top"
            >
              <button
                class="node-icon-btn"
                type="button"
                :aria-label="`重命名 ${data.path}`"
                @click.stop="openRenameDialog(data)"
              >
                <el-icon><Icon icon="mdi:pencil-outline" /></el-icon>
              </button>
            </el-tooltip>
            <el-tooltip
              content="删除"
              placement="top"
            >
              <button
                class="node-icon-btn node-icon-btn--danger"
                type="button"
                :aria-label="`删除 ${data.path}`"
                @click.stop="confirmDelete(data)"
              >
                <el-icon><Icon :icon="iconMap.delete" /></el-icon>
              </button>
            </el-tooltip>
          </div>
        </div>
      </template>
    </el-tree>
    <div
      v-else
      class="tree-empty"
    >
      <EmptyState
        compact
        workbench
        title="暂无文件"
        description="新建或上传文件后会显示在这里。"
        :icon="iconMap.folderOpened"
      />
    </div>

    <!-- 新建 / 重命名 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="420px"
      append-to-body
    >
      <el-form @submit.prevent>
        <el-form-item
          label="路径"
          label-width="60px"
        >
          <el-input
            v-model="dialogPath"
            placeholder="如 scripts/parse.py"
            autofocus
            @keyup.enter="confirmDialog"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="dialogSubmitting"
          @click="confirmDialog"
        >
          确认
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { ElMessageBox } from 'element-plus'
import EmptyState from '@/components/common/EmptyState.vue'
import { icons } from '@/utils/icons.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'
import { saveSkillFileApi, deleteSkillFileApi, moveSkillFileApi } from '@/services/api.js'

const iconMap = icons

const props = defineProps({
  scope: { type: String, required: true },
  skillName: { type: String, default: '' },
  files: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  currentPath: { type: String, default: '' },
  dirtyPaths: { type: Array, default: () => [] },
  readOnly: { type: Boolean, default: false }
})

const emit = defineEmits(['select', 'refresh', 'open-after-write'])

const fileInput = ref(null)

const dirtySet = computed(() => new Set(props.dirtyPaths))

// ── 把扁平 path 列表组装成树 ───────────────────────────────────────
const treeData = computed(() => {
  const root = { children: new Map() }
  for (const file of props.files) {
    const segs = file.path.split('/')
    let cur = root
    let acc = ''
    segs.forEach((seg, idx) => {
      acc = acc ? `${acc}/${seg}` : seg
      const isLast = idx === segs.length - 1
      if (!cur.children.has(seg)) {
        cur.children.set(seg, {
          label: seg,
          path: acc,
          type: isLast ? 'file' : 'dir',
          size: isLast ? file.size : 0,
          isText: isLast ? file.isText : false,
          children: new Map()
        })
      }
      cur = cur.children.get(seg)
    })
  }
  return toArray(root)
})

function toArray(node) {
  const list = []
  for (const child of node.children.values()) {
    const item = { ...child }
    delete item.children
    if (child.type === 'dir') {
      item.children = toArray(child)
    }
    list.push(item)
  }
  // 目录优先 → 字母序
  list.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.label.localeCompare(b.label)
  })
  return list
}

function getNodeIcon(node) {
  if (node.type === 'dir') return 'mdi:folder-outline'
  if (node.path === 'SKILL.md') return 'mdi:book-open-page-variant-outline'
  if (!node.isText) return 'mdi:file-outline'
  const ext = (node.label.split('.').pop() || '').toLowerCase()
  const map = {
    md: 'mdi:language-markdown-outline',
    py: 'mdi:language-python',
    js: 'mdi:language-javascript',
    ts: 'mdi:language-typescript',
    json: 'mdi:code-json',
    yml: 'mdi:file-code-outline',
    yaml: 'mdi:file-code-outline',
    sh: 'mdi:console',
    sql: 'mdi:database-outline'
  }
  return map[ext] || 'mdi:file-document-outline'
}

const handleNodeClick = (data) => {
  if (data.type === 'file') emit('select', data.path)
}

// ── 新建 / 重命名对话框 ────────────────────────────────────────────
const dialogVisible = ref(false)
const dialogMode = ref('create-file') // 'create-file' | 'create-folder' | 'rename'
const dialogPath = ref('')
const dialogOriginal = ref('')
const dialogSubmitting = ref(false)

const dialogTitle = computed(() => {
  if (dialogMode.value === 'rename') return '重命名'
  if (dialogMode.value === 'create-folder') return '新建文件夹'
  return '新建文件'
})

const openCreateDialog = (mode) => {
  if (props.readOnly) return
  dialogMode.value = mode === 'folder' ? 'create-folder' : 'create-file'
  dialogPath.value = ''
  dialogVisible.value = true
}

const openRenameDialog = (node) => {
  if (props.readOnly) return
  dialogMode.value = 'rename'
  dialogPath.value = node.path
  dialogOriginal.value = node.path
  dialogVisible.value = true
}

const confirmDialog = async () => {
  if (props.readOnly) return
  const target = dialogPath.value.trim()
  if (!target) {
    showError('路径不能为空')
    return
  }
  if (target.includes('..') || target.startsWith('/')) {
    showError('路径含非法字符')
    return
  }

  dialogSubmitting.value = true
  try {
    if (dialogMode.value === 'create-file') {
      await saveSkillFileApi({
        scope: props.scope,
        name: props.skillName,
        path: target,
        content: '',
        encoding: 'text'
      })
      showSuccess('已创建')
      emit('refresh')
      emit('open-after-write', target)
    } else if (dialogMode.value === 'create-folder') {
      // 后端没有显式创建空目录，借助占位文件创建后立即删除占位是不必要的
      // 直接提示用户：通过新建文件时输入 "folder/file.txt" 自动建目录
      // 这里用 .gitkeep 作为占位以创建目录
      await saveSkillFileApi({
        scope: props.scope,
        name: props.skillName,
        path: `${target}/.gitkeep`,
        content: '',
        encoding: 'text'
      })
      showSuccess('已创建文件夹')
      emit('refresh')
    } else if (dialogMode.value === 'rename') {
      if (target === dialogOriginal.value) {
        dialogVisible.value = false
        return
      }
      await moveSkillFileApi({
        scope: props.scope,
        name: props.skillName,
        from: dialogOriginal.value,
        to: target
      })
      showSuccess('已重命名')
      emit('refresh')
      emit('open-after-write', target)
    }
    dialogVisible.value = false
  } catch (e) {
    showError(e?.response?.data?.msg || e?.message || '操作失败')
  } finally {
    dialogSubmitting.value = false
  }
}

// ── 删除 ──────────────────────────────────────────────────────────
const confirmDelete = async (node) => {
  if (props.readOnly) return
  try {
    await ElMessageBox.confirm(`确定删除「${node.path}」？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
  } catch {
    return
  }
  try {
    await deleteSkillFileApi({
      scope: props.scope,
      name: props.skillName,
      path: node.path
    })
    showSuccess('已删除')
    emit('refresh')
  } catch (e) {
    showError(e?.response?.data?.msg || e?.message || '删除失败')
  }
}

// ── 上传 ──────────────────────────────────────────────────────────
const triggerUpload = () => {
  if (props.readOnly) return
  fileInput.value?.click()
}

const handleUpload = async (event) => {
  if (props.readOnly) return
  const list = Array.from(event.target.files || [])
  event.target.value = ''
  await uploadFiles(list)
}

const uploadFiles = async (list) => {
  if (props.readOnly || !list.length) return
  let success = 0
  for (const file of list) {
    try {
      const isText = await guessTextFile(file)
      const content = await readFile(file, isText)
      await saveSkillFileApi({
        scope: props.scope,
        name: props.skillName,
        path: file.name,
        content,
        encoding: isText ? 'text' : 'base64'
      })
      success += 1
    } catch (e) {
      showError(`上传 ${file.name} 失败：${e?.response?.data?.msg || e?.message || '未知错误'}`)
    }
  }
  if (success > 0) {
    showSuccess(`上传完成（${success}/${list.length}）`)
    emit('refresh')
  }
}

// ── 拖拽上传 ──────────────────────────────────────────────────────────
const dragOver = ref(false)
let dragCounter = 0

const onDragEnter = (e) => {
  if (props.readOnly) return
  if (!hasFiles(e)) return
  dragCounter += 1
  dragOver.value = true
}

const onDragOver = (e) => {
  if (props.readOnly) return
  if (!hasFiles(e)) return
  e.dataTransfer.dropEffect = 'copy'
}

const onDragLeave = () => {
  dragCounter -= 1
  if (dragCounter <= 0) {
    dragCounter = 0
    dragOver.value = false
  }
}

const onDrop = async (e) => {
  dragCounter = 0
  dragOver.value = false
  if (props.readOnly) return
  const items = Array.from(e.dataTransfer?.files || [])
  if (!items.length) return
  await uploadFiles(items)
}

function hasFiles(e) {
  const types = e.dataTransfer?.types
  if (!types) return false
  return Array.from(types).includes('Files')
}

const TEXT_EXTS = new Set([
  'md',
  'markdown',
  'txt',
  'text',
  'rst',
  'py',
  'js',
  'mjs',
  'cjs',
  'ts',
  'tsx',
  'jsx',
  'vue',
  'svelte',
  'java',
  'kt',
  'scala',
  'go',
  'rs',
  'rb',
  'swift',
  'c',
  'cc',
  'cpp',
  'h',
  'hpp',
  'json',
  'yaml',
  'yml',
  'toml',
  'ini',
  'conf',
  'properties',
  'env',
  'sh',
  'bash',
  'zsh',
  'fish',
  'ps1',
  'bat',
  'cmd',
  'sql',
  'graphql',
  'proto',
  'html',
  'htm',
  'xml',
  'css',
  'scss',
  'sass',
  'less',
  'log',
  'csv',
  'tsv',
  'diff',
  'patch'
])

async function guessTextFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  if (TEXT_EXTS.has(ext)) return true
  if (file.type.startsWith('text/')) return true
  return false
}

function readFile(file, asText) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (asText) {
        resolve(reader.result)
      } else {
        // ArrayBuffer → base64
        const bytes = new Uint8Array(reader.result)
        const CHUNK = 8192
        let bin = ''
        for (let i = 0; i < bytes.length; i += CHUNK) {
          bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
        }
        resolve(btoa(bin))
      }
    }
    reader.onerror = () => reject(reader.error || new Error('读取文件失败'))
    if (asText) reader.readAsText(file)
    else reader.readAsArrayBuffer(file)
  })
}
</script>

<style scoped>
.skill-file-tree {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  background: var(--app-card-background);
  border-right: 1px solid var(--el-border-color-light);
  position: relative;
}

.skill-file-tree.is-drag-over::after {
  content: '拖入文件以上传';
  position: absolute;
  inset: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 8%, var(--app-card-background));
  border: 2px dashed var(--el-color-primary);
  border-radius: 8px;
  pointer-events: none;
  z-index: 10;
}

.tree-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--el-border-color-light);
  background: var(--app-control-background-soft);
}

.tree-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.tree-title em {
  height: 18px;
  min-width: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--el-color-primary) 10%, var(--app-control-background));
  color: var(--el-color-primary);
  font-size: 11px;
  font-style: normal;
  line-height: 18px;
  text-align: center;
}

.tree-actions {
  display: flex;
  gap: 2px;
}

.tree-icon-btn,
.node-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  transition: background 0.12s;
}

.tree-icon-btn:hover,
.node-icon-btn:hover {
  background: var(--el-fill-color-light);
  color: var(--el-color-primary);
}

.tree-icon-btn:focus-visible,
.node-icon-btn:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--el-color-primary) 36%, transparent);
  outline-offset: 2px;
}

.node-icon-btn--danger:hover {
  color: var(--el-color-danger);
}

.tree-loading,
.tree-empty {
  padding: 16px;
}

.file-tree {
  flex: 1;
  overflow: auto;
  padding: 6px 4px;
  background: transparent;
}

.file-tree :deep(.el-tree-node__content) {
  height: 30px;
  border-radius: 6px;
}

.file-tree :deep(.el-tree-node__content:hover) {
  background: var(--el-fill-color-light);
}

.file-tree :deep(.is-current > .el-tree-node__content) {
  background: var(--el-color-primary-light-9);
}

.tree-node {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  font-size: 13px;
  padding-right: 4px;
}

.node-icon {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.tree-node.is-skill-md .node-icon {
  color: var(--el-color-primary);
}

.node-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--el-text-color-primary);
}

.tree-node.is-dirty .node-label {
  font-style: italic;
}

.node-tag {
  font-size: 10px;
  padding: 0 4px;
  border-radius: 3px;
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
}

.node-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--el-color-warning);
  flex-shrink: 0;
}

.node-actions {
  display: none;
  gap: 1px;
}

.tree-node:hover .node-actions {
  display: inline-flex;
}
</style>
