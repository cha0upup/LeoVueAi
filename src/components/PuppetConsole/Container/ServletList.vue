<template>
  <div class="servlet-list-container">
    <ContainerAssetPanel
      title="Servlet 入口"
      :icon="iconMap.code"
      :total="servlets.length"
      :filtered="filteredServlets.length"
    >
      <template #toolbar>
        <el-input
          v-model="searchKeyword"
          placeholder="搜索 URL、类名、包装器名称"
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
            :data="pagedServlets"
            stripe
            style="width: 100%"
            height="100%"
            class="asset-table"
            :empty-text="servlets.length === 0 ? '该Context暂无Servlet' : '未找到匹配的Servlet'"
          >
            <el-table-column
              prop="url"
              label="URL模式"
              min-width="200"
            >
              <template #default="{ row }">
                <el-tag
                  class="url-pattern-tag"
                  size="small"
                  effect="plain"
                >
                  {{ row.url || '-' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              prop="wrapperName"
              label="包装器名称"
              min-width="150"
            >
              <template #default="{ row }">
                <span class="mono-text">{{ row.wrapperName || '-' }}</span>
              </template>
            </el-table-column>
            <el-table-column
              prop="servletClass"
              label="Servlet类名"
              min-width="260"
            >
              <template #default="{ row }">
                <div
                  v-if="row.servletClass"
                  class="servlet-class-cell"
                >
                  <el-tooltip
                    :content="row.servletClass"
                    placement="top"
                  >
                    <span class="mono-text servlet-class">{{ row.servletClass }}</span>
                  </el-tooltip>
                  <el-button
                    type="primary"
                    link
                    size="small"
                    style="margin-left: 8px"
                    @click="handleViewBytecode(row.servletClass)"
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
              prop="servletClassLoaderClassName"
              label="ClassLoader"
              min-width="260"
            >
              <template #default="{ row }">
                <span class="mono-text">
                  {{ row.servletClassLoaderClassName || '-' }}
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
                  :loading="removingIds.has(row.wrapperName)"
                  :disabled="!props.removable || removingIds.has(row.wrapperName)"
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
            v-if="filteredServlets.length > pageSize"
            class="pagination-wrapper"
          >
            <el-pagination
              v-model:current-page="currentPage"
              :page-size="pageSize"
              layout="prev, pager, next, jumper"
              :total="filteredServlets.length"
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
  servlets: {
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
  componentType: 'servlet',
  label: 'Servlet'
})
const bytecodeDialogVisible = ref(false)
const selectedClassName = ref('')

// 计算属性 - 过滤后的Servlet列表
const filteredServlets = computed(() => {
  if (!searchKeyword.value.trim()) {
    return props.servlets
  }

  const keyword = searchKeyword.value.toLowerCase().trim()
  return props.servlets.filter((servlet) => {
    const url = (servlet.url || '').toLowerCase()
    const wrapperName = (servlet.wrapperName || '').toLowerCase()
    const servletClass = (servlet.servletClass || '').toLowerCase()

    return url.includes(keyword) || wrapperName.includes(keyword) || servletClass.includes(keyword)
  })
})

// 当前页数据
const pagedServlets = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredServlets.value.slice(start, start + pageSize.value)
})

watch(searchKeyword, () => {
  currentPage.value = 1
})

// 方法
/**
 * 移除Servlet
 */
const handleRemove = async (servlet) => {
  if (!servlet.wrapperName || !servlet.url) {
    showWarning('Servlet信息不完整，缺少移除条件')
    return
  }

  const displayContextName = props.contextName || 'ROOT'
  const confirmed = await confirmAction({
    title: '确认移除Servlet',
    message: `确定要移除以下Servlet吗？\n\nContext: ${displayContextName}\nURL: ${servlet.url}\n包装器: ${servlet.wrapperName}\n类名: ${servlet.servletClass}\n\n此操作会立即生效，请谨慎操作！`,
    confirmButtonText: '确定移除'
  })
  if (!confirmed) return

  await removeComponent(servlet.wrapperName, servlet.url)
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

.servlet-list-container {
  display: flex;
  flex-direction: column;
  gap: var(--el-spacing-base);
  height: 100%;
  padding-top: 0;
}

/* Servlet类名样式 */
.servlet-class-cell {
  display: flex;
  align-items: center;
}

.servlet-class {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}
</style>
