<template>
  <el-dialog
    v-model="visible"
    title="Skill Catalog 健康检查"
    width="940px"
  >
    <div class="health-summary">
      <div>
        <span>健康</span>
        <strong>{{ healthCounts.healthy }}</strong>
      </div>
      <div class="health-warning">
        <span>警告</span>
        <strong>{{ healthCounts.warning }}</strong>
      </div>
      <div class="health-danger">
        <span>错误</span>
        <strong>{{ healthCounts.invalid }}</strong>
      </div>
      <p>共检查 {{ healthCounts.total }} 个 {{ scope }} Skill</p>
    </div>
    <el-table
      :data="data.skills || []"
      size="small"
      max-height="540"
    >
      <el-table-column
        prop="name"
        label="Skill"
        min-width="190"
      />
      <el-table-column
        label="健康状态"
        width="120"
      >
        <template #default="{ row }">
          <el-tag
            :type="healthStates[getSkillHealthKey(row)].type"
            size="small"
            effect="plain"
          >
            {{ healthStates[getSkillHealthKey(row)].label }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        label="问题"
        min-width="440"
      >
        <template #default="{ row }">
          <div
            v-if="row.issues?.length"
            class="health-issues"
          >
            <div
              v-for="(issue, index) in row.issues"
              :key="index"
              :class="`issue-${String(issue.severity).toLowerCase()}`"
            >
              {{ issue.field }}：{{ issue.message }}
            </div>
          </div>
          <span v-else>—</span>
        </template>
      </el-table-column>
      <el-table-column
        label="操作"
        width="100"
        align="right"
      >
        <template #default="{ row }">
          <el-button
            size="small"
            text
            type="primary"
            @click="emit('locate', row)"
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
import { getSkillHealthKey } from './skillUiModel.js'

const props = defineProps({
  data: { type: Object, default: () => ({ skills: [] }) },
  scope: { type: String, default: '' }
})
const emit = defineEmits(['locate'])
const visible = defineModel({ type: Boolean, default: false })

const healthStates = {
  healthy: { label: '健康', type: 'success' },
  warning: { label: '警告', type: 'warning' },
  invalid: { label: '错误', type: 'danger' }
}
const healthCounts = computed(() => {
  const rows = props.data.skills || []
  const counts = { total: rows.length, healthy: 0, warning: 0, invalid: 0 }
  for (const row of rows) counts[getSkillHealthKey(row)] += 1
  return counts
})
</script>

<style scoped>
.health-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.health-summary > div {
  min-width: 92px;
  padding: 9px 12px;
  border: 1px solid var(--app-surface-border-subtle);
  border-radius: var(--app-control-radius);
}

.health-summary span {
  display: block;
  color: var(--el-text-color-secondary);
  font-size: 10px;
}

.health-summary strong {
  display: block;
  margin-top: 2px;
  color: var(--el-color-success);
  font-size: 20px;
}

.health-warning strong {
  color: var(--el-color-warning);
}

.health-danger strong {
  color: var(--el-color-danger);
}

.health-summary p {
  margin-left: auto;
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.health-issues {
  display: flex;
  flex-direction: column;
  gap: 4px;
  white-space: normal;
  line-height: 1.45;
}

.issue-error {
  color: var(--el-color-danger);
}

.issue-warning {
  color: var(--el-color-warning);
}
</style>
