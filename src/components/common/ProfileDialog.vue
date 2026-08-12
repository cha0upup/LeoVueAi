<template>
  <el-dialog
    v-model="visible"
    width="680px"
    class="profile-dialog"
    :close-on-click-modal="!saving"
    @closed="resetDialog"
  >
    <div
      v-loading="loading"
      class="profile-shell"
    >
      <div class="profile-head">
        <el-avatar
          :size="58"
          class="profile-avatar"
        >
          <Icon :icon="iconMap.userFilled" />
        </el-avatar>
        <div class="profile-head__copy">
          <span class="profile-kicker">个人信息</span>
          <h2>{{ profile.userName || '当前用户' }}</h2>
          <p>查看账户归属，并维护用于联系和说明的个人资料。</p>
        </div>
        <el-tag
          effect="light"
          round
        >
          {{ roleLabel }}
        </el-tag>
      </div>

      <div class="identity-grid">
        <div class="identity-item">
          <small>用户名</small>
          <strong>{{ profile.userName || '-' }}</strong>
        </div>
        <div class="identity-item">
          <small>所属团队</small>
          <strong>{{ profile.teamName || profile.teamId || '未加入团队' }}</strong>
        </div>
        <div class="identity-item">
          <small>账号状态</small>
          <strong :class="profile.status === 1 ? 'is-active' : 'is-disabled'">
            {{ profile.status === 1 ? '正常' : '已禁用' }}
          </strong>
        </div>
      </div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        class="profile-form"
      >
        <div class="form-row">
          <el-form-item
            label="邮箱"
            prop="email"
          >
            <el-input
              v-model="form.email"
              maxlength="100"
              clearable
              placeholder="请输入邮箱地址"
            >
              <template #prefix>
                <Icon icon="mdi:email-outline" />
              </template>
            </el-input>
          </el-form-item>
          <el-form-item
            label="手机号"
            prop="phone"
          >
            <el-input
              v-model="form.phone"
              maxlength="20"
              clearable
              placeholder="请输入手机号"
            >
              <template #prefix>
                <Icon icon="mdi:phone-outline" />
              </template>
            </el-input>
          </el-form-item>
        </div>
        <el-form-item
          label="备注"
          prop="remark"
        >
          <el-input
            v-model="form.remark"
            type="textarea"
            :rows="3"
            maxlength="500"
            show-word-limit
            resize="none"
            placeholder="补充个人说明（选填）"
          />
        </el-form-item>
      </el-form>

      <div class="profile-meta">
        <span>最近登录：{{ profile.lastLoginTime || '暂无记录' }}</span>
        <span>登录次数：{{ profile.loginCount ?? 0 }}</span>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button
          :disabled="saving"
          @click="visible = false"
        >
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="saving"
          @click="submitProfile"
        >
          保存资料
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, nextTick, reactive, ref } from 'vue'
import { Icon } from '@iconify/vue'

import { getProfileApi, updateProfileApi } from '@/services/api.js'
import { icons } from '@/utils/icons.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'

const ROLE_LABELS = {
  admin: '管理员',
  leader: '队长',
  normal: '普通用户'
}

const iconMap = icons
const visible = ref(false)
const loading = ref(false)
const saving = ref(false)
const formRef = ref(null)
const profile = reactive({})
const form = reactive({ email: '', phone: '', remark: '' })
const roleLabel = computed(() => ROLE_LABELS[profile.privilege] || '当前用户')

const rules = {
  email: [
    { type: 'email', message: '请输入有效的邮箱地址', trigger: ['blur', 'change'] },
    { max: 100, message: '邮箱不能超过 100 个字符', trigger: 'blur' }
  ],
  phone: [{ max: 20, message: '手机号不能超过 20 个字符', trigger: 'blur' }],
  remark: [{ max: 500, message: '备注不能超过 500 个字符', trigger: 'blur' }]
}

