<template>
  <el-dialog
    :model-value="visible"
    title="编辑数据"
    width="50vw"
    :close-on-click-modal="false"
    destroy-on-close
    class="edit-row-dialog"
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
        class="edit-data-table"
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
                  v-if="!scope.row.nullable"
                  type="danger"
                  size="small"
                  class="required-tag"
                >
                  必填
                </el-tag>
                <el-tag
                  v-else
                  type="info"
                  size="small"
                  class="optional-tag"
                >
                  可选
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
            <template v-if="scope.row.inputComponent === 'el-select'">
              <el-select
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
            </template>
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
    <!-- 表单操作区，参考“新增主机 / 新增数据”页面样式 -->
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
          <Icon :icon="iconMap.edit" />
        </el-icon>
        {{ submitting ? '提交中...' : '确认修改' }}
      </el-button>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'

import sqlEngine from './SqlEngine.js'
import { icons } from '@/utils/icons.js'
import { Icon } from '@iconify/vue'
import { buildWherePayloadFromRow } from '@/utils/database.js'
import { getChangedRowValues, getTableColumnNames } from './database-table-model.js'
import { resetDatabaseRowFormData, useDatabaseRowDialog } from './database-row-dialog-shared.js'
import { showError, showInfo, showSuccess } from '@/utils/messageUtils.js'
import { formatDatabaseError } from '@/utils/databaseError.js'

const iconMap = icons

const props = defineProps({
  visible: { type: Boolean, default: false },
  tableColumns: { type: Array, default: () => [] },
  rowData: { type: Object, default: () => ({}) },
  originalRowData: { type: Object, default: () => ({}) },
  loading: { type: Boolean, default: false },
  connection: { type: Object, required: true },
  objectRef: { type: Object, default: null },
  sessionId: { type: String, required: true }
})

const emit = defineEmits(['update:visible', 'confirm', 'cancel', 'success'])

const formData = reactive({})
const submitting = ref(false)
const { tableRows } = useDatabaseRowDialog({
  props,
  formData,
  mode: 'edit'
})

watch(
  () => props.visible,
  (newVal) => {
    if (newVal && props.rowData) {
      resetDatabaseRowFormData(formData, props.rowData)
    }
  }
)

watch(
  () => props.rowData,
  (newVal) => {
    if (newVal && Object.keys(newVal).length > 0) {
      resetDatabaseRowFormData(formData, newVal)
    }
  },
  { immediate: true }
)

const buildWhereConditions = () => {
  const headers = getTableColumnNames(props.tableColumns)
  if (Object.keys(props.originalRowData || {}).length === 0 || headers.length === 0) {
    return null
  }
  return buildWherePayloadFromRow(headers, props.originalRowData, props.tableColumns)
}

const getChangedFields = () =>
  getChangedRowValues(props.originalRowData, formData, props.tableColumns)

const handleConfirm = async () => {
  try {
    const updateData = getChangedFields()

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
    emit('update:visible', false)
    emit('success')
    resetDatabaseRowFormData(formData)
  } catch (e) {
    showError(formatDatabaseError(e, '更新失败'))
  } finally {
    submitting.value = false
  }
}

const handleCancel = () => {
  emit('update:visible', false)
  emit('cancel')
  resetDatabaseRowFormData(formData)
}
</script>

<style scoped>
@import '@/styles/database-row-dialog-shared.css';

/* 表格样式 */
.edit-data-table {
  width: 100%;
}
</style>
