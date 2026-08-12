<template>
  <div class="file-tree">
    <el-tree
      ref="treeRef"
      :data="treeData"
      :props="TREE_PROPS"
      :expand-on-click-node="false"
      :highlight-current="true"
      node-key="path"
      :default-expanded-keys="expandedKeys"
      :lazy="false"
      class="tree"
      @node-click="handleNodeClick"
      @node-expand="handleNodeExpand"
      @node-collapse="handleNodeCollapse"
    >
      <template #empty>
        <div class="tree-empty">
          <el-icon><Icon :icon="getNodeIcon({ isDirectory: true })" /></el-icon>
          <span>暂无子目录</span>
        </div>
      </template>
      <template #default="{ data }">
        <div
          class="tree-node"
          :class="getNodeClass(data)"
        >
          <span class="node-icon-shell">
            <el-icon
              class="node-icon"
              :class="getNodeIconClass(data)"
            >
              <Icon :icon="getNodeIcon(data)" />
            </el-icon>
          </span>
          <span
            class="node-label"
            :title="getNodeDisplayName(data)"
          >
            {{ getNodeDisplayName(data) }}
          </span>
        </div>
      </template>
    </el-tree>

    <div
      v-if="isLoading"
      class="loading-overlay"
    >
      <el-icon class="loading-icon">
        <Loading />
      </el-icon>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, nextTick } from 'vue'
import { getFileIconMeta } from '@/utils/fileIcons.js'
import { formatFilePath } from '@/utils/format.js'
import { getFileListApi } from '@/services/api.js'
import { Loading } from '@element-plus/icons-vue'
import {
  isWindowsDisk,
  isWindowsPath,
  normalizePathForTree,
  buildChildPath
} from '@/composables/useFilePath.js'

/**
 * 文件树组件 - macOS Finder 风格
 * 支持 Windows 和 Linux 文件系统
 */

