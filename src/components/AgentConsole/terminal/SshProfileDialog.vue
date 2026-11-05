<template>
  <el-dialog
    v-model="visible"
    :title="profileId ? '编辑 SSH 连接' : '新建 SSH 连接'"
    width="520px"
    class="workbench-dialog ssh-profile-dialog"
    align-center
    append-to-body
    :close-on-click-modal="false"
    :close-on-press-escape="!saving"
    :show-close="!saving"
  >
    <p class="connection-route">
      经当前 Agent 连接，配置随 Agent 权限共享。
    </p>
    <el-form
      :disabled="loading || saving"
      label-position="top"
      class="ssh-form"
      @submit.prevent="saveProfile(true)"
    >
      <el-form-item label="连接名称">
        <el-input
          v-model="form.name"
          :maxlength="120"
          placeholder="例如：构建环境（可选）"
        />
      </el-form-item>
      <div class="ssh-address">
        <el-form-item
          label="主机地址"
          required
        >
          <el-input
            v-model="form.host"
            placeholder="IP 或主机名"
            autocomplete="off"
          />
        </el-form-item>
        <el-form-item
          label="端口"
          required
        >
          <el-input-number
            v-model="form.port"
            :min="1"
            :max="65535"
            :controls="false"
          />
        </el-form-item>
      </div>
      <div class="ssh-identity">
        <el-form-item
          label="用户名"
          required
        >
          <el-input
            v-model="form.username"
            placeholder="例如 root"
            autocomplete="off"
          />
        </el-form-item>
        <el-form-item label="认证方式">
          <el-radio-group v-model="form.authType">
            <el-radio-button value="password">
              密码
            </el-radio-button><el-radio-button value="privateKey">
              私钥
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
      </div>
      <el-form-item
        v-if="form.authType === 'password'"
        label="密码"
        required
      >
        <el-input
          v-model="form.password"
          type="password"
          :placeholder="hasSavedPassword ? '已保存，留空保留原密码' : '输入 SSH 密码'"
          show-password
          autocomplete="new-password"
        />
      </el-form-item>
      <template v-else>
        <el-form-item
          label="私钥内容"
          class="ssh-key-field"
          required
        >
          <el-input
            v-model="form.privateKey"
            type="textarea"
            :rows="4"
            :placeholder="
              hasSavedPrivateKey
                ? '私钥已保存，留空保留；填写新内容以替换'
                : '粘贴 OpenSSH / PEM 私钥'
            "
            autocomplete="off"
          />
        </el-form-item>
        <el-form-item label="私钥口令（可选）">
          <el-input
            v-model="form.passphrase"
            type="password"
            :placeholder="hasSavedPassphrase ? '已保存，留空保留原口令' : '未加密的私钥可留空'"
            :disabled="form.clearPassphrase"
            show-password
            autocomplete="new-password"
          />
        </el-form-item>
        <el-checkbox
          v-if="hasSavedPassphrase"
          v-model="form.clearPassphrase"
          class="clear-passphrase"
        >
          清除已保存的私钥口令
        </el-checkbox>
      </template>
      <p class="credential-note">
        {{
          hasSavedPassword || hasSavedPrivateKey
            ? '已存凭据保持隐藏；留空保留，填写新值替换。'
            : '密码、私钥和口令加密保存，不回显原值。'
        }}
      </p>
      <el-alert
        v-if="error"
        :title="error"
        type="error"
        :closable="false"
        show-icon
      />
    </el-form>
    <template #footer>
      <div class="workbench-dialog__actions">
        <el-button
          :disabled="saving"
          @click="visible = false"
        >
          取消
        </el-button>
        <el-button
          :disabled="loading || saving"
          :loading="saving && !connectingAfterSave"
          @click="saveProfile(false)"
        >
          保存
        </el-button>
        <el-button
          type="primary"
          :disabled="loading || saving"
          :loading="saving && connectingAfterSave"
          @click="saveProfile(true)"
        >
          保存并连接
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>
<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useDialogVisible } from '@/composables/useDialogVisible.js'
import { getSshProfileApi, saveSshProfileApi } from '@/services/api/ssh-terminal.js'
const props = defineProps({
  modelValue: Boolean,
  sessionId: { type: String, required: true },
  profileId: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue', 'saved', 'connect'])
const visible = useDialogVisible(props, emit)
const initial = () => ({
  name: '',
  host: '',
  port: 22,
  username: '',
  authType: 'password',
  password: '',
  privateKey: '',
  passphrase: '',
  clearPassphrase: false
})
const form = reactive(initial()),
  loadedProfile = ref(null),
  loading = ref(false),
  saving = ref(false),
  connectingAfterSave = ref(false),
  error = ref('')
const sameAuth = computed(() => loadedProfile.value?.authType === form.authType)
const hasSavedPassword = computed(() => sameAuth.value && loadedProfile.value?.hasPassword === true)
const hasSavedPrivateKey = computed(
  () => sameAuth.value && loadedProfile.value?.hasPrivateKey === true
)
const hasSavedPassphrase = computed(
  () => sameAuth.value && loadedProfile.value?.hasPassphrase === true
)
let generation = 0,
  abort,
  pendingDraft
function clearCredentials(target) {
  if (target) {
    target.password = ''
    target.privateKey = ''
    target.passphrase = ''
  }
}
function clearSecrets() {
  clearCredentials(form)
  clearCredentials(pendingDraft)
}
watch(
  () => [props.modelValue, props.sessionId, props.profileId],
  async ([open]) => {
    const current = ++generation
    abort?.abort()
    clearSecrets()
    Object.assign(form, initial())
    loadedProfile.value = null
    error.value = ''
    saving.value = false
    loading.value = false
    if (!open) return
    abort = new AbortController()
    if (!props.profileId) return
    loading.value = true
    try {
      const response = await getSshProfileApi(props.sessionId, props.profileId, abort.signal)
      if (current !== generation) return
      loadedProfile.value = response.data
      const { name, host, port, username, authType } = response.data
      Object.assign(form, { name, host, port, username, authType })
    } catch (failure) {
      if (current === generation) error.value = failure.message || '读取 SSH 配置失败'
    } finally {
      if (current === generation) loading.value = false
    }
  },
  { immediate: true }
)
watch(
  () => form.authType,
  () => {
    clearSecrets()
    form.clearPassphrase = false
  }
)
watch(
  () => form.clearPassphrase,
  (clear) => {
    if (clear) form.passphrase = ''
  }
)
async function saveProfile(connectAfter = false) {
  if (loading.value || saving.value) return
  const current = generation,
    sessionId = props.sessionId
  error.value = ''
  const credential =
    form.authType === 'password'
      ? form.password || hasSavedPassword.value
      : form.privateKey.trim() || hasSavedPrivateKey.value
  if (!form.host.trim() || !form.username.trim() || !credential) {
    error.value = '请填写主机、用户名及对应凭据'
    return
  }
  if (!Number.isInteger(form.port) || form.port < 1 || form.port > 65535) {
    error.value = 'SSH 端口应在 1–65535 之间'
    return
  }
  if (props.profileId && !loadedProfile.value) {
    error.value = '请重新打开连接配置后重试'
    return
  }
  const draft = {
    sessionId,
    name: form.name.trim(),
    host: form.host.trim(),
    port: form.port,
    username: form.username.trim(),
    authType: form.authType,
    ...(loadedProfile.value
      ? { profileId: loadedProfile.value.profileId, version: loadedProfile.value.version }
      : {}),
    ...(form.authType === 'password'
      ? form.password
        ? { password: form.password }
        : {}
      : {
          ...(form.privateKey.trim() ? { privateKey: form.privateKey } : {}),
          ...(form.clearPassphrase
            ? { passphrase: '' }
            : form.passphrase
              ? { passphrase: form.passphrase }
              : {})
        })
  }
  pendingDraft = draft
  saving.value = true
  connectingAfterSave.value = connectAfter
  try {
    const response = await saveSshProfileApi(draft, abort?.signal)
    if (current !== generation) return
    clearSecrets()
    emit('saved', response.data)
    visible.value = false
    if (connectAfter) emit('connect', response.data)
  } catch (failure) {
    if (current === generation) error.value = failure.message || '保存 SSH 配置失败'
  } finally {
    clearCredentials(draft)
    if (pendingDraft === draft) pendingDraft = null
    if (current === generation) saving.value = false
  }
}
onBeforeUnmount(() => {
  generation++
  abort?.abort()
  clearSecrets()
})
</script>
<style scoped>
.connection-route {
  margin: 0 0 18px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}
.ssh-form :deep(.el-form-item) {
  margin-bottom: 14px;
}
.ssh-form :deep(.el-form-item__label) {
  height: auto;
  margin-bottom: 6px;
  font-size: 12px;
  line-height: 18px;
}
.ssh-address {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 80px;
  gap: 12px;
}
.ssh-identity {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
}
.ssh-address .el-input-number,
.ssh-identity .el-radio-group {
  width: 100%;
}
.ssh-identity :deep(.el-radio-button) {
  flex: 1;
}
.ssh-identity :deep(.el-radio-button__inner) {
  width: 100%;
  padding-inline: 10px;
  font-size: 12px;
}
.ssh-key-field :deep(textarea) {
  font-family: var(--font-family-code);
  font-size: 12px;
}
.clear-passphrase :deep(.el-checkbox__label),
.credential-note {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}
</style>
