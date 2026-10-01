<template>
  <div class="container-asset-list">
    <ContainerAssetPanel
      title="Servlet 列表"
      :total="servlets.length"
      :filtered="filteredServlets.length"
    >
      <el-table
        :data="pagedServlets"
        height="100%"
        class="asset-table"
        :empty-text="servlets.length ? '未找到匹配的组件' : '暂无组件'"
      >
        <el-table-column
          prop="url"
          label="URL 模式"
          min-width="150"
        >
          <template #default="{ row }">
            <span class="mono-text asset-paths">{{ row.url || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column
          label="Servlet 类名"
          min-width="230"
        >
          <template #default="{ row }">
            <button
              type="button"
              class="asset-name-button mono-text"
              :title="row.servletClass"
              @click="viewDetail(row)"
            >
              {{ row.servletClass || '-' }}
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
              :class-name="row.servletClass || ''"
              :loading="removingIds.has(row.wrapperName)"
              :removable="props.removable && Boolean(row.wrapperName)"
              @view="viewDetail(row)"
              @bytecode="emit('view-bytecode', row.servletClass)"
              @remove="handleRemove(row)"
            />
          </template>
        </el-table-column>
      </el-table>
      <div
        v-if="filteredServlets.length > pageSize"
        class="pagination-wrapper"
      >
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          layout="prev, pager, next"
          :total="filteredServlets.length"
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
  servlets: {
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
  componentType: 'servlet',
  label: 'Servlet'
})

const { currentPage, pageSize, filteredItems: filteredServlets, pagedItems: pagedServlets } =
  useContainerAssetList(() => props.servlets, item => [item.url, item.wrapperName, item.servletClass], toRef(props, 'searchKeyword'))

// 方法
/**
 * 移除Servlet
 */
const handleRemove = async (servlet) => {
  if (!servlet.wrapperName || !servlet.url) {
    showWarning('Servlet信息不完整，缺少移除条件')
    return
  }

  await removeComponent(servlet.wrapperName, servlet.url, {
    title: '确认移除Servlet',
    message: `确定要移除以下Servlet吗？\n\nURL: ${servlet.url}\n包装器: ${servlet.wrapperName}\n类名: ${servlet.servletClass}\n\n此操作会立即生效，请谨慎操作！`,
    confirmButtonText: '确定移除'
  })
}

const viewDetail = row => emit('view-detail', {
  title: 'Servlet 详情',
  className: row.servletClass,
  fields: [
    ['Context', props.contextName],
    ['URL 模式', row.url],
    ['包装器名称', row.wrapperName],
    ['类名', row.servletClass],
    ['ClassLoader', row.servletClassLoaderClassName]
  ]
})
</script>

<style scoped>
@import '@/styles/container-list-shared.css';
</style>
