<template>
  <el-dialog
    v-model="visible"
    title="配置 Skill"
    width="820px"
    :close-on-click-modal="false"
    @opened="resetForm"
  >
    <div
      v-if="skill"
      class="manifest-editor"
    >
      <div class="editor-summary">
        <div>
          <span>当前状态</span>
          <el-tag
            size="small"
            effect="plain"
            :type="statusTagType"
          >
            {{ statusLabel }}
          </el-tag>
        </div>
        <p>{{ lifecycleHint }}</p>
        <el-segmented
          v-model="formMode"
          :options="formModeOptions"
          size="small"
        />
      </div>

      <el-form
        ref="formRef"
        :model="formData"
        :rules="rules"
        label-position="top"
      >
        <template v-if="formMode === 'basic'">
          <div class="section-copy">
            <strong>基础配置</strong>
            <span>这些字段决定 Skill 如何被检索，以及执行时采用什么风险边界。</span>
          </div>
          <div class="form-grid form-grid--two">
            <el-form-item
              label="主分类"
              prop="category"
            >
              <el-select
                v-model="formData.category"
                filterable
                style="width: 100%"
              >
                <el-option
                  v-for="item in taxonomy.categories"
                  :key="item"
                  :label="item"
                  :value="item"
                />
              </el-select>
            </el-form-item>
            <el-form-item
              label="执行模式"
              prop="mode"
            >
              <el-select
                v-model="formData.mode"
                style="width: 100%"
              >
                <el-option
                  v-for="item in taxonomy.modes"
                  :key="item"
                  :label="item"
                  :value="item"
                />
              </el-select>
            </el-form-item>
            <el-form-item
              label="风险等级"
              prop="risk"
            >
              <el-select
                v-model="formData.risk"
                style="width: 100%"
              >
                <el-option
                  v-for="item in taxonomy.risks"
                  :key="item"
                  :label="item"
                  :value="item"
                />
              </el-select>
            </el-form-item>
            <el-form-item
              label="访问模式"
              prop="accessMode"
            >
              <el-select
                v-model="formData.accessMode"
                style="width: 100%"
              >
                <el-option
                  v-for="item in taxonomy.accessModes"
                  :key="item"
                  :label="item"
                  :value="item"
                />
              </el-select>
            </el-form-item>
            <el-form-item
              label="适用平台"
              prop="platforms"
            >
              <TagValueSelect v-model="formData.platforms" />
            </el-form-item>
            <el-form-item
              label="目标类型"
              prop="targets"
            >
              <TagValueSelect v-model="formData.targets" />
            </el-form-item>
          </div>
        </template>

        <template v-else>
          <div class="section-copy">
            <strong>高级治理配置</strong>
            <span>用于能力编排、ATT&amp;CK 映射、依赖校验和维护归属。</span>
          </div>
          <div class="identity-row">
            <div>
              <span>ID</span>
              <strong>{{ skill.id }}</strong>
            </div>
            <div>
              <span>Scope</span>
              <strong>{{ skill.scope }}</strong>
            </div>
            <div>
              <span>来源</span>
              <strong>{{ skill.source }}</strong>
            </div>
          </div>

          <div class="form-grid form-grid--three">
            <el-form-item
              label="版本"
              prop="version"
            >
              <el-input
                v-model="formData.version"
                placeholder="1.0.0"
              />
            </el-form-item>
            <el-form-item
              label="负责人"
              prop="owner"
            >
              <el-input v-model="formData.owner" />
            </el-form-item>
            <el-form-item
              label="能力包"
              prop="pack"
            >
              <el-input
                v-model="formData.pack"
                placeholder="如 ad-redteam"
              />
            </el-form-item>
            <el-form-item
              label="能力域"
              prop="domain"
            >
              <el-select
                v-model="formData.domain"
                style="width: 100%"
              >
                <el-option
                  v-for="item in taxonomy.domains"
                  :key="item"
                  :label="item"
                  :value="item"
                />
              </el-select>
            </el-form-item>
          </div>

          <el-divider content-position="left">
            ATT&amp;CK 与编排
          </el-divider>
          <div class="form-grid form-grid--two">
            <el-form-item label="ATT&CK Tactics">
              <TagValueSelect v-model="formData.tactics" />
            </el-form-item>
            <el-form-item label="ATT&CK Techniques">
              <TagValueSelect
                v-model="formData.techniques"
                placeholder="如 T1021.004"
              />
            </el-form-item>
            <el-form-item label="依赖 Tools">
              <TagValueSelect v-model="formData.requiredTools" />
            </el-form-item>
            <el-form-item label="依赖 Skills">
              <TagValueSelect v-model="formData.requiredSkills" />
            </el-form-item>
            <el-form-item label="前置 Facts">
              <TagValueSelect v-model="formData.requiredFacts" />
            </el-form-item>
            <el-form-item label="产出">
              <TagValueSelect v-model="formData.produces" />
            </el-form-item>
            <el-form-item label="推荐后续 Skills">
              <TagValueSelect v-model="formData.next" />
            </el-form-item>
          </div>
        </template>
      </el-form>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="visible = false">
          取消
        </el-button>
        <div>
          <el-button
            :loading="saving"
            @click="saveManifest()"
          >
            {{ skill?.status === 'draft' ? '保存草稿' : '保存配置' }}
          </el-button>
          <el-button
            v-if="lifecycleAction"
            type="primary"
            :loading="saving"
            @click="saveManifest(lifecycleAction.status)"
          >
            {{ lifecycleAction.label }}
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, defineComponent, h, ref } from 'vue'
import { ElOption, ElSelect } from 'element-plus'
import { saveSkillFileApi } from '@/services/api.js'
import { useDialogVisible } from '@/composables/useDialogVisible.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'
import { buildSkillManifest } from './skillManifestSerializer.js'

