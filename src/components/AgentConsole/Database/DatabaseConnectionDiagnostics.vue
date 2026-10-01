<template>
  <el-alert
    v-if="result"
    :title="alertTitle"
    :type="result.success ? 'success' : 'error'"
    :closable="false"
    show-icon
    class="connection-diagnostics"
  >
    <template #default>
      <div
        v-if="result.message"
        class="connection-diagnostics__message"
      >
        {{ result.message }}
      </div>
      <div
        v-if="diagnostics.length"
        class="connection-diagnostics__steps"
      >
        <div
          v-for="item in diagnostics"
          :key="`${item.stage}-${item.status}`"
          class="connection-diagnostics__step"
        >
          <el-tag
            size="small"
            :type="statusType(item.status)"
            effect="plain"
          >
            {{ stageLabel(item.stage) }}
          </el-tag>
          <span>{{ item.message }}</span>
        </div>
      </div>
    </template>
  </el-alert>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  result: { type: Object, default: null }
})

const diagnostics = computed(() =>
  Array.isArray(props.result?.diagnostics) ? props.result.diagnostics : []
)

const alertTitle = computed(() =>
  props.result?.success
    ? `连接测试通过${props.result?.latencyMs != null ? ` · ${props.result.latencyMs} ms` : ''}`
    : `连接测试失败 · ${stageLabel(props.result?.failureStage)}`
)

const stageLabel = (stage) =>
  ({
    driver: '驱动',
    configuration: '配置',
    network: '网络',
    authentication: '认证',
    connection: '连接',
    healthCheck: '健康检查',
    unknown: '未知阶段'
  })[stage] || stage || '未知阶段'

const statusType = (status) => {
  if (status === 'passed') return 'success'
  if (status === 'warning') return 'warning'
  return 'danger'
}
</script>

<style scoped>
.connection-diagnostics {
  margin-top: 14px;
}

.connection-diagnostics__message {
  margin-bottom: 8px;
}

.connection-diagnostics__steps {
  display: grid;
  gap: 6px;
}

.connection-diagnostics__step {
  display: flex;
  align-items: center;
  gap: 8px;
  line-height: 1.45;
}
</style>
