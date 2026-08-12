<template>
  <div class="filter-list-container">
    <ContainerAssetPanel
      title="Filter 链路"
      :icon="iconMap.filter"
      :total="filters.length"
      :filtered="filteredFilters.length"
    >
      <template #toolbar>
        <el-input
          v-model="searchKeyword"
          placeholder="搜索名称、类名、URL模式"
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
            :data="pagedFilters"
            stripe
            style="width: 100%"
            height="100%"
            class="asset-table"
            :empty-text="filters.length === 0 ? '该Context暂无Filter' : '未找到匹配的Filter'"
          >
            <el-table-column
              prop="filterName"
              label="Filter名称"
              min-width="180"
            >
              <template #default="{ row }">
                <el-tag
                  type="warning"
                  size="small"
                >
                  {{ row.filterName || '-' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              prop="filterClassName"
              label="Filter类名"
              min-width="260"
            >
              <template #default="{ row }">
                <div
                  v-if="row.filterClassName"
                  class="filter-class-cell"
                >
                  <el-tooltip
                    :content="row.filterClassName"
                    placement="top"
                  >
                    <span class="mono-text filter-class">{{ row.filterClassName }}</span>
                  </el-tooltip>
                  <el-button
                    type="primary"
                    link
                    size="small"
                    style="margin-left: 8px"
                    @click="handleViewBytecode(row.filterClassName)"
                  >
                    <el-icon>
                      <Icon :icon="iconMap.code" />
                    </el-icon>
                    查看字节码
                  </el-button>
                </div>
                <span
                  v-else
                  class="text-muted"
                >-</span>
              </template>
            </el-table-column>
            <el-table-column
              prop="urlPatterns"
              label="URL模式"
              min-width="200"
            >
              <template #default="{ row }">
                <div class="url-patterns">
                  <el-tag
                    v-for="(pattern, index) in row.urlPatterns"
                    :key="index"
                    type="primary"
                    size="small"
                    style="margin: 2px"
                  >
                    {{ pattern }}
                  </el-tag>
                  <span
                    v-if="!row.urlPatterns || row.urlPatterns.length === 0"
                    class="text-muted"
                  >
                    -
                  </span>
                </div>
              </template>
            </el-table-column>
            <el-table-column
              prop="servletNames"
              label="关联Servlet"
              min-width="180"
            >
              <template #default="{ row }">
                <div class="servlet-names">
                  <el-tag
                    v-for="(name, index) in row.servletNames"
                    :key="index"
                    type="success"
                    size="small"
                    style="margin: 2px"
                  >
                    {{ name }}
                  </el-tag>
                  <span
                    v-if="!row.servletNames || row.servletNames.length === 0"
                    class="text-muted"
                  >
                    无
                  </span>
                </div>
              </template>
            </el-table-column>
            <el-table-column
              prop="filterClassLoaderName"
              label="ClassLoader"
              min-width="260"
            >
              <template #default="{ row }">
                <span class="mono-text">
                  {{ row.filterClassLoaderName || '-' }}
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
                  :loading="removingIds.has(row.filterName)"
                  :disabled="!props.removable || removingIds.has(row.filterName)"
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
            v-if="filteredFilters.length > pageSize"
            class="pagination-wrapper"
          >
            <el-pagination
              v-model:current-page="currentPage"
              :page-size="pageSize"
              layout="prev, pager, next, jumper"
              :total="filteredFilters.length"
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
  filters: {
    type: Array,
    default: () => []
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
const emit = defineEmits(['refresh'])

// 响应式数据
const searchKeyword = ref('')
const currentPage = ref(1)
const injectedPageSize = inject('puppetListPageSize', ref(50))
const pageSize = injectedPageSize
const { removingIds, removeComponent } = useWebRuntimeComponentRemoval({
  props,
  emit,
  componentType: 'filter',
  label: 'Filter'
})
const bytecodeDialogVisible = ref(false)
const selectedClassName = ref('')

// 计算属性 - 过滤后的Filter列表
const filteredFilters = computed(() => {
  if (!searchKeyword.value.trim()) {
    return props.filters
  }

  const keyword = searchKeyword.value.toLowerCase().trim()
  return props.filters.filter((filter) => {
    const filterName = (filter.filterName || '').toLowerCase()
    const filterClassName = (filter.filterClassName || '').toLowerCase()
    const urlPatterns = (filter.urlPatterns || []).join(' ').toLowerCase()
    const servletNames = (filter.servletNames || []).join(' ').toLowerCase()

    return (
      filterName.includes(keyword) ||
      filterClassName.includes(keyword) ||
      urlPatterns.includes(keyword) ||
      servletNames.includes(keyword)
    )
  })
})

// 当前页数据
const pagedFilters = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredFilters.value.slice(start, start + pageSize.value)
})

watch(searchKeyword, () => {
  currentPage.value = 1
})

/**
 * 移除Filter
 */
const handleRemove = async (filter) => {
  if (!filter.filterName) {
    showWarning('Filter信息不完整，缺少移除条件')
    return
  }

  const displayContextName = props.contextName || 'ROOT'
  const confirmed = await confirmAction({
    title: '确认移除Filter',
    message: `确定要移除以下Filter吗？\n\nContext: ${displayContextName}\nFilter名称: ${filter.filterName}\n类名: ${filter.filterClassName}\n\n此操作会立即生效，请谨慎操作！`,
    confirmButtonText: '确定移除'
  })
  if (!confirmed) return

  await removeComponent(filter.filterName, filter.filterName)
}

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
</script>

<style scoped>
@import '@/styles/container-list-shared.css';

.filter-list-container {
  display: flex;
  flex-direction: column;
  gap: var(--el-spacing-base);
  height: 100%;
}

/* URL模式和Servlet名称容器 */
.url-patterns,
.servlet-names {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.filter-class-cell {
  display: flex;
  align-items: center;
}

.filter-class {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}
</style>
