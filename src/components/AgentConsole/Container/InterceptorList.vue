<template>
  <div class="container-asset-list">
    <ContainerAssetPanel
      title="Interceptor 列表"
      :total="interceptors.length"
      :filtered="filteredInterceptors.length"
    >
      <el-table
        :data="pagedInterceptors"
        height="100%"
        class="asset-table"
        :empty-text="interceptors.length ? '未找到匹配的组件' : '暂无组件'"
      >
        <el-table-column
          label="匹配路径"
          min-width="150"
        >
          <template #default="{ row }">
            <span class="mono-text asset-paths">{{ getPathPatternsArray(row.pathPatterns).join('\n') || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column
          label="Interceptor 类名"
          min-width="230"
        >
          <template #default="{ row }">
            <button
              type="button"
              class="asset-name-button mono-text"
              :title="row.interceptorName"
              @click="viewDetail(row)"
            >
              {{ row.interceptorName || '-' }}
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
              :class-name="row.interceptorName || ''"
              :loading="removingIds.has(row.interceptorId)"
              :removable="props.removable && Boolean(row.interceptorId)"
              @view="viewDetail(row)"
              @bytecode="emit('view-bytecode', row.interceptorName)"
              @remove="handleRemove(row)"
            />
          </template>
        </el-table-column>
      </el-table>
      <div
        v-if="filteredInterceptors.length > pageSize"
        class="pagination-wrapper"
      >
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          layout="prev, pager, next"
          :total="filteredInterceptors.length"
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
  interceptors: {
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

// 定义事件
const emit = defineEmits(['refresh', 'view-bytecode', 'view-detail'])

// 响应式数据
const { removingIds, removeComponent } = useWebRuntimeComponentRemoval({
  props,
  emit,
  componentType: 'interceptor',
  label: 'Interceptor'
})

/**
 * 将 pathPatterns 转换为数组
 * pathPatterns 可能是 Object 或 Array
 */
const getPathPatternsArray = (pathPatterns) => {
  if (!pathPatterns) return []
  if (Array.isArray(pathPatterns)) return pathPatterns
  if (typeof pathPatterns === 'object') {
    // 如果是对象，尝试转换为数组
    return Object.values(pathPatterns)
  }
  return []
}

const { currentPage, pageSize, filteredItems: filteredInterceptors, pagedItems: pagedInterceptors } =
  useContainerAssetList(() => props.interceptors, item => [item.interceptorName, getPathPatternsArray(item.pathPatterns), item.excludePatterns], toRef(props, 'searchKeyword'))

/**
 * 移除Interceptor
 */
const handleRemove = async (interceptor) => {
  if (!interceptor.interceptorId) {
    showWarning('Interceptor ID不完整，缺少移除条件')
    return
  }

  const displayName = interceptor.interceptorName || '未知拦截器'
  const displayPathPatterns =
    getPathPatternsArray(interceptor.pathPatterns).join(', ') || '未知路径'
  const displayExcludePatterns = (interceptor.excludePatterns || []).join(', ') || '无'

  await removeComponent(interceptor.interceptorId, interceptor.interceptorId, {
    title: '确认移除Interceptor',
    message: `确定要移除以下Interceptor吗？\n\n拦截器类名: ${displayName}\n路径模式: ${displayPathPatterns}\n排除路径: ${displayExcludePatterns}\n拦截器ID: ${interceptor.interceptorId}\n\n此操作会立即生效，该拦截器将不再拦截任何请求，请谨慎操作！`,
    confirmButtonText: '确定移除'
  })
}

const viewDetail = row => emit('view-detail', {
  title: 'Interceptor 详情',
  className: row.interceptorName,
  fields: [
    ['Context', props.contextName],
    ['类名', row.interceptorName],
    ['路径模式', getPathPatternsArray(row.pathPatterns)],
    ['排除路径', row.excludePatterns],
    ['Interceptor ID', row.interceptorId]
  ]
})
</script>

<style scoped>
@import '@/styles/container-list-shared.css';
</style>
