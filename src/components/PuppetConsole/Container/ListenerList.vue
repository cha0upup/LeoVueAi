<template>
  <div class="container-asset-list">
    <ContainerAssetPanel
      title="Listener 列表"
      :total="listeners.length"
      :filtered="filteredListeners.length"
    >
      <el-table
        :data="pagedListeners"
        height="100%"
        class="asset-table"
        :empty-text="listeners.length ? '未找到匹配的组件' : '暂无组件'"
      >
        <el-table-column
          label="类型"
          width="115"
        >
          <template #default="{ row }">
            {{ categoryLabel(row.category) }}
          </template>
        </el-table-column>
        <el-table-column
          label="Listener 类名"
          min-width="230"
        >
          <template #default="{ row }">
            <button
              type="button"
              class="asset-name-button mono-text"
              :title="row.className"
              @click="viewDetail(row)"
            >
              {{ row.className || '-' }}
            </button>
          </template>
        </el-table-column>
        <el-table-column
          label="操作"
          width="60"
          align="center"
          fixed="right"
        >
          <template #default="{ row }">
            <ContainerAssetActions
              :class-name="row.className || ''"
              :loading="removingIds.has(row.listenerId)"
              :removable="props.removable && Boolean(row.listenerId)"
              @view="viewDetail(row)"
              @bytecode="emit('view-bytecode', row.className)"
              @remove="handleRemove(row)"
            />
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
          layout="prev, pager, next"
          :total="filteredListeners.length"
          small
        />
      </div>
    </ContainerAssetPanel>
  </div>
</template>

<script setup>
import { toRef } from 'vue'
import { useContainerAssetList } from './useContainerAssetList.js'
import ContainerAssetPanel from './ContainerAssetPanel.vue'
import ContainerAssetActions from './ContainerAssetActions.vue'
import { useWebRuntimeComponentRemoval } from './useWebRuntimeComponentRemoval.js'
import { showWarning } from '@/utils/messageUtils.js'

// Props
const props = defineProps({
  searchKeyword: { type: String, default: '' },
  listeners: {
    type: Array,
    default: () => []
  },
  contextId: {
    type: String,
    default: ''
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

const emit = defineEmits(['refresh', 'view-bytecode', 'view-detail'])

// 响应式数据
const { removingIds, removeComponent } = useWebRuntimeComponentRemoval({
  props,
  emit,
  componentType: 'listener',
  label: 'Listener'
})

const { currentPage, pageSize, filteredItems: filteredListeners, pagedItems: pagedListeners } =
  useContainerAssetList(() => props.listeners, item => [item.className, item.classLoader, item.listenerId, item.category], toRef(props, 'searchKeyword'))

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

/**
 * 移除 Listener
 */
const handleRemove = async (listener) => {
  if (!listener.listenerId) {
    showWarning('Listener 信息不完整，缺少移除条件（缺少 listenerId）')
    return
  }

  const displayClassName = listener.className || '未知 Listener'

  await removeComponent(listener.listenerId, listener.listenerId, {
    title: '确认移除 Listener',
    message: `确定要移除以下 Listener 吗？\n\nListener 类名: ${displayClassName}\n\n此操作会立即从当前版本适配器管理的 Context 监听器列表中移除该 Listener，请谨慎操作！`,
    confirmButtonText: '确定移除'
  })
}

const viewDetail = row => emit('view-detail', {
  title: 'Listener 详情',
  className: row.className,
  fields: [
    ['Context', props.contextName],
    ['类型', categoryLabel(row.category)],
    ['类名', row.className],
    ['ClassLoader', row.classLoader],
    ['Listener ID', row.listenerId]
  ]
})
</script>

<style scoped>
@import '@/styles/container-list-shared.css';
</style>
