<template>
  <el-dialog
    v-model="visible"
    :title="title"
    width="760px"
  >
    <div class="batch-result-summary">
      <el-tag type="success">
        已变更 {{ data.changed || 0 }}
      </el-tag>
      <el-tag type="info">
        未变更 {{ data.unchanged || 0 }}
      </el-tag>
      <el-tag
        v-if="data.failed"
        type="danger"
      >
        失败 {{ data.failed }}
      </el-tag>
    </div>
    <el-table
      :data="data.results || []"
      size="small"
      max-height="440"
    >
      <el-table-column
        prop="name"
        label="Skill"
        min-width="180"
      />
      <el-table-column
        label="结果"
        width="100"
      >
        <template #default="{ row }">
          <el-tag
            size="small"
            :type="batchResultType(row.status)"
            effect="plain"
          >
            {{ batchResultLabel(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        prop="message"
        label="说明"
        min-width="340"
      />
      <el-table-column
        label="操作"
        width="90"
        align="right"
      >
        <template #default="{ row }">
          <el-button
            v-if="row.status === 'failed' && availableNameSet.has(row.name)"
            size="small"
            text
            type="primary"
            @click="emit('locate', row.name)"
          >
            定位
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-dialog>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  data: { type: Object, default: () => ({ results: [] }) },
  title: { type: String, default: '批量操作结果' },
  availableNames: { type: Array, default: () => [] }
})
const emit = defineEmits(['locate'])
const visible = defineModel({ type: Boolean, default: false })

const availableNameSet = computed(() => new Set(props.availableNames))
const batchResultType = (status) =>
  ({ changed: 'success', deleted: 'success', unchanged: 'info', failed: 'danger' })[status] || 'info'
const batchResultLabel = (status) =>
  ({ changed: '已变更', deleted: '已删除', unchanged: '未变更', failed: '失败' })[status] || status
</script>

<style scoped>
.batch-result-summary {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
</style>
