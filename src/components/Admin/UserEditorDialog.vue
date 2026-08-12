<template>
  <el-dialog
    v-model="visible"
    :title="editing ? '编辑用户' : '添加用户'"
    width="600px"
    class="user-dialog"
    @closed="$emit('closed')"
  >
    <el-form
      :ref="setFormRef"
      :model="form"
      :rules="rules"
      label-width="100px"
      class="user-form"
    >
      <el-form-item
        label="用户名"
        prop="username"
      >
        <el-input
          v-model="form.username"
          placeholder="请输入用户名"
          :maxlength="AUTH_FIELD_LIMITS.usernameMaxLength"
          :disabled="editing"
        />
      </el-form-item>

      <el-form-item
        v-if="!editing"
        label="密码"
        prop="password"
      >
        <el-input
          v-model="form.password"
          type="password"
          placeholder="请输入密码"
          :maxlength="AUTH_FIELD_LIMITS.passwordMaxLength"
          show-password
        />
      </el-form-item>

      <el-form-item
        v-if="!editing"
        label="确认密码"
        prop="confirmPassword"
      >
        <el-input
          v-model="form.confirmPassword"
          type="password"
          placeholder="请确认密码"
          :maxlength="AUTH_FIELD_LIMITS.passwordMaxLength"
          show-password
        />
      </el-form-item>

      <el-form-item
        label="角色"
        prop="privilege"
      >
        <el-select
          v-model="form.privilege"
          placeholder="请选择角色"
          :disabled="editingBuiltInAdmin"
          style="width: 100%"
        >
          <el-option
            v-if="isAdmin"
            label="管理员"
            value="admin"
          />
          <el-option
            v-if="isAdmin"
            label="队长"
            value="leader"
          />
          <el-option
            label="普通用户"
            value="normal"
          />
        </el-select>
      </el-form-item>

      <el-form-item
        label="所属团队"
        prop="teamname"
      >
        <el-select
          v-model="form.teamname"
          placeholder="请选择团队，不加入团队请置空"
          clearable
          :disabled="isLeader || editingBuiltInAdmin"
          style="width: 100%"
        >
          <el-option
            v-for="team in teams"
            :key="team.id"
            :label="team.teamname || team.teamName"
            :value="team.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item
        label="状态"
        prop="status"
      >
        <el-radio-group v-model="form.status">
          <el-radio :value="1">
            启用
          </el-radio>
          <el-radio
            :value="0"
            :disabled="editingBuiltInAdmin"
          >
            禁用
          </el-radio>
        </el-radio-group>
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="visible = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="submitting"
          @click="$emit('submit')"
        >
          {{ editing ? '更新' : '添加' }}
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
  editing: { type: Boolean, default: false },
  editingBuiltInAdmin: { type: Boolean, default: false },
  formState: { type: Object, required: true },
  rules: { type: Object, required: true },
  teams: { type: Array, default: () => [] },
  isAdmin: { type: Boolean, default: false },
  isLeader: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false }
})

const form = reactive(props.formState)
const emit = defineEmits(['submit', 'closed', 'form-ready'])
const setFormRef = (instance) => emit('form-ready', instance)
</script>

<style>
.user-dialog {
  border-radius: var(--radius-overlay);
  box-shadow: var(--shadow-overlay);
}

.user-dialog .el-dialog__header {
  margin: 0;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--app-divider-color);
}

.user-dialog .el-dialog__title {
  color: var(--el-text-color-primary);
  font-size: var(--el-font-size-large);
  font-weight: 600;
}

.user-dialog .el-dialog__body {
  padding: var(--space-4);
}

.user-dialog .user-form {
  max-width: 100%;
}

.user-dialog .dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--el-spacing-base);
}

@media (max-width: 640px) {
  .user-dialog {
    width: calc(100vw - 32px) !important;
  }
}
</style>
