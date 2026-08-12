<template>
  <el-dialog
    :model-value="visible"
    title="新建表"
    width="50vw"
    :close-on-click-modal="false"
    destroy-on-close
    class="create-table-dialog"
    @update:model-value="$emit('update:visible', $event)"
    @close="handleClose"
  >
    <el-form
      :model="formData"
      label-width="6.25rem"
    >
      <el-form-item label="数据库">
        <el-input
          v-model="formData.database"
          disabled
        />
      </el-form-item>
      <el-form-item
        label="表名"
        required
      >
        <el-input
          v-model="formData.tableName"
          placeholder="请输入表名"
        />
      </el-form-item>
      <el-form-item label="字段定义">
        <div class="columns-table-wrapper">
          <el-table
            :data="formData.columns"
            border
            class="columns-table"
          >
            <el-table-column
              label="字段名"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                <el-input
                  v-model="row.name"
                  placeholder="字段名"
                  size="small"
                  class="table-input"
                />
              </template>
            </el-table-column>
            <el-table-column
              label="数据类型"
              show-overflow-tooltip
            >
              <template #default="{ row, $index }">
                <el-select
                  v-model="row.baseType"
                  placeholder="选择类型"
                  size="small"
                  class="table-select"
                  @change="onTypeChange($index)"
                >
                  <el-option
                    v-for="type in dataTypeOptions"
                    :key="type.value"
                    :label="type.label"
                    :value="type.value"
                  />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column
              label="长度/精度"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                <el-input
                  v-if="
                    getTypeDefaults(row.baseType).hasLength ||
                      getTypeDefaults(row.baseType).hasPrecision
                  "
                  v-model="row.typeParams"
                  placeholder="如: 255"
                  size="small"
                  class="table-input"
                />
                <span
                  v-else
                  class="empty-placeholder"
                >-</span>
              </template>
            </el-table-column>
            <el-table-column
              label="允许NULL"
              align="center"
            >
              <template #default="{ row }">
                <div class="switch-wrapper">
                  <el-switch
                    v-model="row.nullable"
                    size="small"
                  />
                </div>
              </template>
            </el-table-column>
            <el-table-column
              label="主键"
              align="center"
            >
              <template #default="{ row }">
                <div class="switch-wrapper">
                  <el-switch
                    v-model="row.primaryKey"
                    size="small"
                  />
                </div>
              </template>
            </el-table-column>
            <el-table-column
              label="默认值"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                <el-input
                  v-model="row.default"
                  placeholder="默认值"
                  size="small"
                  class="table-input"
                />
              </template>
            </el-table-column>
            <el-table-column
              label="操作"
              align="center"
              fixed="right"
            >
              <template #default="{ $index }">
                <el-button
                  type="danger"
                  size="small"
                  text
                  :aria-label="`删除字段 ${$index + 1}`"
                  :disabled="formData.columns.length <= 1"
                  @click="removeColumn($index)"
                >
                  <el-icon><Icon :icon="iconMap.delete" /></el-icon>
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
        <el-button
          type="primary"
          size="small"
          class="add-column-btn"
          @click="addColumn"
        >
          <el-icon><Icon :icon="iconMap.plus" /></el-icon>
          添加字段
        </el-button>
      </el-form-item>
    </el-form>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button
          type="primary"
          :loading="loading"
          @click="confirmCreate"
        > 确认创建 </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'

import { icons } from '@/utils/icons.js'
import sqlEngine from './SqlEngine.js'
import { showError, showSuccess, showWarning } from '@/utils/messageUtils.js'
import { formatDatabaseError } from '@/utils/databaseError.js'

const iconMap = icons

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  sessionId: {
    type: String,
    required: true
  },
  connection: {
    type: Object,
    required: true
  },
  database: {
    type: String,
    default: ''
  },
  objectRef: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:visible', 'success'])

const loading = ref(false)

const formData = reactive({
  database: '',
  tableName: '',
  columns: [
    {
      name: 'id',
      baseType: 'INT',
      typeParams: '',
      type: 'INT',
      nullable: false,
      primaryKey: true,
      default: ''
    }
  ]
})

