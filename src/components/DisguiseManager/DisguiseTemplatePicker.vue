<template>
  <el-dialog
    v-model="visible"
    title="从内置模板创建"
    width="520px"
    append-to-body
  >
    <div
      v-loading="loading"
      class="template-list"
    >
      <div
        v-for="template in templates"
        :key="template.disguiseId"
        class="template-item"
        :class="{ selected: selected?.disguiseId === template.disguiseId }"
        @click="selected = template"
      >
        <div class="template-item-header">
          <strong class="template-name">{{ template.disguiseName }}</strong>
          <el-tag
            size="small"
            effect="plain"
          >
            {{ template.disguiseId }}
          </el-tag>
        </div>
        <p class="template-desc">
          {{ template.description }}
        </p>
        <p
          v-if="template.remark"
          class="template-remark"
        >
          {{ template.remark }}
        </p>
      </div>
      <el-empty
        v-if="!loading && templates.length === 0"
        description="暂无内置模板"
        :image-size="40"
      />
    </div>
    <template #footer>
      <el-button
        size="small"
        @click="visible = false"
      >
        取消
      </el-button>
      <el-button
        size="small"
        type="primary"
        :disabled="!selected || loading"
        @click="emit('apply')"
      >
        应用此模板
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
defineProps({
  templates: { type: Array, default: () => [] },
  loading: Boolean
})

const emit = defineEmits(['apply'])
const visible = defineModel({ type: Boolean, default: false })
const selected = defineModel('selected', { type: Object, default: null })
</script>

<style scoped>
.template-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-height: 80px;
  max-height: 360px;
  overflow-y: auto;
  padding: 1px 3px;
}
.template-item {
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-light);
  border-radius: 6px;
  padding: 4px 6px;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.template-item:hover {
  border-color: color-mix(in srgb, var(--el-color-primary) 50%, transparent);
  background: color-mix(in srgb, var(--el-color-primary) 5%, var(--el-fill-color-light));
}
.template-item.selected {
  border-color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 10%, var(--el-bg-color-overlay));
}
.template-item-header {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 1px;
}
.template-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.template-desc {
  margin: 0 0 1px;
  font-size: 12px;
  color: var(--el-text-color-regular);
  line-height: 1.4;
}
.template-remark {
  margin: 0;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}
</style>
