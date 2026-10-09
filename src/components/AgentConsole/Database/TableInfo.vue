<template>
  <div class="table-info database-info-shell">
    <el-descriptions
      :column="2"
      border
      class="database-info-descriptions"
    >
      <el-descriptions-item :label="namespaceLabel">
        {{ currentNamespace || '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="表名">
        {{ currentTable || '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="记录数">
        {{ pagination.total ?? 0 }}
      </el-descriptions-item>
      <el-descriptions-item label="字段数">
        {{ tableColumns.length }}
      </el-descriptions-item>
      <el-descriptions-item label="主键字段">
        {{ primaryKeyNames || '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="可空字段">
        {{ nullableCount }}
      </el-descriptions-item>
      <el-descriptions-item
        v-for="field in visibleTableDetails"
        :key="field.key"
        :label="field.label"
        :span="field.span"
      >
        {{ tableInfo[field.key] }}
      </el-descriptions-item>
    </el-descriptions>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { normalizeDatabaseObjectRef } from './database-domain.js'

const props = defineProps({
  objectRef: {
    type: Object,
    default: null
  },
  tableColumns: {
    type: Array,
    default: () => []
  },
  pagination: {
    type: Object,
    default: () => ({ total: 0 })
  },
  tableInfo: {
    type: Object,
    default: () => ({})
  }
})

const TABLE_DETAILS = [
  { key: 'engine', label: '存储引擎' },
  { key: 'collation', label: '排序规则' },
  { key: 'createTime', label: '创建时间' },
  { key: 'updateTime', label: '更新时间' },
  { key: 'comment', label: '表注释', span: 2 }
]
const visibleTableDetails = computed(() => TABLE_DETAILS.filter(field => props.tableInfo[field.key]))

const normalizedObjectRef = computed(() => normalizeDatabaseObjectRef(props.objectRef))
const currentNamespace = computed(() =>
  normalizedObjectRef.value.schema || normalizedObjectRef.value.catalog || ''
)
const currentTable = computed(() => normalizedObjectRef.value.name || '')
const namespaceLabel = computed(() =>
  normalizedObjectRef.value.schema ? 'Schema' : '数据库'
)
const primaryKeyNames = computed(() =>
  props.tableColumns
    .filter((column) => column.primaryKey)
    .map((column) => column.name)
    .filter(Boolean)
    .join(', ')
)
const nullableCount = computed(() =>
  props.tableColumns.filter(
    (column) => column.nullable === 'YES' || column.nullable === true || column.nullable === 1
  ).length
)
</script>

<style scoped>
@import '@/styles/database-info-shared.css';

.table-info {
  padding: var(--el-spacing-large);
}
</style>
