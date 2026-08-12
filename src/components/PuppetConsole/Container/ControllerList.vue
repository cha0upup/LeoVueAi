<template>
  <div class="controller-list-container">
    <ContainerAssetPanel
      title="Spring 控制器"
      :icon="iconMap.code"
      :total="controllers.length"
      :filtered="filteredControllers.length"
    >
      <template #toolbar>
        <el-input
          v-model="searchKeyword"
          placeholder="搜索路径、映射名称、类名、方法名"
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
            :data="pagedControllers"
            stripe
            style="width: 100%"
            height="100%"
            class="asset-table"
            :empty-text="controllers.length === 0 ? '暂无控制器信息' : '未找到匹配的控制器'"
          >
            <el-table-column
              prop="mappingName"
              label="映射名称"
              min-width="150"
            >
              <template #default="{ row }">
                <el-tag
                  type="primary"
                  size="small"
                >
                  {{ row.mappingName || '-' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              prop="directPaths"
              label="路径"
              min-width="200"
            >
              <template #default="{ row }">
                <div class="path-list">
                  <el-tag
                    v-for="(path, index) in row.directPaths"
                    :key="index"
                    type="success"
                    size="small"
                    style="margin: 2px"
                  >
                    {{ path }}
                  </el-tag>
                  <span
                    v-if="!row.directPaths || row.directPaths.length === 0"
                    class="text-muted"
                  >
                    -
                  </span>
                </div>
              </template>
            </el-table-column>
            <el-table-column
              prop="mappingInfo"
              label="映射信息"
              min-width="250"
            >
              <template #default="{ row }">
                <el-tooltip
                  v-if="row.mappingInfo"
                  :content="row.mappingInfo || '-'"
                  placement="top"
                >
                  <span class="mono-text mapping-info">{{ row.mappingInfo }}</span>
                </el-tooltip>
                <span
                  v-else
                  class="text-muted"
                >-</span>
              </template>
            </el-table-column>
            <el-table-column
              prop="className"
              label="类名"
              min-width="300"
            >
              <template #default="{ row }">
                <div
                  v-if="row.description && getClassName(row.description)"
                  class="class-name-cell"
                >
                  <el-tooltip
                    :content="getClassName(row.description)"
                    placement="top"
                  >
                    <span class="mono-text class-name">{{ getClassName(row.description) }}</span>
                  </el-tooltip>
                  <el-button
                    type="primary"
                    link
                    size="small"
                    style="margin-left: 8px"
                    @click="handleViewBytecode(getClassName(row.description))"
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
              prop="methodName"
              label="方法名"
              min-width="250"
            >
              <template #default="{ row }">
                <el-tooltip
                  v-if="row.description"
                  :content="getMethodName(row.description)"
                  placement="top"
                >
                  <span class="mono-text method-name">{{ getMethodName(row.description) }}</span>
                </el-tooltip>
                <span
                  v-else
                  class="text-muted"
                >-</span>
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
                  :loading="removingIds.has(row.mappingInfo)"
                  :disabled="!props.removable || removingIds.has(row.mappingInfo) || !row.mappingInfo"
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
            v-if="filteredControllers.length > pageSize"
            class="pagination-wrapper"
          >
            <el-pagination
              v-model:current-page="currentPage"
              :page-size="pageSize"
              layout="prev, pager, next, jumper"
              :total="filteredControllers.length"
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
  controllers: {
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
  componentType: 'controller',
  label: 'Controller'
})
const bytecodeDialogVisible = ref(false)
const selectedClassName = ref('')

// 计算属性 - 过滤后的控制器列表
const filteredControllers = computed(() => {
  if (!searchKeyword.value.trim()) {
    return props.controllers
  }

  const keyword = searchKeyword.value.toLowerCase().trim()
  return props.controllers.filter((controller) => {
    const mappingName = (controller.mappingName || '').toLowerCase()
    const description = (controller.description || '').toLowerCase()
    const className = getClassName(controller.description || '').toLowerCase()
    const methodName = getMethodName(controller.description || '').toLowerCase()
    const directPaths = (controller.directPaths || []).join(' ').toLowerCase()
    const mappingInfo = (controller.mappingInfo || '').toLowerCase()

    return (
      mappingName.includes(keyword) ||
      description.includes(keyword) ||
      className.includes(keyword) ||
      methodName.includes(keyword) ||
      directPaths.includes(keyword) ||
      mappingInfo.includes(keyword)
    )
  })
})

// 当前页数据
const pagedControllers = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredControllers.value.slice(start, start + pageSize.value)
})