const props = defineProps({
  sessionId: {
    type: String,
    required: true
  },
  currentPath: {
    type: String,
    default: ''
  },
  currentDisk: {
    type: String,
    default: ''
  },
  isWindows: {
    type: Boolean,
    default: false
  },
  roots: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['selectPath'])

const TREE_PROPS = {
  children: 'children',
  label: 'name'
}

// 响应式数据
const treeRef = ref(null)
const treeData = ref([])
const expandedKeys = ref([])
const isLoading = ref(false)

/**
 * 加载指定路径的目录数据
 */
const loadDirectory = async (path, setLoading = false) => {
  try {
    if (setLoading) {
      isLoading.value = true
    }
    const formattedPath = formatFilePath(path)
    const resp = await getFileListApi({
      sessionId: props.sessionId,
      path: formattedPath
    })

    const { fileList } = resp.data || {}
    if (!fileList?.length) {
      return []
    }

    const directories = fileList.filter((file) => file.isDirectory)

    return directories.map((dir) => ({
      name: dir.name,
      path: buildChildPath(path, dir.name),
      isDirectory: true,
      children: []
    }))
  } catch {
    return []
  } finally {
    if (setLoading) {
      isLoading.value = false
    }
  }
}

/**
 * 加载根目录
 */
const loadRoot = async () => {
  try {
    isLoading.value = true
    if (props.isWindows) {
      const selectedRoot = props.currentDisk && props.currentDisk !== '/'
        ? props.currentDisk
        : props.roots[0]
      treeData.value = selectedRoot
        ? await loadDirectory(formatFilePath(`${selectedRoot}/`), false)
        : []
    } else {
      treeData.value = await loadDirectory('/', false)
    }

    expandedKeys.value = treeData.value[0]?.path ? [treeData.value[0].path] : []
  } catch {
    treeData.value = []
  } finally {
    isLoading.value = false
  }
}

/**
 * 加载子节点数据
 */
const loadChildren = async (node) => {
  const { data } = node
  if (data.loaded || (data.children?.length && data.children[0]?.name)) {
    return
  }

  try {
    data.children = (await loadDirectory(data.path)) || []
    data.loaded = true
  } catch {
    data.children = []
    data.loaded = true
  }
}

/**
 * 更新展开状态
 */
const updateExpandedState = (path, expanded) => {
  if (!path) return
  const treePath = normalizePathForTree(path)
  const keyIndex = expandedKeys.value.indexOf(treePath)

  if (expanded && keyIndex === -1) {
    expandedKeys.value.push(treePath)
  } else if (!expanded && keyIndex > -1) {
    expandedKeys.value.splice(keyIndex, 1)
  }
}

const applyExpandedState = async () => {
  await nextTick()
  expandedKeys.value.forEach((key) => {
    const node = treeRef.value?.getNode(key)
    if (node) {
      node.expanded = true
    }
  })
}

const handleNodeExpand = (data) => {
  updateExpandedState(data?.path, true)
}

const handleNodeCollapse = (data) => {
  updateExpandedState(data?.path, false)
}

/**
 * 处理节点点击事件
 */
const handleNodeClick = async (data, node) => {
  if (!data?.path) return

  let normalizedPath = normalizePathForTree(data.path)
  const isWindowsDriveRoot = /^[A-Za-z]:\/$/.test(normalizedPath)
  if (!isWindowsDriveRoot && normalizedPath !== '/' && normalizedPath.endsWith('/')) {
    normalizedPath = normalizedPath.slice(0, -1)
  }

  emit('selectPath', formatFilePath(normalizedPath))

  if (data.isDirectory) {
    if (!data.children?.length && !data.loaded) {
      await loadChildren(node)
    }
    updateExpandedState(data.path, true)
    await nextTick()
  }
}

/**
 * 获取节点图标
 */
const getNodeIcon = (data) => {
  return getFileIconMeta(data).icon
}

/**
 * 获取节点图标样式类
 */
const getNodeIconClass = (data) => {
  if (!data.isDirectory) return getFileIconMeta(data).className
  return isWindowsDisk(data.name) ? 'disk-icon' : 'folder-icon'
}

/**
 * 获取节点显示名称
 */
const getNodeDisplayName = (data) => {
  if (data.name) return data.name
  if (data.path) {
    const pathParts = data.path.split(/[\\/]+/).filter(Boolean)
    return pathParts[pathParts.length - 1] || data.path
  }
  return '未知'
}

/**
 * 获取节点样式类
 */
const getNodeClass = (data) => {
  if (isWindowsDisk(data.name)) return 'disk-node'
  if (data.path === '/' || data.name === '/') return 'root-node'
  return ''
}

/**
 * 递归查找节点并加载其子节点
 */
const findAndExpandNode = async (nodes, targetPath, pathToExpand = []) => {
  if (!nodes || !nodes.length || !targetPath) return false

  const normalizedTarget = normalizePathForTree(targetPath)

  for (const node of nodes) {
    const nodePath = normalizePathForTree(node.path)

    if (nodePath === normalizedTarget) {
      const keysToExpand = [...pathToExpand, nodePath]
      expandedKeys.value = [...new Set([...expandedKeys.value, ...keysToExpand])]

      if (node.isDirectory && (!node.children || node.children.length === 0) && !node.loaded) {
        const children = await loadDirectory(node.path)
        node.children = children || []
        node.loaded = true
        if (!expandedKeys.value.includes(nodePath)) {
          expandedKeys.value.push(nodePath)
        }
      }

      await nextTick()
      treeRef.value?.setCurrentKey(nodePath)
      return true
    }

    const isChildPath =
      nodePath === '/'
        ? normalizedTarget.startsWith('/') && normalizedTarget !== '/'
        : normalizedTarget !== nodePath &&
          normalizedTarget.startsWith(nodePath) &&
          normalizedTarget.length > nodePath.length &&
          normalizedTarget[nodePath.length] === '/'

    if (isChildPath && isWindowsPath(normalizedTarget) && isWindowsPath(nodePath)) {
      const targetDrive = normalizedTarget.match(/^([A-Za-z]:)/)?.[1]?.toUpperCase()
      const nodeDrive = nodePath.match(/^([A-Za-z]:)/)?.[1]?.toUpperCase()
      if (targetDrive && nodeDrive && targetDrive !== nodeDrive) {
        continue
      }
    }

    if (isChildPath) {
      const newPathToExpand = [...pathToExpand, nodePath]
      expandedKeys.value = [...new Set([...expandedKeys.value, ...newPathToExpand])]

      if ((!node.children || node.children.length === 0) && !node.loaded) {
        const children = await loadDirectory(node.path)
        node.children = children || []
        node.loaded = true

        if (await findAndExpandNode(node.children, targetPath, newPathToExpand)) {
          return true
        }
      } else if (node.children && node.children.length > 0) {
        if (await findAndExpandNode(node.children, targetPath, newPathToExpand)) {
          return true
        }
      }
    }
  }

  return false
}

/**
 * 根据路径查找并展开节点路径
 */
const expandPathToNode = async (targetPath) => {
  if (!targetPath || !treeData.value.length) return

  let processedPath = String(targetPath).replace(/[\\/]\.$/, '')
  if (targetPath === './' || targetPath === '.') {
    if (treeData.value.length > 0) {
      const rootPath = normalizePathForTree(treeData.value[0].path)
      expandedKeys.value = [rootPath]
      await nextTick()
      treeRef.value?.setCurrentKey(rootPath)
    }
    return
  }

  const normalizedTarget = normalizePathForTree(processedPath)

  if (!normalizedTarget || normalizedTarget === '/' || normalizedTarget === '') {
    if (treeData.value.length > 0) {
      const rootPath = normalizePathForTree(treeData.value[0].path)
      expandedKeys.value = [rootPath]
      await nextTick()
      treeRef.value?.setCurrentKey(rootPath)
    }
    return
  }

  const found = await findAndExpandNode(treeData.value, normalizedTarget)

  await applyExpandedState()

  if (!found) {
    const keysToExpand = []
    let currentPathValue = ''

    const matchResult = normalizedTarget.match(/^([A-Za-z]:)?(.*)$/)
    if (matchResult) {
      const [, drivePart, pathRest] = matchResult
      const pathParts = pathRest.split(/[\\/]+/).filter(Boolean)

      if (drivePart) {
        currentPathValue = drivePart
        keysToExpand.push(normalizePathForTree(currentPathValue))
        pathParts.forEach((part) => {
          currentPathValue = `${currentPathValue}/${part}`
          keysToExpand.push(normalizePathForTree(currentPathValue))
        })
      } else {
        if (normalizedTarget.startsWith('/')) {
          currentPathValue = '/'
          keysToExpand.push('/')
        }
        pathParts.forEach((part) => {
          currentPathValue = `${currentPathValue}/${part}`
          keysToExpand.push(normalizePathForTree(currentPathValue))
        })
      }
    }

    expandedKeys.value = [...new Set([...expandedKeys.value, ...keysToExpand])]
    await applyExpandedState()
    treeRef.value?.setCurrentKey(normalizedTarget)
  }
}

/**
 * 监听当前路径变化，更新选中节点
 */
watch(
  () => props.currentPath,
  async (newPath) => {
    if (newPath) {
      if (treeData.value.length === 0) {
        await loadRoot()
      }
      await expandPathToNode(newPath)
    } else if (treeRef.value) {
      treeRef.value.setCurrentKey(null)
    }
  },
  { immediate: false }
)

/**
 * 监听当前磁盘变化，重新加载树
 */
watch(
  () => props.currentDisk,
  async (newDisk, oldDisk) => {
    if (newDisk !== oldDisk) {
      await loadRoot()
    }
  },
  { immediate: false }
)

onMounted(async () => {
  await loadRoot()
  if (props.currentPath) {
    await expandPathToNode(props.currentPath)
  } else if (treeData.value.length > 0) {
    const rootPath = normalizePathForTree(treeData.value[0].path)
    expandedKeys.value = [rootPath]
    await nextTick()
    treeRef.value?.setCurrentKey(rootPath)
  }
})

// 暴露刷新方法给父组件
defineExpose({
  refresh: loadRoot
})
</script>

<style scoped>
.file-tree {
  --file-tree-muted-surface: var(--app-control-background-soft);
  --file-tree-panel-surface: var(--app-control-background);
  --file-tree-selected-surface: var(--app-card-active-background);
  --file-tree-soft-border: color-mix(in srgb, var(--el-border-color) 16%, transparent);
  position: relative;
  height: 100%;
  width: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: transparent;
  border: none;
  border-radius: 0;
}

:global(html:not(.dark) .file-tree),
:global(html[data-theme='light'] .file-tree) {
  --file-tree-muted-surface: var(--app-control-background-soft);
  --file-tree-panel-surface: var(--app-control-background);
  --file-tree-selected-surface: var(--app-card-active-background);
  --file-tree-soft-border: color-mix(in srgb, var(--el-border-color) 16%, transparent);
}

.tree {
  flex: 1;
  min-height: 0;
  padding: 2px;
  background: transparent;
  overflow-y: auto;
  overflow-x: hidden;
}

.tree::-webkit-scrollbar {
  width: 6px;
}

.tree::-webkit-scrollbar-track {
  background: transparent;
}

.tree::-webkit-scrollbar-thumb {
  background: var(--app-code-scroll-thumb);
  border-radius: 3px;
}

.tree::-webkit-scrollbar-thumb:hover {
  background: var(--app-code-scroll-thumb-hover);
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  user-select: none;
}

.node-icon-shell {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: var(--radius-control);
  background: var(--file-tree-muted-surface);
  border: 1px solid color-mix(in srgb, var(--file-tree-soft-border) 92%, transparent);
}

.node-icon {
  font-size: 14px;
  transition: color 0.2s;
}

.folder-icon {
  color: var(--el-color-primary);
}

.disk-icon {
  color: var(--el-color-primary);
}

.file-icon {
  color: var(--el-text-color-regular);
}

.image-icon,
.excel-icon {
  color: var(--el-color-success);
}

.video-icon,
.audio-icon,
.archive-icon {
  color: var(--el-color-warning-dark-2);
}

.pdf-icon,
.executable-icon {
  color: var(--el-color-danger);
}

.json-icon,
.code-icon {
  color: var(--el-color-primary);
}

.word-icon,
.ppt-icon {
  color: var(--el-color-primary);
}

.markdown-icon {
  color: var(--el-text-color-regular);
}

.text-icon {
  color: var(--el-text-color-secondary);
}

.font-icon,
.book-icon {
  color: var(--el-text-color-secondary);
}

.node-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  line-height: 1.35;
  color: var(--el-text-color-primary);
  transition: color 0.2s;
}

