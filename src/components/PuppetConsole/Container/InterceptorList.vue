<template>
  <div class="interceptor-list-container">
    <ContainerAssetPanel
      title="Interceptor 链"
      :icon="iconMap.shield"
      :total="interceptors.length"
      :filtered="filteredInterceptors.length"
    >
      <template #toolbar>
        <el-input
          v-model="searchKeyword"
          placeholder="搜索名称、路径模式、排除路径"
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
            :data="pagedInterceptors"
            stripe
            style="width: 100%"
            height="100%"
            class="asset-table"
            :empty-text="interceptors.length === 0 ? '暂无拦截器信息' : '未找到匹配的拦截器'"
          >
            <el-table-column
              prop="interceptorName"
              label="拦截器类名"
              min-width="300"
            >
              <template #default="{ row }">
                <div
                  v-if="row.interceptorName"
                  class="interceptor-class-cell"
                >
                  <el-tooltip
                    :content="row.interceptorName"
                    placement="top"
                  >
                    <span class="mono-text interceptor-class">{{ row.interceptorName }}</span>
                  </el-tooltip>
                  <el-button
                    type="primary"
                    link
                    size="small"
                    style="margin-left: 8px"
                    @click="handleViewBytecode(row.interceptorName)"
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
              prop="pathPatterns"
              label="路径模式"
              min-width="200"
            >
              <template #default="{ row }">
                <div class="path-patterns">
                  <el-tag
                    v-for="(pattern, index) in getPathPatternsArray(row.pathPatterns)"
                    :key="index"
                    type="primary"
                    size="small"
                    style="margin: 2px"
                  >
                    {{ pattern }}
                  </el-tag>
                  <span
                    v-if="
                      !getPathPatternsArray(row.pathPatterns) ||
                        getPathPatternsArray(row.pathPatterns).length === 0
                    "
                    class="text-muted"
                  >
                    -
                  </span>
                </div>
              </template>
            </el-table-column>
            <el-table-column
              prop="excludePatterns"
              label="排除路径"
              min-width="200"
            >
              <template #default="{ row }">
                <div class="exclude-patterns">
                  <el-tag
                    v-for="(pattern, index) in row.excludePatterns"
                    :key="index"
                    type="warning"
                    size="small"
                    style="margin: 2px"
                  >
                    {{ pattern }}
                  </el-tag>
                  <span
                    v-if="!row.excludePatterns || row.excludePatterns.length === 0"
                    class="text-muted"
                  >
                    -
                  </span>
                </div>
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
                  :loading="removingIds.has(row.interceptorId)"
                  :disabled="!props.removable || removingIds.has(row.interceptorId) || !row.interceptorId"
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
            v-if="filteredInterceptors.length > pageSize"
            class="pagination-wrapper"
          >
            <el-pagination
              v-model:current-page="currentPage"
              :page-size="pageSize"
              layout="prev, pager, next, jumper"
              :total="filteredInterceptors.length"
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
  interceptors: {
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
  componentType: 'interceptor',
  label: 'Interceptor'
})
const bytecodeDialogVisible = ref(false)
const selectedClassName = ref('')

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

// 计算属性 - 过滤后的拦截器列表
const filteredInterceptors = computed(() => {
  if (!searchKeyword.value.trim()) {
    return props.interceptors
  }

  const keyword = searchKeyword.value.toLowerCase().trim()
  return props.interceptors.filter((interceptor) => {
    const interceptorName = (interceptor.interceptorName || '').toLowerCase()
    const pathPatterns = getPathPatternsArray(interceptor.pathPatterns).join(' ').toLowerCase()
    const excludePatterns = (interceptor.excludePatterns || []).join(' ').toLowerCase()

    return (
      interceptorName.includes(keyword) ||
      pathPatterns.includes(keyword) ||
      excludePatterns.includes(keyword)
    )
  })
})

// 当前页数据
const pagedInterceptors = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredInterceptors.value.slice(start, start + pageSize)
})

watch(searchKeyword, () => {
  currentPage.value = 1
})

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

  const confirmed = await confirmAction({
    title: '确认移除Interceptor',
    message: `确定要移除以下Interceptor吗？\n\n拦截器类名: ${displayName}\n路径模式: ${displayPathPatterns}\n排除路径: ${displayExcludePatterns}\n拦截器ID: ${interceptor.interceptorId}\n\n此操作会立即生效，该拦截器将不再拦截任何请求，请谨慎操作！`,
    confirmButtonText: '确定移除'
  })
  if (!confirmed) return

  await removeComponent(interceptor.interceptorId, interceptor.interceptorId)
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

.interceptor-list-container {
  display: flex;
  flex-direction: column;
  gap: var(--el-spacing-base);
  height: 100%;
}

/* 路径模式容器 */
.path-patterns,
.exclude-patterns {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.interceptor-class-cell {
  display: flex;
  align-items: center;
}

.interceptor-class {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}
</style>
