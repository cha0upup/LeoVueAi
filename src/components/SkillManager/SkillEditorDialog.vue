<template>
  <el-dialog
    v-model="visible"
    title="新建 Skill"
    width="620px"
    :close-on-click-modal="false"
    @opened="handleOpen"
    @closed="handleClosed"
  >
    <div class="create-context">
      <span>创建位置</span>
      <strong>{{ defaultScope }}</strong>
      <span>新 Skill 默认保存为草稿且不启用</span>
    </div>

    <el-form
      ref="formRef"
      :model="formData"
      :rules="metaRules"
      label-position="top"
    >
      <el-form-item
        label="名称"
        prop="name"
      >
        <el-input
          v-model="formData.name"
          placeholder="如 recon-basic-info"
          clearable
        />
        <div class="form-tip">
          只允许小写字母、数字和连字符，创建后不可修改
        </div>
      </el-form-item>

      <el-form-item
        label="描述"
        prop="description"
      >
        <el-input
          v-model="formData.description"
          type="textarea"
          :rows="2"
          resize="none"
          placeholder="一句话说明 AI 在什么场景下应调用这个 Skill"
        />
      </el-form-item>

      <el-form-item
        label="模板"
        prop="template"
      >
        <el-radio-group
          v-model="formData.template"
          class="template-grid"
        >
          <el-radio
            v-for="item in templateOptions"
            :key="item.value"
            :value="item.value"
            border
            class="template-option"
          >
            <span class="template-copy">
              <strong>{{ item.label }}</strong>
              <small>{{ item.description }}</small>
            </span>
          </el-radio>
        </el-radio-group>
      </el-form-item>

      <el-alert
        title="模板只提供安全起点。创建后可在工作台补充内容，再按“提交审核 → 发布 → 启用”完成上线。"
        type="info"
        :closable="false"
        show-icon
      />
    </el-form>

    <template #footer>
      <el-button @click="visible = false">
        取消
      </el-button>
      <el-button
        type="primary"
        @click="handleConfirm"
      >
        创建草稿
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useDialogVisible } from '@/composables/useDialogVisible.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  defaultScope: { type: String, default: 'puppet-node' }
})

const emit = defineEmits(['update:modelValue', 'confirm'])
const visible = useDialogVisible(props, emit)
const formRef = ref(null)

const templates = {
  'puppet-node': [
    {
      value: 'host-readonly',
      label: '主机只读能力',
      description: '适合信息收集、枚举和安全检查',
      domain: 'operation',
      category: 'discovery',
      mode: 'assess',
      risk: 'low',
      accessMode: 'read-only',
      pack: 'host-assessment',
      platforms: ['linux'],
      targets: ['host']
    },
    {
      value: 'ad-operation',
      label: '域环境行动',
      description: '适合授权域渗透，默认需要受控执行',
      domain: 'operation',
      category: 'lateral-movement',
      mode: 'execute',
      risk: 'high',
      accessMode: 'active-login',
      pack: 'ad-redteam',
      platforms: ['windows'],
      targets: ['active-directory']
    },
    {
      value: 'custom',
      label: '空白模板',
      description: '仅生成最小结构，稍后自行配置',
      domain: 'operation',
      category: 'discovery',
      mode: 'assess',
      risk: 'low',
      accessMode: 'read-only',
      pack: 'custom',
      platforms: ['linux'],
      targets: ['host']
    }
  ],
  platform: [
    {
      value: 'platform-analysis',
      label: '平台分析能力',
      description: '适合分析、建议和结果整理',
      domain: 'decision-support',
      category: 'evidence-analysis',
      mode: 'assess',
      risk: 'low',
      accessMode: 'read-only',
      pack: 'platform-analysis',
      platforms: ['platform'],
      targets: ['workspace']
    },
    {
      value: 'platform-generator',
      label: '内容生成能力',
      description: '适合生成脚本、载荷或配置内容',
      domain: 'capability-development',
      category: 'payload-generation',
      mode: 'generate',
      risk: 'medium',
      accessMode: 'write',
      pack: 'platform-generation',
      platforms: ['platform'],
      targets: ['workspace']
    },
    {
      value: 'custom',
      label: '空白模板',
      description: '仅生成最小结构，稍后自行配置',
      domain: 'decision-support',
      category: 'evidence-analysis',
      mode: 'assess',
      risk: 'low',
      accessMode: 'read-only',
      pack: 'custom',
      platforms: ['platform'],
      targets: ['workspace']
    }
  ]
}

const templateOptions = computed(() => templates[props.defaultScope] || templates['puppet-node'])
const defaults = () => ({
  name: '',
  description: '',
  template: templateOptions.value[0]?.value || 'custom'
})
const formData = ref(defaults())

const metaRules = {
  name: [
    { required: true, message: '请输入 Skill 名称', trigger: 'blur' },
    {
      pattern: /^[a-z0-9][a-z0-9-]{0,63}$/,
      message: '只允许小写字母、数字和连字符，最长 64 字符',
      trigger: 'blur'
    }
  ],
  description: [{ required: true, message: '请输入描述', trigger: 'blur' }],
  template: [{ required: true, message: '请选择模板', trigger: 'change' }]
}

const handleOpen = () => {
  formData.value = defaults()
}

const handleConfirm = async () => {
  await formRef.value?.validate()
  const template = templateOptions.value.find((item) => item.value === formData.value.template)
  if (!template) return
  emit('confirm', {
    scope: props.defaultScope,
    name: formData.value.name,
    description: formData.value.description,
    template: template.value,
    domain: template.domain,
    category: template.category,
    mode: template.mode,
    risk: template.risk,
    accessMode: template.accessMode,
    pack: template.pack,
    platforms: [...template.platforms],
    targets: [...template.targets]
  })
  visible.value = false
}

const handleClosed = () => {
  formRef.value?.resetFields()
}
</script>

<style scoped>
.create-context {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 18px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--app-control-radius);
  color: var(--el-text-color-secondary);
  background: var(--app-control-background-soft);
  font-size: 12px;
}

.create-context strong {
  color: var(--el-color-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.create-context span:last-child {
  margin-left: auto;
}

.form-tip {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.4;
}

.template-grid {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.template-option {
  width: 100%;
  height: auto;
  min-height: 86px;
  margin: 0 !important;
  padding: 12px !important;
  align-items: flex-start;
}

.template-option :deep(.el-radio__label) {
  min-width: 0;
  padding-left: 8px;
  white-space: normal;
}

.template-copy,
.template-copy strong,
.template-copy small {
  display: block;
}

.template-copy strong {
  margin-bottom: 5px;
  color: var(--el-text-color-primary);
  font-size: 13px;
}

.template-copy small {
  color: var(--el-text-color-secondary);
  font-size: 11px;
  line-height: 1.45;
}

@media (max-width: 640px) {
  .template-grid {
    grid-template-columns: 1fr;
  }

  .create-context span:last-child {
    display: none;
  }
}
</style>
