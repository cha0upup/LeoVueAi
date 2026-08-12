<template>
  <el-dialog
    v-model="visible"
    title="重置密码"
    width="400px"
    class="reset-password-dialog"
  >
    <div class="reset-content">
      <el-alert
        title="密码重置"
        description="确定要重置该用户的密码吗？重置后用户需要使用新密码登录。"
        type="warning"
        :closable="false"
        show-icon
      />

      <el-form
        :ref="setFormRef"
        :model="form"
        :rules="rules"
        class="reset-form"
      >
        <el-form-item
          label="新密码"
          prop="newPassword"
        >
          <el-input
            v-model="form.newPassword"
            type="password"
            placeholder="请输入新密码"
            :maxlength="AUTH_FIELD_LIMITS.passwordMaxLength"
            show-password
          />
        </el-form-item>

        <el-form-item
          label="确认密码"
          prop="confirmPassword"
        >
          <el-input
            v-model="form.confirmPassword"
            type="password"
            placeholder="请确认新密码"
            :maxlength="AUTH_FIELD_LIMITS.passwordMaxLength"
            show-password
          />
        </el-form-item>
      </el-form>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="visible = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="resetting"
          @click="$emit('submit')"
        >
          确认重置
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { reactive } from 'vue'
import { AUTH_FIELD_LIMITS } from '@/constants/app.js'

const visible = defineModel({ type: Boolean, default: false })

const props = defineProps({
  formState: { type: Object, required: true },
  rules: { type: Object, required: true },
  resetting: { type: Boolean, default: false }
})

const form = reactive(props.formState)
const emit = defineEmits(['submit', 'form-ready'])
const setFormRef = (instance) => emit('form-ready', instance)
</script>

<style>
.reset-password-dialog {
  border-radius: var(--radius-overlay);
  box-shadow: var(--shadow-overlay);
}

.reset-password-dialog .el-dialog__header {
  margin: 0;
  padding: var(--space-3) var(--space-4);
  border-top: 3px solid var(--el-color-warning);
  border-bottom: 1px solid var(--app-divider-color);
}

.reset-password-dialog .el-dialog__title {
  color: var(--el-text-color-primary);
  font-size: var(--el-font-size-large);
  font-weight: 600;
}

.reset-password-dialog .el-dialog__body {
  padding: var(--space-4);
}

.reset-password-dialog .reset-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.reset-password-dialog .reset-form {
  margin-top: var(--el-spacing-large);
}

.reset-password-dialog .dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--el-spacing-base);
}

@media (max-width: 440px) {
  .reset-password-dialog {
    width: calc(100vw - 32px) !important;
  }
}
</style>
