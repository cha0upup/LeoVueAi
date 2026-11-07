<template>
  <el-popover
    placement="bottom-end"
    :width="mode === 'governance' ? 760 : 520"
    trigger="click"
    popper-class="skill-filter-popper"
  >
    <template #reference>
      <el-button
        :type="activeCount ? 'primary' : ''"
        plain
      >
        <el-icon><Icon icon="mdi:filter-variant" /></el-icon>
        筛选
        <span v-if="activeCount">({{ activeCount }})</span>
      </el-button>
    </template>
    <div>
      <div class="filter-popover-title">
        <div>
          <strong>筛选能力</strong>
          <span>筛选变化会清空当前批量选择，避免操作隐藏条目。</span>
        </div>
        <el-button
          v-if="activeCount"
          text
          @click="emit('clear')"
        >
          清除全部
        </el-button>
      </div>
      <div
        class="filter-grid"
        :class="{ 'filter-grid--simple': mode === 'simple' }"
      >
        <label
          v-for="field in fields"
          :key="field.key"
        >
          <span>{{ field.label }}</span>
          <el-select
            :model-value="filters[field.key]"
            clearable
            :filterable="Boolean(field.filterable)"
            :placeholder="field.placeholder"
            @update:model-value="value => emit('change', field.key, value)"
          >
            <el-option
              v-for="item in field.options"
              :key="item.value ?? item"
              :label="item.label ?? item"
              :value="item.value ?? item"
            />
          </el-select>
        </label>
      </div>
    </div>
  </el-popover>
</template>

<script setup>
import { computed } from 'vue'
import { Icon } from '@iconify/vue'

const props = defineProps({
  filters: { type: Object, default: () => ({}) },
  fields: { type: Array, default: () => [] },
  mode: { type: String, default: 'simple' }
})
const emit = defineEmits(['change', 'clear'])
const activeCount = computed(() => Object.values(props.filters).filter(Boolean).length)
</script>

<style scoped>
.filter-popover-title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.filter-popover-title strong,
.filter-popover-title span {
  display: block;
}

.filter-popover-title strong {
  margin-bottom: 3px;
  font-size: 14px;
}

.filter-popover-title span {
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.filter-grid--simple {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.filter-grid label > span {
  display: block;
  margin-bottom: 5px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
  font-weight: 600;
}

.filter-grid :deep(.el-select) {
  width: 100%;
}

@media (max-width: 900px) {
  .filter-grid {
    grid-template-columns: 1fr;
  }
}
</style>
