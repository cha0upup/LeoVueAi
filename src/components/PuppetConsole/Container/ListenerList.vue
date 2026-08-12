<template>
  <div class="listener-list-container">
    <ContainerAssetPanel
      title="Listener 监听器"
      :icon="iconMap.shield"
      :total="listeners.length"
      :filtered="filteredListeners.length"
    >
      <template #toolbar>
        <el-input
          v-model="searchKeyword"
          placeholder="搜索类名、ClassLoader、ID"
          clearable
          class="search-input"
        >
          <template #prefix>
            <el-icon>
              <Icon :icon="iconMap.search" />
            </el-icon>
          </template>
        </el-input>
      </template>

      <el-card class="container-table-card">
        <div class="asset-table-shell">
          <el-table
            :data="pagedListeners"
            stripe
            style="width: 100%"
            height="100%"
            class="asset-table"
            :empty-text="listeners.length === 0 ? '该Context暂无Listener' : '未找到匹配的Listener'"
          >
            <el-table-column
              label="类型"
              width="110"
            >
              <template #default="{ row }">
                <el-tag
                  :type="categoryTagType(row.category)"
                  size="small"
                  effect="plain"
                >
                  {{ categoryLabel(row.category) }}
                </el-tag>
              </template>
            </el-table-column>

            <el-table-column
              prop="className"
              label="Listener类名"
              min-width="260"
            >
              <template #default="{ row }">
                <div
                  v-if="row.className"
                  class="listener-class-cell"
                >
                  <el-tooltip
                    :content="row.className"
                    placement="top"
                  >
                    <span class="mono-text listener-class">{{ row.className }}</span>
                  </el-tooltip>
                  <el-button
                    type="primary"
                    link
                    size="small"
                    style="margin-left: 8px"
                    @click="handleViewBytecode(row.className)"
                  >
                    <el-icon>
                      <Icon :icon="iconMap.code" />
                    </el-icon>
                    查看字节码
                  </el-button>
                </div>
                <span
                  v-else
                  class="mono-text"
                >-</span>
              </template>
            </el-table-column>

            <el-table-column
              prop="classLoader"
              label="ClassLoader"
              min-width="260"
            >
              <template #default="{ row }">
                <span class="mono-text">
                  {{ row.classLoader || '-' }}
                </span>
              </template>
            </el-table-column>

            <el-table-column
              label="操作"
              width="120"
              fixed="right"
            >
              <template #default="{ row }">
                <el-button
                  type="danger"
                  size="small"
                  :loading="removingIds.has(row.listenerId)"
                  :disabled="!props.removable || removingIds.has(row.listenerId) || !row.listenerId"
                  @click="handleRemove(row)"
                >
                  <el-icon>
                    <Icon :icon="iconMap.delete" />
                  </el-icon>
                  移除
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <div
            v-if="filteredListeners.length > pageSize"
            class="pagination-wrapper"
          >
            <el-pagination
              v-model:current-page="currentPage"
              :page-size="pageSize"
              layout="prev, pager, next, jumper"
              :total="filteredListeners.length"
              background
              small
            />
          </div>
        </div>
      </el-card>
    </ContainerAssetPanel>

    <ClassBytecodeDialog
      v-model="bytecodeDialogVisible"
      :session-id="sessionId"
      :class-name="selectedClassName"
      @close="selectedClassName = ''"
    />
  </div>
</template>

<script setup>
import { ref, computed, inject, watch } from 'vue'
import { confirmAction } from '@/utils/confirmUtils.js'
import { icons } from '@/utils/icons.js'
import ClassBytecodeDialog from './ClassBytecodeDialog.vue'
import ContainerAssetPanel from './ContainerAssetPanel.vue'
import { useWebRuntimeComponentRemoval } from './useWebRuntimeComponentRemoval.js'
import { showWarning } from '@/utils/messageUtils.js'

const iconMap = icons

// Props
const props = defineProps({
  listeners: {
    type: Array,
    default: () => []
  },
  contextName: {
    type: String,
    default: ''
  },
  removable: {
    type: Boolean,
    default: false
  },
  sessionId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['refresh'])

// 响应式数据
const searchKeyword = ref('')
const currentPage = ref(1)
const injectedPageSize = inject('puppetListPageSize', ref(50))
const pageSize = injectedPageSize
const { removingIds, removeComponent } = useWebRuntimeComponentRemoval({
  props,
  emit,
  componentType: 'listener',
  label: 'Listener'
})
const bytecodeDialogVisible = ref(false)
const selectedClassName = ref('')

// 计算属性 - 过滤后的 Listener 列表
const filteredListeners = computed(() => {
  if (!searchKeyword.value.trim()) {
    return props.listeners
  }

  const keyword = searchKeyword.value.toLowerCase().trim()
  return props.listeners.filter((listener) => {
    const className = (listener.className || '').toLowerCase()
    const classLoader = (listener.classLoader || '').toLowerCase()
    const listenerId = (listener.listenerId || '').toLowerCase()
    const category = (listener.category || '').toLowerCase()

    return (
      className.includes(keyword) ||
      classLoader.includes(keyword) ||
      listenerId.includes(keyword) ||
      category.includes(keyword)
    )
  })
})

const categoryLabel = (category) => {
  switch (category) {
    case 'event':
      return '事件'
    case 'lifecycle':
      return '生命周期'
    default:
      return category || '未知'
  }
}

const categoryTagType = (category) => {
  switch (category) {
    case 'event':
      return 'info'
    case 'lifecycle':
      return 'success'
    default:
      return ''
  }
}

// 当前页数据
const pagedListeners = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredListeners.value.slice(start, start + pageSize.value)
})

watch(searchKeyword, () => {
  currentPage.value = 1
})

/**
 * 查看类字节码
 */
const handleViewBytecode = (className) => {
  if (!className) {
    return
  }
  selectedClassName.value = className
  bytecodeDialogVisible.value = true
}

/**
 * 移除 Listener
 */
const handleRemove = async (listener) => {
  if (!listener.listenerId) {
    showWarning('Listener 信息不完整，缺少移除条件（缺少 listenerId）')
    return
  }

  const displayClassName = listener.className || '未知 Listener'

  const confirmed = await confirmAction({
    title: '确认移除 Listener',
    message: `确定要移除以下 Listener 吗？\n\nListener 类名: ${displayClassName}\n\n此操作会立即从当前版本适配器管理的 Context 监听器列表中移除该 Listener，请谨慎操作！`,
    confirmButtonText: '确定移除'
  })
  if (!confirmed) return

  await removeComponent(listener.listenerId, listener.listenerId)
}
</script>

<style scoped>
@import '@/styles/container-list-shared.css';

.listener-list-container {
  display: flex;
  flex-direction: column;
  gap: var(--el-spacing-base);
  height: 100%;
}

.listener-class-cell {
  display: flex;
  align-items: center;
}

.listener-class {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}
</style>
