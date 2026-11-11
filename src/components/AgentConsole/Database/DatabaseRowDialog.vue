<template>
  <el-dialog
    :model-value="visible"
    :title="editing ? '编辑数据' : '新增数据'"
    width="50vw"
    :close-on-click-modal="false"
    destroy-on-close
    :class="editing ? 'edit-row-dialog' : 'add-row-dialog'"
    @update:model-value="$emit('update:visible', $event)"
  >
    <div
      v-if="tableColumns.length > 0"
      class="dialog-content"
    >
      <el-table
        :data="tableRows"
        border
        stripe
        size="default"
        class="row-data-table"
        :max-height="500"
      >
        <el-table-column
          prop="fieldName"
          label="字段名"
          width="200"
          fixed="left"
        >
          <template #default="scope">
            <div class="field-info">
              <span class="field-name">{{ scope.row.fieldName }}</span>
              <div class="field-meta">
                <el-tag
                  :type="scope.row.nullable ? 'info' : 'danger'"
                  size="small"
                  :class="scope.row.nullable ? 'optional-tag' : 'required-tag'"
                >
                  {{ scope.row.nullable ? '可选' : '必填' }}
                </el-tag>
                <span class="field-type">{{ scope.row.type }}</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          prop="value"
          label="值"
          min-width="300"
        >
          <template #default="scope">
            <el-select
              v-if="scope.row.inputComponent === 'el-select'"
              v-model="formData[scope.row.fieldName]"
              placeholder="请选择"
              style="width: 100%"
              clearable
              size="default"
            >
              <el-option
                label="True"
                :value="true"
              />
              <el-option
                label="False"
                :value="false"
              />
              <el-option
                v-if="scope.row.nullable"
                label="NULL"
                :value="null"
              />
            </el-select>
            <component
              :is="scope.row.inputComponent"
              v-else
              v-model="formData[scope.row.fieldName]"
              v-bind="scope.row.inputProps"
              :placeholder="scope.row.nullable ? '请输入（可选）' : '请输入（必填）'"
              style="width: 100%"
              clearable
              size="default"
            />
          </template>
        </el-table-column>
      </el-table>
    </div>
    <div class="form-inline-actions">
      <el-button
        class="cancel-btn"
        size="default"
        @click="handleCancel"
      >
        <el-icon><Icon :icon="iconMap.close" /></el-icon>
        取消
      </el-button>
      <el-button
        class="submit-btn"
        type="primary"
        :loading="submitting"
        size="default"
        @click="handleConfirm"
      >
        <el-icon v-if="!submitting">
          <Icon :icon="editing ? iconMap.edit : iconMap.plus" />
        </el-icon>
        {{ submitting ? '提交中...' : editing ? '确认修改' : '确认新增' }}
      </el-button>
    </div>
  </el-dialog>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import sqlEngine from './SqlEngine.js'
import { icons as iconMap } from '@/utils/icons.js'
import { executeRequest } from '@/utils/apiUtils.js'
import {
  buildWherePayloadFromRow,
  getColumnMetaInfo,
  getInputComponentByType,
  getInputPropsByType
} from '@/utils/database.js'
import { getChangedRowValues, getTableColumnNames } from './database-table-model.js'
import { showError, showInfo, showSuccess, showWarning } from '@/utils/messageUtils.js'
import { formatDatabaseError } from '@/utils/databaseError.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  editing: { type: Boolean, default: false },
  tableColumns: { type: Array, default: () => [] },
  rowData: { type: Object, default: () => ({}) },
  originalRowData: { type: Object, default: () => ({}) },
  connection: { type: Object, required: true },
  objectRef: { type: Object, default: null },
  sessionId: { type: String, required: true }
})
const emit = defineEmits(['update:visible', 'cancel', 'success'])
const formData = reactive({})
const submitting = ref(false)
const tableRows = computed(() => props.tableColumns.map(column => {
  const fieldName = column?.name || ''
  const meta = getColumnMetaInfo(column)
  return {
    fieldName,
    type: meta.type,
    nullable: meta.nullable,
    inputComponent: getInputComponentByType(column?.type),
    inputProps: getInputPropsByType(column?.type, column),
    value: formData[fieldName]
  }
}))

const resetForm = (data = {}) => {
  Object.keys(formData).forEach(key => delete formData[key])
  Object.assign(formData, data)
}
watch(() => props.visible, visible => {
  if (visible && (!props.editing || props.rowData)) resetForm(props.editing ? props.rowData : {})
})
watch(() => props.rowData, data => {
  if (props.editing && data && Object.keys(data).length > 0) resetForm(data)
}, { immediate: true })

const complete = () => {
  emit('update:visible', false)
  emit('success')
  resetForm()
}

const buildWhereConditions = () => {
  const headers = getTableColumnNames(props.tableColumns)
  if (Object.keys(props.originalRowData || {}).length === 0 || headers.length === 0) {
    return null
  }
  return buildWherePayloadFromRow(headers, props.originalRowData, props.tableColumns)
}

const validateFormData = () => {
  const headers = props.tableColumns.map((column) => column.name).filter(Boolean)
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i]
    const meta = getColumnMetaInfo(props.tableColumns[i])
    if (
      !meta.nullable &&
      (formData[header] === undefined || formData[header] === null || formData[header] === '')
    ) {
      showWarning(`字段 "${header}" 是必填项`)
      return false
    }
  }
  return true
}

const insertRow = async () => {
  if (!validateFormData()) return

  await executeRequest(
    () =>
      sqlEngine.insertRow({
        sessionId: props.sessionId,
        connection: props.connection,
        objectRef: props.objectRef,
        row: { ...formData }
      }),
    {
      loadingRef: submitting,
      successMessage: '插入成功',
      errorMessage: '插入失败',
      onSuccess: complete
    }
  )
}

const updateRow = async () => {
  try {
    const updateData = getChangedRowValues(props.originalRowData, formData, props.tableColumns)

    if (Object.keys(updateData).length === 0) {
      showInfo('没有数据变更')
      emit('update:visible', false)
      return
    }

    const whereCondition = buildWhereConditions()
    if (!whereCondition) {
      showError('无法构建更新条件')
      return
    }

    submitting.value = true

    await sqlEngine.updateRows({
      sessionId: props.sessionId,
      connection: props.connection,
      objectRef: props.objectRef,
      where: whereCondition,
      update: updateData
    })

    showSuccess('更新成功')
    complete()
  } catch (e) {
    showError(formatDatabaseError(e, '更新失败'))
  } finally {
    submitting.value = false
  }
}

const handleConfirm = () => props.editing ? updateRow() : insertRow()
const handleCancel = () => {
  emit('update:visible', false)
  emit('cancel')
  resetForm()
}
</script>

<style scoped>
.dialog-content {
  padding: 1.25rem;
  background: var(--el-bg-color);
}

.field-info {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.field-name {
  font-weight: 500;
  color: var(--el-text-color-primary);
  font-size: 0.875rem;
}

.field-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.field-type {
  font-size: 0.75rem;
  color: var(--el-text-color-placeholder);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.required-tag,
.optional-tag {
  font-size: 0.6875rem;
  padding: 0 0.375rem;
  height: 1.25rem;
  line-height: 1.25rem;
}

.form-inline-actions {
  margin: 1rem 1.5rem 0;
  padding-bottom: 1rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.submit-btn,
.cancel-btn {
  font-size: var(--el-font-size-base);
  font-weight: 500;
  min-width: clamp(5rem, 6.25vw, 6.25rem);
}

.add-row-dialog :deep(.el-dialog__header) {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color-page);
}

.row-data-table {
  width: 100%;
}
</style>
