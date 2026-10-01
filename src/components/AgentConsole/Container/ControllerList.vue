<template>
  <div class="container-asset-list">
    <ContainerAssetPanel
      title="Controller 列表"
      :total="controllers.length"
      :filtered="filteredControllers.length"
    >
      <el-table
        :data="pagedControllers"
        height="100%"
        class="asset-table"
        :empty-text="controllers.length ? '未找到匹配的组件' : '暂无组件'"
      >
        <el-table-column
          label="路径 / 映射"
          min-width="150"
        >
          <template #default="{ row }">
            <span class="mono-text asset-paths">{{ row.directPaths?.join('\n') || row.mappingInfo || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column
          label="控制器 / 方法"
          min-width="230"
        >
          <template #default="{ row }">
            <button
              type="button"
              class="asset-name-button mono-text"
              :title="getClassName(row.description)"
              @click="viewDetail(row)"
            >
              {{ getClassName(row.description) || '-' }}
            </button>
            <span class="asset-secondary mono-text">{{ getMethodName(row.description) }}</span>
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
              :class-name="getClassName(row.description) || ''"
              :loading="removingIds.has(row.mappingInfo)"
              :removable="props.removable && Boolean(row.mappingInfo)"
              @view="viewDetail(row)"
              @bytecode="emit('view-bytecode', getClassName(row.description))"
              @remove="handleRemove(row)"
            />
          </template>
        </el-table-column>
      </el-table>
      <div
        v-if="filteredControllers.length > pageSize"
        class="pagination-wrapper"
      >
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          layout="prev, pager, next"
          :total="filteredControllers.length"
          small
        />
      </div>
    </ContainerAssetPanel>
  </div>
</template>

<script setup>
import { toRef } from 'vue'
import { useContainerAssetList } from './useContainerAssetList.js'
import { getControllerClassName as getClassName, getControllerMethodName as getMethodName } from './containerManageModel.js'
import ContainerAssetPanel from './ContainerAssetPanel.vue'
import ContainerAssetActions from './ContainerAssetActions.vue'
import { useWebRuntimeComponentRemoval } from './useWebRuntimeComponentRemoval.js'
import { showWarning } from '@/utils/messageUtils.js'

// Props
const props = defineProps({
  searchKeyword: { type: String, default: '' },
  controllers: {
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
  componentType: 'controller',
  label: 'Controller'
})

const { currentPage, pageSize, filteredItems: filteredControllers, pagedItems: pagedControllers } =
  useContainerAssetList(() => props.controllers, item => [item.mappingName, item.description, getClassName(item.description), getMethodName(item.description), item.directPaths, item.mappingInfo], toRef(props, 'searchKeyword'))

/**
 * 移除Controller
 */
const handleRemove = async (controller) => {
  if (!controller.mappingInfo) {
    showWarning('Controller映射信息不完整，缺少移除条件')
    return
  }

  const displayName = controller.mappingName || '未知控制器'
  const displayPaths = controller.directPaths?.join(', ') || '未知路径'
  const displayMappingInfo = controller.mappingInfo || ''

  await removeComponent(controller.mappingInfo, controller.mappingInfo, {
    title: '确认移除Controller',
    message: `确定要移除以下Controller吗？\n\n映射名称: ${displayName}\n路径: ${displayPaths}\n映射信息: ${displayMappingInfo}\n\n此操作会立即生效，该Controller的所有HTTP端点将无法访问，请谨慎操作！`,
    confirmButtonText: '确定移除'
  })
}

const viewDetail = row => emit('view-detail', {
  title: 'Controller 详情',
  className: getClassName(row.description),
  fields: [
    ['Context', props.contextName],
    ['映射名称', row.mappingName],
    ['路径', row.directPaths],
    ['映射信息', row.mappingInfo],
    ['类名', getClassName(row.description)],
    ['方法', getMethodName(row.description)],
    ['完整描述', row.description]
  ]
})
</script>

<style scoped>
@import '@/styles/container-list-shared.css';
</style>
