<template>
  <div class="container-asset-list">
    <ContainerAssetPanel
      title="Valve 列表"
      :total="valves.length"
      :filtered="filteredValves.length"
    >
      <el-table
        :data="pagedValves"
        height="100%"
        class="asset-table"
        :empty-text="valves.length ? '未找到匹配的组件' : '暂无组件'"
      >
        <el-table-column
          label="所在容器"
          min-width="145"
        >
          <template #default="{ row }">
            <span
              :title="row.containerClassName"
              class="mono-text asset-paths"
            >{{ row.containerClassName?.split('.').pop() || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column
          label="Valve 类名"
          min-width="230"
        >
          <template #default="{ row }">
            <button
              type="button"
              class="asset-name-button mono-text"
              :title="row.valveClassName"
              @click="viewDetail(row)"
            >
              {{ row.valveClassName || '-' }}
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
              :class-name="row.valveClassName || ''"
              :loading="removingIds.has(row.valveId)"
              :removable="props.removable && Boolean(row.valveId)"
              @view="viewDetail(row)"
              @bytecode="emit('view-bytecode', row.valveClassName)"
              @remove="handleRemove(row)"
            />
          </template>
        </el-table-column>
      </el-table>
      <div
        v-if="filteredValves.length > pageSize"
        class="pagination-wrapper"
      >
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          layout="prev, pager, next"
          :total="filteredValves.length"
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
  valves: {
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
  componentType: 'valve',
  label: 'Valve'
})

const { currentPage, pageSize, filteredItems: filteredValves, pagedItems: pagedValves } =
  useContainerAssetList(() => props.valves, item => [item.valveClassName, item.containerClassName, item.valveClassLoaderName, item.valveId], toRef(props, 'searchKeyword'))

/**
 * 移除 Valve（仅 Tomcat）
 */
const handleRemove = async (valve) => {
  if (!valve.valveId) {
    showWarning('Valve 信息不完整，缺少移除条件（缺少 valveId）')
    return
  }

  const displayClassName = valve.valveClassName || '未知 Valve'
  const displayContainerName = valve.containerClassName || '未知容器'

  await removeComponent(valve.valveId, valve.valveId, {
    title: '确认移除 Valve',
    message: `确定要移除以下 Valve 吗？\n\nValve 类名: ${displayClassName}\n容器类名: ${displayContainerName}\n\n仅在中间件为 Tomcat 时生效，此操作会立即从 Pipeline 中移除该 Valve，请谨慎操作！`,
    confirmButtonText: '确定移除'
  })
}

const viewDetail = row => emit('view-detail', {
  title: 'Valve 详情',
  className: row.valveClassName,
  fields: [
    ['Context', props.contextName],
    ['类名', row.valveClassName],
    ['所在容器', row.containerClassName],
    ['ClassLoader', row.valveClassLoaderName],
    ['Valve ID', row.valveId]
  ]
})
</script>

<style scoped>
@import '@/styles/container-list-shared.css';
</style>
