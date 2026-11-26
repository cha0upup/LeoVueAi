<template>
  <el-dialog
    v-model="visible"
    title="重置密码"
    width="400px"
    class="reset-password-dialog"
    :show-close="!resetting"
    :close-on-click-modal="!resetting"
    :close-on-press-escape="!resetting"
  >
    <div class="reset-content">
      <el-alert
        v-if="targetUser"
        :title="`目标账号：${targetUser.userName || targetUser.userId}`"
        :description="`用户 ID：${targetUser.userId}。该账号下次登录时需使用新密码，并按提示修改密码。`"
        class="reset-account"
        type="warning"
        :closable="false"
        show-icon
      />

      <el-form
        :ref="setFormRef"
        :model="form"
        :rules="rules"
        :disabled="resetting"
        class="reset-form"
      >
        <el-form-item
          v-for="field in passwordFields"
          :key="field.prop"
          :label="field.label"
          :prop="field.prop"
        >
          <el-input
            v-model="form[field.prop]"
            type="password"
            :placeholder="field.placeholder"
            :maxlength="passwordMaxLength"
            autocomplete="new-password"
            show-password
          />
        </el-form-item>
      </el-form>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button
          :disabled="resetting"
          @click="visible = false"
        >
          取消
        </el-button>
        <el-button
          type="primary"
          :disabled="resetting"
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

const passwordFields = [
  { prop: 'newPassword', label: '新密码', placeholder: '请输入新密码' },
  { prop: 'confirmPassword', label: '确认密码', placeholder: '请确认新密码' }
]

const props = defineProps({
  targetUser: { type: Object, default: null },
  formState: { type: Object, required: true },
  rules: { type: Object, required: true },
  passwordMaxLength: { type: Number, default: AUTH_FIELD_LIMITS.passwordMaxLength },
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

.reset-password-dialog .reset-account {
  overflow-wrap: anywhere;
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
