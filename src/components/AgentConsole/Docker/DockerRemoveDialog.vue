<template>
  <el-dialog
    :model-value="visible"
    title="删除容器"
    width="420px"
    destroy-on-close
    @update:model-value="$emit('update:visible', $event)"
  >
    <p>
      确认删除容器 <strong>{{ containerId }}</strong>？
    </p>
    <el-checkbox
      v-model="force"
      size="small"
    >
      强制删除（即使运行中）
    </el-checkbox>
    <template #footer>
      <el-button
        size="small"
        :disabled="loading"
        @click="$emit('update:visible', false)"
      >
        取消
      </el-button>
      <el-button
        size="small"
        type="danger"
        :loading="loading"
        @click="confirmRemove"
      >
        删除
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  containerId: { type: String, default: '' },
  loading: { type: Boolean, default: false }
})

const emit = defineEmits(['update:visible', 'confirm'])
const force = ref(false)

watch(
  () => props.visible,
  (visible) => {
    if (visible) force.value = false
  }
)

function confirmRemove() {
  if (!props.containerId || props.loading) return
  emit('confirm', { containerId: props.containerId, force: force.value })
}
</script>
