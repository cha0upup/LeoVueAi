<template>
  <div
    class="bind-address-control"
    :class="{ 'bind-address-control--stacked': stacked }"
  >
    <el-tooltip
      content="绑定 LeoAI 服务端的网卡地址；0.0.0.0 表示监听所有 IPv4 网卡。"
      placement="top"
    >
      <span class="control-label">监听地址</span>
    </el-tooltip>
    <el-select
      :model-value="modelValue"
      :disabled="disabled"
      filterable
      allow-create
      default-first-option
      :reserve-keyword="false"
      placeholder="选择或输入网卡 IP"
      aria-label="监听地址"
      @update:model-value="$emit('update:modelValue', $event)"
    >
      <el-option
        label="0.0.0.0（所有 IPv4 网卡）"
        value="0.0.0.0"
      />
      <el-option
        label="127.0.0.1（仅本机）"
        value="127.0.0.1"
      />
    </el-select>
  </div>
</template>

<script setup>
defineProps({
  modelValue: { type: String, required: true },
  disabled: { type: Boolean, default: false },
  stacked: { type: Boolean, default: false }
})

defineEmits(['update:modelValue'])
</script>

<style scoped>
.bind-address-control {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

.bind-address-control--stacked {
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}

.control-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--el-text-color-regular);
}

.el-select {
  width: 210px;
  max-width: 100%;
}
</style>
