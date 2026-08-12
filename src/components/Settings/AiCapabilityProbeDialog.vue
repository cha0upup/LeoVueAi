<template>
  <el-dialog
    v-model="visible"
    title="真实能力探测结果"
    width="760px"
    class="ai-model-dialog probe-result-dialog"
  >
    <p class="probe-description">
      {{
        report?.applied
          ? '已写入有明确证据的能力结论；不确定项保留原有配置。'
          : '基础文本探测未通过，能力库未修改。'
      }}
    </p>
    <el-table
      :data="report?.items || []"
      size="small"
    >
      <el-table-column
        label="能力"
        width="110"
      >
        <template #default="{ row }">
          {{ probeFeatureLabel(row.feature) }}
        </template>
      </el-table-column>
      <el-table-column
        label="结果"
        width="110"
      >
        <template #default="{ row }">
          <el-tag
            :type="probeStatusType(row.status)"
            size="small"
          >
            {{ probeStatusLabel(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        label="耗时"
        width="100"
      >
        <template #default="{ row }">
          {{ row.latencyMs || 0 }} ms
        </template>
      </el-table-column>
      <el-table-column
        label="说明"
        min-width="300"
        prop="message"
      />
    </el-table>
    <template #footer>
      <el-button
        type="primary"
        @click="visible = false"
      >
        知道了
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { probeFeatureLabel, probeStatusLabel, probeStatusType } from './aiChannelSettingsModel.js'

const visible = defineModel({ type: Boolean, default: false })

defineProps({
  report: { type: Object, default: null }
})
</script>

<style>
.probe-result-dialog .probe-description {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

@media (max-width: 720px) {
  .probe-result-dialog {
    width: calc(100vw - 32px) !important;
  }
}
</style>