const dataTypeOptions = computed(() => {
  if (!props.connection.dialect) return []
  return sqlEngine.getDataTypeOptions(props.connection.dialect)
})

watch(
  () => props.visible,
  (val) => {
    if (val) {
      // 重置表单
      formData.database = props.database
      formData.tableName = ''
      formData.columns = [
        {
          name: 'id',
          baseType: 'INT',
          typeParams: '',
          type: 'INT',
          nullable: false,
          primaryKey: true,
          default: ''
        }
      ]
    }
  }
)

const getTypeDefaults = (dataType) => {
  if (!dataType) return { hasLength: false }
  return sqlEngine.getDataTypeDefaults(props.connection.dialect, dataType)
}

const onTypeChange = (columnIndex) => {
  const column = formData.columns[columnIndex]
  const defaults = getTypeDefaults(column.baseType)

  if (defaults.hasLength && !column.typeParams) {
    column.typeParams = defaults.defaultLength
  } else if (defaults.hasPrecision && !column.typeParams) {
    column.typeParams = defaults.defaultPrecision
  }

  if (defaults.hasLength || defaults.hasPrecision) {
    column.type = `${column.baseType}(${column.typeParams})`
  } else {
    column.type = column.baseType
  }
}

const addColumn = () => {
  formData.columns.push({
    name: '',
    baseType: 'VARCHAR',
    typeParams: '255',
    type: 'VARCHAR(255)',
    nullable: true,
    primaryKey: false,
    default: ''
  })
}

const removeColumn = (index) => {
  if (formData.columns.length > 1) {
    formData.columns.splice(index, 1)
  }
}

const handleClose = () => {
  emit('update:visible', false)
}

const confirmCreate = async () => {
  // 验证
  if (!formData.tableName) {
    showWarning('请输入表名')
    return
  }

  if (!formData.database) {
    showWarning('请选择数据库')
    return
  }

  if (formData.columns.length === 0) {
    showWarning('请至少添加一个字段')
    return
  }

  // 验证字段
  for (const col of formData.columns) {
    if (!col.name) {
      showWarning('请填写所有字段名')
      return
    }
    if (!col.baseType) {
      showWarning('请选择所有字段的数据类型')
      return
    }
  }

  loading.value = true
  try {
    const columns = formData.columns.map((col) => {
      return {
        name: col.name,
        type: col.typeParams ? `${col.baseType}(${col.typeParams})` : col.baseType,
        nullable: col.nullable,
        primaryKey: col.primaryKey,
        defaultValue: col.default || null
      }
    })

    const params = {
      sessionId: props.sessionId,
      connection: props.connection,
      objectRef: props.objectRef
        ? { ...props.objectRef, name: formData.tableName, kind: 'table' }
        : null,
      columns
    }

    await sqlEngine.createTable(params)

    showSuccess('表创建成功')
    emit('update:visible', false)
    emit('success')
  } catch (error) {
    showError(formatDatabaseError(error, '创建表失败'))
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.create-table-dialog {
  --create-table-muted-surface: var(--app-control-background-soft);
}

:global(html:not(.dark) .create-table-dialog),
:global(html[data-theme='light'] .create-table-dialog) {
  --create-table-muted-surface: #f2f2f2;
}

.create-table-dialog :deep(.el-dialog__header) {
  background: var(--create-table-muted-surface);
  border-bottom: 1px solid var(--el-border-color-light);
}

.create-table-dialog :deep(.el-dialog__footer) {
  background: var(--create-table-muted-surface);
  border-top: 1px solid var(--el-border-color-light);
}

.dialog-footer {
  text-align: right;
}

/* 字段定义表格容器 */
.columns-table-wrapper {
  width: 100%;
  overflow-x: auto;
  margin-bottom: 0.625rem;
  padding: var(--el-spacing-base);
  border-radius: var(--el-border-radius-small);
  background: var(--create-table-muted-surface);
}

/* Switch 组件居中包装器 */
.switch-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

/* 空占位符 */
.empty-placeholder {
  color: var(--el-text-color-placeholder);
  font-style: italic;
  display: inline-block;
  width: 100%;
  text-align: center;
}

/* 添加字段按钮 */
.add-column-btn {
  margin-top: 0.625rem;
}
</style>
