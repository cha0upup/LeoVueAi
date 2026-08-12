<template>
  <el-dialog
    v-model="visible"
    title="清理旧日志"
    width="500px"
    class="admin-danger-dialog"
  >
    <el-form label-width="120px">
      <el-form-item label="删除天数">
        <el-input-number
          v-model="days"
          :min="1"
          :max="365"
          placeholder="删除多少天之前的日志"
        />
        <div class="form-item-tip">
          将删除 {{ days }} 天之前的日志
        </div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">
        取消
      </el-button>
      <el-button
        type="danger"
        :loading="loading"
        @click="$emit('confirm')"
      >
        确认清理
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
const visible = defineModel({ type: Boolean, default: false })
const days = defineModel('days', { type: Number, default: 30 })

defineProps({
  loading: { type: Boolean, default: false }
})

defineEmits(['confirm'])
</script>

<style>
.admin-danger-dialog {
  border-radius: var(--radius-overlay);
  box-shadow: var(--shadow-overlay);
}

.admin-danger-dialog .el-dialog__header {
  margin: 0;
  padding: var(--space-3) var(--space-4);
  border-top: 3px solid var(--el-color-danger);
  border-bottom: 1px solid var(--app-divider-color);
}

.admin-danger-dialog .el-dialog__body {
  padding: var(--space-4);
}

.admin-danger-dialog .el-dialog__footer {
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--app-divider-color);
  background: var(--app-page-background);
}

.admin-danger-dialog .form-item-tip {
  margin-top: 4px;
  color: var(--el-text-color-placeholder);
  font-size: var(--el-font-size-extra-small);
}

@media (max-width: 540px) {
  .admin-danger-dialog {
    width: calc(100vw - 32px) !important;
  }
}
</style>
