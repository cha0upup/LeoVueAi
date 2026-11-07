<template>
  <el-drawer
    v-model="visible"
    title="校验与问题定位"
    size="520px"
    append-to-body
  >
    <div
      v-if="skill"
      class="validation-scroll validation-drawer"
    >
      <div class="validation-summary">
        <div :class="skill.valid ? 'validation-icon--success' : 'validation-icon--danger'">
          <Icon :icon="skill.valid ? 'mdi:check-decagram-outline' : 'mdi:alert-decagram-outline'" />
        </div>
        <div>
          <h2>{{ skill.valid ? '基础校验通过' : '存在阻塞错误' }}</h2>
          <p>
            错误 {{ errorCount }} · 警告 {{ warnings.length }}。
            {{ getSkillAvailability(skill).description }}
          </p>
        </div>
        <el-button
          size="small"
          @click="emit('revalidate')"
        >
          重新校验
        </el-button>
      </div>

      <div
        v-if="issues.length"
        class="validation-list"
      >
        <button
          v-for="(issue, index) in issues"
          :key="`${issue.field}-${index}`"
          type="button"
          class="validation-item"
          @click="emit('open-file', issue)"
        >
          <span
            class="issue-level"
            :class="`issue-level--${String(issue.severity).toLowerCase()}`"
          >
            {{ issue.severity }}
          </span>
          <span class="issue-content">
            <strong>{{ issue.field }}</strong>
            <span>{{ issue.message }}</span>
          </span>
          <span class="issue-target">
            打开 {{ issueTargetFile(issue) }}
            <Icon icon="mdi:arrow-right" />
          </span>
        </button>
      </div>
      <div
        v-else
        class="validation-empty"
      >
        <Icon icon="mdi:check-circle-outline" />
        <strong>没有发现校验问题</strong>
        <span>manifest、依赖关系和生命周期状态均通过当前校验。</span>
      </div>
    </div>
  </el-drawer>
</template>

<script setup>
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { getSkillAvailability, issueTargetFile } from './skillUiModel.js'

const props = defineProps({
  skill: { type: Object, default: null }
})
const emit = defineEmits(['open-file', 'revalidate'])
const visible = defineModel({ type: Boolean, default: false })

const issues = computed(() => props.skill?.issues || [])
const warnings = computed(() => issues.value.filter((issue) => String(issue.severity).toUpperCase() === 'WARNING'))
const errorCount = computed(() => issues.value.filter((issue) => String(issue.severity).toUpperCase() === 'ERROR').length)
</script>

<style scoped>
.validation-scroll {
  overflow: auto;
}

.validation-summary {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 15px;
  border: 1px solid var(--app-surface-border-subtle);
  border-radius: var(--app-control-radius);
  background: var(--app-control-background-soft);
}

.validation-drawer {
  height: auto;
  padding: 0;
}

.validation-summary > div:first-child {
  font-size: 30px;
}

.validation-icon--success {
  color: var(--el-color-success);
}

.validation-icon--danger {
  color: var(--el-color-danger);
}

.validation-summary > div:nth-child(2) {
  flex: 1;
}

.validation-summary h2 {
  margin: 0;
  font-size: 15px;
}

.validation-summary p {
  margin: 4px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.validation-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.validation-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--app-surface-border-subtle);
  border-radius: var(--app-control-radius);
  color: var(--el-text-color-primary);
  background: var(--app-card-background);
  text-align: left;
  cursor: pointer;
}

.validation-item:hover {
  border-color: color-mix(in srgb, var(--el-color-primary) 35%, var(--app-border-color));
  background: color-mix(in srgb, var(--el-color-primary) 3%, var(--app-card-background));
}

.issue-level {
  min-width: 64px;
  padding: 3px 7px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  text-align: center;
}

.issue-level--error {
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
}

.issue-level--warning {
  color: var(--el-color-warning);
  background: var(--el-color-warning-light-9);
}

.issue-content {
  flex: 1;
  min-width: 0;
}

.issue-content strong,
.issue-content span {
  display: block;
}

.issue-content strong {
  margin-bottom: 3px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}

.issue-content span,
.issue-target {
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.issue-target {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.validation-empty {
  min-height: 240px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: var(--el-text-color-secondary);
}

.validation-empty svg {
  font-size: 40px;
  color: var(--el-color-success);
}

.validation-empty strong {
  color: var(--el-text-color-primary);
  font-size: 14px;
}

.validation-empty span {
  font-size: 12px;
}
</style>