watch(searchKeyword, () => {
  currentPage.value = 1
})

/**
 * 从描述中提取类名
 * 支持两种格式：
 * 1) "com.example.Controller#method()" -> "com.example.Controller"
 * 2) "public WeaResult<?> com.xxx.Controller.saveSignAddrsInfo(...)" -> "com.xxx.Controller"
 */
const getClassName = (description) => {
  if (!description) return ''

  // 旧格式：Class#method()
  const hashIndex = description.indexOf('#')
  if (hashIndex !== -1) {
    return description.substring(0, hashIndex)
  }

  // 新格式：包含返回值 + 完整方法签名
  // 示例：
  // public WeaResult<?> com.xxx.CalendarPapiController.saveSignAddrsInfo(com.xxx.CalendarPapiController$AddrsInfoEntry)
  const firstParenIndex = description.indexOf('(')
  const signaturePart =
    firstParenIndex !== -1 ? description.substring(0, firstParenIndex) : description

  // 找到最后一个空格，之后应该是 fully-qualified method name：com.xxx.Controller.methodName
  const lastSpaceIndex = signaturePart.lastIndexOf(' ')
  if (lastSpaceIndex === -1 || lastSpaceIndex === signaturePart.length - 1) {
    return description
  }

  const fqMethod = signaturePart.substring(lastSpaceIndex + 1).trim()
  const lastDotIndex = fqMethod.lastIndexOf('.')
  if (lastDotIndex === -1) {
    return fqMethod
  }

  return fqMethod.substring(0, lastDotIndex)
}

/**
 * 从描述中提取方法名（含参数部分）
 * 支持两种格式：
 * 1) "com.example.Controller#method()" -> "method()"
 * 2) "public WeaResult<?> com.xxx.Controller.saveSignAddrsInfo(...)" -> "saveSignAddrsInfo(...)"
 */
const getMethodName = (description) => {
  if (!description) return ''

  // 旧格式：Class#method()
  const hashIndex = description.indexOf('#')
  if (hashIndex !== -1) {
    return description.substring(hashIndex + 1)
  }

  // 新格式：返回值 + 完整方法签名
  const firstParenIndex = description.indexOf('(')
  if (firstParenIndex === -1) {
    return ''
  }

  const signaturePart = description.substring(0, firstParenIndex)
  const paramsPart = description.substring(firstParenIndex) // 包含括号和参数

  const lastSpaceIndex = signaturePart.lastIndexOf(' ')
  if (lastSpaceIndex === -1 || lastSpaceIndex === signaturePart.length - 1) {
    return signaturePart + paramsPart
  }

  const fqMethod = signaturePart.substring(lastSpaceIndex + 1).trim()
  const lastDotIndex = fqMethod.lastIndexOf('.')
  const methodSimpleName = lastDotIndex === -1 ? fqMethod : fqMethod.substring(lastDotIndex + 1)

  return methodSimpleName + paramsPart
}

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

  const confirmed = await confirmAction({
    title: '确认移除Controller',
    message: `确定要移除以下Controller吗？\n\n映射名称: ${displayName}\n路径: ${displayPaths}\n映射信息: ${displayMappingInfo}\n\n此操作会立即生效，该Controller的所有HTTP端点将无法访问，请谨慎操作！`,
    confirmButtonText: '确定移除'
  })
  if (!confirmed) return

  await removeComponent(controller.mappingInfo, controller.mappingInfo)
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

.controller-list-container {
  display: flex;
  flex-direction: column;
  gap: var(--el-spacing-base);
  height: 100%;
}

/* 路径列表 */
.path-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.class-name-cell {
  display: flex;
  align-items: center;
}

.class-name,
.method-name,
.mapping-info {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}
</style>