const TagValueSelect = defineComponent({
  name: 'TagValueSelect',
  props: {
    modelValue: { type: Array, default: () => [] },
    placeholder: { type: String, default: '输入后回车，可添加多个值' }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h(
        ElSelect,
        {
          modelValue: props.modelValue,
          'onUpdate:modelValue': (value) => emit('update:modelValue', value),
          multiple: true,
          filterable: true,
          allowCreate: true,
          defaultFirstOption: true,
          collapseTags: true,
          collapseTagsTooltip: true,
          placeholder: props.placeholder,
          style: 'width: 100%'
        },
        () => props.modelValue.map((item) => h(ElOption, { key: item, label: item, value: item }))
      )
  }
})

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  skill: { type: Object, default: null },
  taxonomy: { type: Object, required: true }
})

const emit = defineEmits(['update:modelValue', 'saved'])
const visible = useDialogVisible(props, emit)
const formRef = ref(null)
const saving = ref(false)
const formData = ref({})
const formMode = ref('basic')
const formModeOptions = [
  { label: '基础配置', value: 'basic' },
  { label: '高级配置', value: 'advanced' }
]

const statusLabel = computed(
  () => ({ draft: '草稿', reviewed: '待发布', published: '已发布', deprecated: '已弃用' })[props.skill?.status] || '未知'
)
const statusTagType = computed(
  () => ({ draft: 'info', reviewed: 'warning', published: 'success', deprecated: 'info' })[props.skill?.status] || 'info'
)
const lifecycleHint = computed(
  () =>
    ({
      draft: '完善内容和基础配置后提交审核。',
      reviewed: '审核完成后发布，发布后才允许启用。',
      published: props.skill?.enabled ? '已发布并进入运行目录。' : '已发布，可返回工作台启用。',
      deprecated: '该 Skill 已退出运行目录。'
    })[props.skill?.status] || ''
)
const lifecycleAction = computed(
  () =>
    ({
      draft: { status: 'reviewed', label: '提交审核' },
      reviewed: { status: 'published', label: '发布' }
    })[props.skill?.status] || null
)

