<template>
  <div
    class="file-tree"
    :aria-busy="loading"
  >
    <div
      v-if="error"
      class="tree-error"
      role="alert"
    >
      <span>{{ error }}</span><el-button
        text
        size="small"
        @click="refresh"
      >
        重试
      </el-button>
    </div>
    <el-tree
      ref="treeRef"
      :data="treeData"
      :props="{ children: 'children', label: 'name' }"
      node-key="path"
      :expand-on-click-node="false"
      highlight-current
      :default-expanded-keys="expandedKeys"
      class="tree"
      @node-click="selectNode"
      @node-expand="expandNode"
      @node-collapse="collapseNode"
    >
      <template #empty>
        <span>{{ loading ? '正在加载目录…' : '暂无目录' }}</span>
      </template>
      <template #default="{ data }">
        <span class="tree-node"><Icon :icon="icons.folder" /><span
          class="node-label"
          :title="data.path"
        >{{
          data.name
        }}</span></span>
      </template>
    </el-tree>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'
import { getFileListApi } from '@/services/api.js'
import { normalizePathForTree, buildChildPath } from '@/composables/useFilePath.js'
import { sortFileEntries } from './fileTableModel.js'
import { createLatestRequestGuard } from '@/utils/latestRequestGuard.js'

const props = defineProps({
  sessionId: { type: String, required: true },
  currentPath: { type: String, default: '' },
  currentDisk: { type: String, default: '' },
  isWindows: Boolean,
  roots: { type: Array, default: () => [] }
})
const emit = defineEmits(['selectPath'])
const treeRef = ref(null)
const treeData = ref([])
const expandedKeys = ref([])
const loading = ref(false)
const error = ref('')
const requests = createLatestRequestGuard(['root', 'selection'])
const pendingChildren = new WeakMap()
const rootPath = computed(() =>
  normalizePathForTree(
    props.isWindows
      ? props.currentDisk && props.currentDisk !== '/'
        ? props.currentDisk
        : props.roots[0]
      : '/'
  )
)

async function loadChildren(node) {
  if (node.loaded) return true
  if (pendingChildren.has(node)) return pendingChildren.get(node)
  const sessionId = props.sessionId
  const task = (async () => {
    try {
      const response = await getFileListApi({ sessionId, path: node.path })
      node.children = sortFileEntries(response.data?.fileList || [])
        .filter((file) => file.isDirectory)
        .map((file) => ({
          name: file.name,
          path: buildChildPath(node.path, file.name),
          children: []
        }))
      node.loaded = true
      return true
    } catch {
      return false
    } finally {
      pendingChildren.delete(node)
    }
  })()
  pendingChildren.set(node, task)
  return task
}

async function expandNode(node) {
  const sequence = requests.next('selection')
  const loaded = await loadChildren(node)
  if (!requests.isCurrent('selection', sequence)) return
  error.value = loaded ? '' : `无法加载目录：${node.path}`
  if (!loaded) return
  expandedKeys.value = [...new Set([...expandedKeys.value, node.path])]
  await nextTick()
  treeRef.value?.getNode(node.path)?.expand()
}
function collapseNode(node) {
  expandedKeys.value = expandedKeys.value.filter((path) => path !== node.path)
}
function selectNode(node) {
  emit('selectPath', node.path)
  // Clicking the current directory does not trigger the path watcher.
  if (normalizePathForTree(props.currentPath) === node.path) expandNode(node)
}

async function syncCurrentPath() {
  const sequence = requests.next('selection')
  const target = normalizePathForTree(
    props.currentPath === '.' || props.currentPath === './' ? rootPath.value : props.currentPath
  )
  let node = treeData.value[0]
  treeRef.value?.setCurrentKey(null)
  while (node && target.startsWith(node.path)) {
    const loaded = await loadChildren(node)
    if (!requests.isCurrent('selection', sequence)) return
    if (!loaded) {
      error.value = `无法加载目录：${node.path}`
      return
    }
    error.value = ''
    expandedKeys.value = [...new Set([...expandedKeys.value, node.path])]
    await nextTick()
    if (!requests.isCurrent('selection', sequence)) return
    const treeNode = treeRef.value?.getNode(node.path)
    if (treeNode) treeNode.expanded = true
    if (node.path === target) {
      treeRef.value?.setCurrentKey(node.path)
      return
    }
    node = node.children.find((child) => target.startsWith(child.path))
  }
}

async function refresh() {
  const sequence = requests.next('root')
  requests.invalidate(['selection'])
  loading.value = true
  error.value = ''
  const root = { name: rootPath.value, path: rootPath.value, children: [] }
  const loaded = root.path && (await loadChildren(root))
  if (!requests.isCurrent('root', sequence)) return
  treeData.value = root.path ? [root] : []
  expandedKeys.value = root.path ? [root.path] : []
  loading.value = false
  if (!loaded) {
    error.value = '目录加载失败，请重试'
    return
  }
  await nextTick()
  await syncCurrentPath()
}
watch([() => props.sessionId, rootPath], refresh, { immediate: true })
watch(
  () => props.currentPath,
  () => {
    if (!loading.value) syncCurrentPath()
  }
)
onBeforeUnmount(() => requests.invalidate())
defineExpose({ refresh })
</script>

<style scoped>
.file-tree {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.tree {
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: transparent;
}
.tree-node {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.tree-node .iconify {
  color: var(--el-color-primary);
  flex-shrink: 0;
  font-size: 16px;
}
.node-label {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 12px;
}
.tree :deep(.el-tree-node__content) {
  height: 30px;
  border-radius: 4px;
}
.tree :deep(.el-tree-node.is-current > .el-tree-node__content) {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.tree :deep(.el-tree-node__expand-icon) {
  padding: 4px;
}
.tree-error {
  padding: 6px;
  font-size: 12px;
  color: var(--el-color-danger);
  overflow-wrap: anywhere;
}
</style>