.disk-node .node-icon {
  color: var(--el-color-primary);
}

.disk-node .node-label {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.root-node .node-icon {
  color: var(--el-color-primary);
}

.root-node .node-label {
  font-weight: 600;
}

:deep(.el-tree-node) {
  margin: 0;
}

:deep(.el-tree) {
  background: transparent;
  color: var(--el-text-color-primary);
}

:deep(.el-tree__empty-block) {
  background: transparent;
}

:deep(.el-tree-node__content) {
  height: 30px;
  padding: 0 6px;
  margin: 1px 0;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition:
    background-color 0.2s,
    border-color 0.2s,
    box-shadow 0.2s;
}

:deep(.el-tree-node__content:hover) {
  background: color-mix(in srgb, var(--file-tree-muted-surface) 80%, transparent);
  border-color: color-mix(in srgb, var(--file-tree-soft-border) 70%, transparent);
}

:deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: var(--file-tree-selected-surface);
  border-color: color-mix(in srgb, var(--file-tree-soft-border) 82%, transparent);
  box-shadow: none;
}

:deep(.el-tree-node.is-current > .el-tree-node__content .node-label) {
  color: var(--el-text-color-primary);
  font-weight: 600;
}

:deep(.el-tree-node.is-current > .el-tree-node__content .node-icon) {
  color: var(--el-color-primary);
}

