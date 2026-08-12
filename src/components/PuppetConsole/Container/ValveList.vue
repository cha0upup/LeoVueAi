<template>
  <div class="valve-list-container">
    <ContainerAssetPanel
      title="Valve 管道扩展"
      :icon="iconMap.shield"
      :total="valves.length"
      :filtered="filteredValves.length"
    >
      <template #toolbar>
        <el-input
          v-model="searchKeyword"
          placeholder="搜索类名、容器类名、ID"
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
            :data="pagedValves"
            stripe
            style="width: 100%"
            height="100%"
            class="asset-table"
            :empty-text="valves.length === 0 ? '该Context暂无Valve' : '未找到匹配的Valve'"
          >
            <el-table-column
              prop="valveClassName"
              label="Valve类名"
              min-width="260"
            >
              <template #default="{ row }">
                <div
                  v-if="row.valveClassName"
                  class="valve-class-cell"
                >
                  <el-tooltip
                    :content="row.valveClassName"
                    placement="top"
                  >
                    <span class="mono-text valve-class">{{ row.valveClassName }}</span>
                  </el-tooltip>
                  <el-button
                    type="primary"
                    link
                    size="small"
                    style="margin-left: 8px"
                    @click="handleViewBytecode(row.valveClassName)"
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
                > - </span>
              </template>
            </el-table-column>
            <el-table-column
              prop="containerClassName"
              label="容器类名"
              min-width="260"
            >
              <template #default="{ row }">
                <span class="mono-text">
                  {{ row.containerClassName || '-' }}
                </span>
              </template>
            </el-table-column>
            <el-table-column
              prop="valveClassLoaderName"
              label="ClassLoader"
              min-width="260"
            >
              <template #default="{ row }">
                <span class="mono-text">
                  {{ row.valveClassLoaderName || '-' }}
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
                  :loading="removingIds.has(row.valveId)"
                  :disabled="!props.removable || removingIds.has(row.valveId) || !row.valveId"
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
            v-if="filteredValves.length > pageSize"
            class="pagination-wrapper"
          >
            <el-pagination
              v-model:current-page="currentPage"
              :page-size="pageSize"
              layout="prev, pager, next, jumper"
              :total="filteredValves.length"
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
  valves: {
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
const bytecodeDialogVisible = ref(false)
const selectedClassName = ref('')
const { removingIds, removeComponent } = useWebRuntimeComponentRemoval({
  props,
  emit,
  componentType: 'valve',
  label: 'Valve'
})

// 计算属性 - 过滤后的 Valve 列表
const filteredValves = computed(() => {
  if (!searchKeyword.value.trim()) {
    return props.valves
  }

  const keyword = searchKeyword.value.toLowerCase().trim()
  return props.valves.filter((valve) => {
    const valveClassName = (valve.valveClassName || '').toLowerCase()
    const containerClassName = (valve.containerClassName || '').toLowerCase()
    const classLoaderName = (valve.valveClassLoaderName || '').toLowerCase()
    const valveId = (valve.valveId || '').toLowerCase()

    return (
      valveClassName.includes(keyword) ||
      containerClassName.includes(keyword) ||
      classLoaderName.includes(keyword) ||
      valveId.includes(keyword)
    )
  })
})

// 当前页数据
const pagedValves = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredValves.value.slice(start, start + pageSize.value)
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
 * 移除 Valve（仅 Tomcat）
 */
const handleRemove = async (valve) => {
  if (!valve.valveId) {
    showWarning('Valve 信息不完整，缺少移除条件（缺少 valveId）')
    return
  }

  const displayClassName = valve.valveClassName || '未知 Valve'
  const displayContainerName = valve.containerClassName || '未知容器'

  const confirmed = await confirmAction({
    title: '确认移除 Valve',
    message: `确定要移除以下 Valve 吗？\n\nValve 类名: ${displayClassName}\n容器类名: ${displayContainerName}\n\n仅在中间件为 Tomcat 时生效，此操作会立即从 Pipeline 中移除该 Valve，请谨慎操作！`,
    confirmButtonText: '确定移除'
  })
  if (!confirmed) return

  await removeComponent(valve.valveId, valve.valveId)
}
</script>

<style scoped>
@import '@/styles/container-list-shared.css';

.valve-list-container {
  display: flex;
  flex-direction: column;
  gap: var(--el-spacing-base);
  height: 100%;
}

/* Valve 类名单元格，限制展示长度，超出省略号 */
.valve-class-cell {
  display: flex;
  align-items: center;
}

.valve-class {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}
</style>