const rules = {
  version: [
    { required: true, message: '请输入版本', trigger: 'blur' },
    {
      pattern: /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:[-+][0-9A-Za-z.-]+)?$/,
      message: '请输入 SemVer，例如 1.0.0',
      trigger: 'blur'
    }
  ],
  owner: [{ required: true, message: '请输入负责人', trigger: 'blur' }],
  domain: [{ required: true, message: '请选择能力域', trigger: 'change' }],
  category: [{ required: true, message: '请选择主分类', trigger: 'change' }],
  mode: [{ required: true, message: '请选择执行模式', trigger: 'change' }],
  risk: [{ required: true, message: '请选择风险', trigger: 'change' }],
  accessMode: [{ required: true, message: '请选择访问模式', trigger: 'change' }],
  platforms: [{ type: 'array', min: 1, message: '至少声明一个平台', trigger: 'change' }],
  targets: [{ type: 'array', min: 1, message: '至少声明一个目标类型', trigger: 'change' }]
}

const resetForm = () => {
  const skill = props.skill || {}
  formMode.value = 'basic'
  formData.value = {
    version: skill.version || '0.1.0',
    owner: skill.owner || 'leo',
    pack: skill.pack || '',
    domain: skill.domain || 'operation',
    category: skill.category || 'discovery',
    mode: skill.mode || 'assess',
    risk: skill.risk || 'low',
    accessMode: skill.accessMode || 'read-only',
    platforms: [...(skill.platforms || [])],
    targets: [...(skill.targets || [])],
    tactics: [...(skill.tactics || [])],
    techniques: [...(skill.techniques || [])],
    requiredTools: [...(skill.requiredTools || [])],
    requiredSkills: [...(skill.requiredSkills || [])],
    requiredFacts: [...(skill.requiredFacts || [])],
    produces: [...(skill.produces || [])],
    next: [...(skill.next || [])]
  }
  formRef.value?.clearValidate?.()
}

const saveManifest = async (statusOverride) => {
  if (!props.skill || saving.value) return
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  const nextStatus = typeof statusOverride === 'string' ? statusOverride : props.skill.status
  const content = buildSkillManifest({
    ...props.skill,
    ...formData.value,
    status: nextStatus,
    enabled: nextStatus === 'published' && props.skill.enabled === true
  })
  saving.value = true
  try {
    await saveSkillFileApi({
      scope: props.skill.scope,
      name: props.skill.name,
      path: 'manifest.yaml',
      content,
      encoding: 'text'
    })
    const message =
      nextStatus === 'reviewed'
        ? 'Skill 已提交审核'
        : nextStatus === 'published'
          ? 'Skill 已发布，可返回工作台启用'
          : '配置已保存并通过校验'
    showSuccess(message)
    visible.value = false
    emit('saved')
  } catch (error) {
    showError(error?.response?.data?.msg || error?.message || '保存配置失败')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.manifest-editor {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.editor-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--app-control-radius);
  background: var(--app-control-background-soft);
}

.editor-summary > div:first-child {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 7px;
}

.editor-summary span,
.editor-summary p {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.editor-summary p {
  flex: 1;
  margin: 0;
}

.section-copy {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-bottom: 14px;
}

.section-copy strong {
  font-size: 14px;
}

.section-copy span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.identity-row {
  display: grid;
  margin-bottom: 14px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--app-control-radius);
  background: var(--app-control-background-soft);
  grid-template-columns: 2fr 1fr 1fr;
  gap: 10px;
}

.identity-row div {
  min-width: 0;
}

.identity-row span {
  display: block;
  margin-bottom: 3px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.identity-row strong {
  display: block;
  overflow: hidden;
  color: var(--el-text-color-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.form-grid {
  display: grid;
  gap: 0 14px;
}

.form-grid--three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.form-grid--two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

@media (max-width: 760px) {
  .editor-summary {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .editor-summary p {
    width: 100%;
    flex-basis: 100%;
  }

  .identity-row,
  .form-grid--three,
  .form-grid--two {
    grid-template-columns: 1fr;
  }
}
</style>
