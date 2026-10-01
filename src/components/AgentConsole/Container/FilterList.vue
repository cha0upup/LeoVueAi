<template>
  <div class="container-asset-list">
    <ContainerAssetPanel
      title="Filter 列表"
      :total="filters.length"
      :filtered="filteredFilters.length"
    >
      <el-table
        :data="pagedFilters"
        height="100%"
        class="asset-table"
        :empty-text="filters.length ? '未找到匹配的组件' : '暂无组件'"
      >
        <el-table-column
          label="匹配路径"
          min-width="150"
        >
          <template #default="{ row }">
            <span class="mono-text asset-paths">{{ row.urlPatterns?.join('\n') || row.servletNames?.join('\n') || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column
          label="Filter 名称 / 类名"
          min-width="230"
        >
          <template #default="{ row }">
            <button
              type="button"
              class="asset-name-button mono-text"
              :title="row.filterClassName"
              @click="viewDetail(row)"
            >
              {{ row.filterClassName || '-' }}
            </button>
            <span class="asset-secondary">{{ row.filterName }}</span>
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
              :class-name="row.filterClassName || ''"
              :loading="removingIds.has(row.filterName)"
              :removable="props.removable && Boolean(row.filterName)"
              @view="viewDetail(row)"
              @bytecode="emit('view-bytecode', row.filterClassName)"
              @remove="handleRemove(row)"
            />
          </template>
        </el-table-column>
      </el-table>
      <div
        v-if="filteredFilters.length > pageSize"
        class="pagination-wrapper"
      >
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          layout="prev, pager, next"
          :total="filteredFilters.length"
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
  filters: {
    type: Array,
    default: () => []
  },
  contextId: {
    type: String,
    default: ''
  },
  contextName: {
    type: String,
    required: true
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

// 定义事件
const emit = defineEmits(['refresh', 'view-bytecode', 'view-detail'])

// 响应式数据
const { removingIds, removeComponent } = useWebRuntimeComponentRemoval({
  props,
  emit,
  componentType: 'filter',
  label: 'Filter'
})

const { currentPage, pageSize, filteredItems: filteredFilters, pagedItems: pagedFilters } =
  useContainerAssetList(() => props.filters, item => [item.filterName, item.filterClassName, item.urlPatterns, item.servletNames], toRef(props, 'searchKeyword'))

/**
 * 移除Filter
 */
const handleRemove = async (filter) => {
  if (!filter.filterName) {
    showWarning('Filter信息不完整，缺少移除条件')
    return
  }

  await removeComponent(filter.filterName, filter.filterName, {
    title: '确认移除Filter',
    message: `确定要移除以下Filter吗？\n\nFilter名称: ${filter.filterName}\n类名: ${filter.filterClassName}\n\n此操作会立即生效，请谨慎操作！`,
    confirmButtonText: '确定移除'
  })
}

const viewDetail = row => emit('view-detail', {
  title: 'Filter 详情',
  className: row.filterClassName,
  fields: [
    ['Context', props.contextName],
    ['名称', row.filterName],
    ['类名', row.filterClassName],
    ['URL 模式', row.urlPatterns],
    ['关联 Servlet', row.servletNames],
    ['ClassLoader', row.filterClassLoaderName]
  ]
})
</script>

<style scoped>
@import '@/styles/container-list-shared.css';
</style>
