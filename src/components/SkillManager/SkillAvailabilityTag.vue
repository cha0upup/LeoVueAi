<template>
  <el-tooltip
    :content="availability.description"
    placement="top"
  >
    <el-tag
      :type="availability.type"
      :effect="availability.key === 'controlled' ? 'dark' : 'light'"
      size="small"
      round
      class="availability-tag"
    >
      <el-icon><Icon :icon="availabilityIcon" /></el-icon>
      {{ availability.label }}
    </el-tag>
  </el-tooltip>
</template>

<script setup>
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { getSkillAvailability } from './skillUiModel.js'

const props = defineProps({
  skill: { type: Object, required: true }
})

const availability = computed(() => getSkillAvailability(props.skill))
const availabilityIcon = computed(
  () =>
    ({
      available: 'mdi:check-circle-outline',
      controlled: 'mdi:shield-lock-outline',
      disabled: 'mdi:pause-circle-outline',
      draft: 'mdi:file-edit-outline',
      reviewed: 'mdi:file-check-outline',
      deprecated: 'mdi:archive-outline',
      invalid: 'mdi:alert-circle-outline'
    })[availability.value.key] || 'mdi:information-outline'
)
</script>

<style scoped>
.availability-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 650;
}

.availability-tag .el-icon {
  font-size: 12px;
}
</style>