const fillProfile = (data = {}) => {
  Object.assign(profile, data)
  form.email = data.email || ''
  form.phone = data.phone || ''
  form.remark = data.remark || ''
}

const requireProfileData = (data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data) || !data.userId) {
    throw new Error('个人信息接口返回异常')
  }
  return data
}

const openProfileDialog = async () => {
  visible.value = true
  loading.value = true
  try {
    const response = await getProfileApi()
    fillProfile(requireProfileData(response.data))
    await nextTick()
    formRef.value?.clearValidate()
  } catch (error) {
    visible.value = false
    showError(error?.response?.data?.msg || '个人信息加载失败')
  } finally {
    loading.value = false
  }
}

const submitProfile = async () => {
  try {
    await formRef.value?.validate()
  } catch {
    showError('请检查表单输入')
    return
  }

  saving.value = true
  try {
    const response = await updateProfileApi({
      email: form.email,
      phone: form.phone,
      remark: form.remark
    })
    fillProfile(requireProfileData(response.data))
    showSuccess('个人资料已更新')
    visible.value = false
  } catch (error) {
    showError(error?.response?.data?.msg || '个人资料更新失败')
  } finally {
    saving.value = false
  }
}

const resetDialog = () => {
  Object.keys(profile).forEach((key) => delete profile[key])
  Object.assign(form, { email: '', phone: '', remark: '' })
  formRef.value?.clearValidate()
}

defineExpose({ openProfileDialog })
</script>

<style scoped>
.profile-shell { display: flex; flex-direction: column; gap: 20px; min-height: 360px; }
.profile-head { display: flex; align-items: center; gap: 16px; }
.profile-avatar { color: var(--el-color-primary); background: color-mix(in srgb, var(--el-color-primary) 14%, var(--app-control-background)); }
.profile-head__copy { flex: 1; min-width: 0; }
.profile-kicker { color: var(--el-color-primary); font-size: 12px; font-weight: 700; letter-spacing: .08em; }
.profile-head h2 { margin: 5px 0 4px; font-size: 25px; color: var(--el-text-color-primary); }
.profile-head p { margin: 0; color: var(--el-text-color-secondary); }
.identity-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.identity-item { padding: 13px 14px; border: 1px solid var(--app-surface-border-subtle); border-radius: var(--radius-card); background: var(--app-card-background); }
.identity-item small { display: block; margin-bottom: 6px; color: var(--el-text-color-secondary); }
.identity-item strong { color: var(--el-text-color-primary); font-size: 14px; overflow-wrap: anywhere; }
.identity-item .is-active { color: var(--el-color-success); }
.identity-item .is-disabled { color: var(--el-color-danger); }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.profile-form :deep(.el-form-item) { margin-bottom: 16px; }
.profile-form :deep(.el-input__wrapper), .profile-form :deep(.el-textarea__inner) { background: var(--app-control-background); border-radius: var(--radius-control); box-shadow: 0 0 0 1px var(--app-surface-border-subtle) inset; }
.profile-meta { display: flex; gap: 20px; padding-top: 2px; color: var(--el-text-color-secondary); font-size: 12px; }
.dialog-footer { display: flex; justify-content: flex-end; gap: 10px; }
:deep(.profile-dialog .el-dialog) { border-radius: 24px; overflow: hidden; }
:deep(.profile-dialog .el-dialog__header) { display: none; }
:deep(.profile-dialog .el-dialog__body) { padding: 28px 28px 8px; }
:deep(.profile-dialog .el-dialog__footer) { padding: 8px 28px 24px; }
@media (max-width: 640px) {
  :deep(.profile-dialog) { width: calc(100vw - 24px) !important; }
  .profile-head { align-items: flex-start; flex-wrap: wrap; }
  .identity-grid, .form-row { grid-template-columns: 1fr; }
  .profile-meta { flex-direction: column; gap: 6px; }
}
</style>