:deep(.el-tree-node.is-current > .el-tree-node__content .node-icon-shell) {
  background: color-mix(in srgb, var(--el-color-primary) 8%, var(--file-tree-muted-surface));
  border-color: color-mix(in srgb, var(--el-color-primary) 18%, transparent);
}

:deep(.el-tree-node__expand-icon) {
  color: var(--el-text-color-placeholder);
  transition: color 0.2s;
  font-size: 11px;
  margin-right: 2px;
}

:deep(.el-tree-node__expand-icon:hover) {
  color: var(--el-text-color-secondary);
}

:deep(.el-tree-node__expand-icon.is-leaf) {
  color: transparent;
  cursor: default;
}

:deep(.el-tree-node__children) {
  padding-left: 4px !important;
}

:deep(.el-tree-node__indent) {
  width: 10px !important;
  flex: 0 0 10px !important;
}

:deep(.el-tree-node.disk-node > .el-tree-node__content) {
  padding-left: var(--el-spacing-base);
}

:deep(.el-tree-node.disk-node > .el-tree-node__content > .el-tree-node__expand-icon) {
  display: none;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--app-surface-background) 88%, transparent);
  backdrop-filter: blur(2px);
  z-index: 10;
  border-radius: var(--el-border-radius-large);
}

.loading-icon {
  font-size: 24px;
  color: var(--el-text-color-secondary);
  animation: rotate 1s linear infinite;
}

.tree-empty {
  min-height: 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}

.tree-empty .el-icon {
  font-size: 22px;
  color: color-mix(in srgb, var(--el-color-primary) 52%, var(--el-text-color-placeholder));
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
