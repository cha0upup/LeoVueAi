<template>
  <div class="dialog-layout">
    <div class="info-pane">
      <div class="form-section">
        <div class="section-title">
          基本信息
        </div>

        <el-form-item
          v-if="mode === 'edit'"
          label="插件ID"
        >
          <el-input
            v-model="pluginId"
            disabled
            class="disabled-input"
          />
          <div class="form-tip">
            插件唯一标识，不可修改
          </div>
        </el-form-item>

        <el-form-item
          label="插件名称"
          prop="pluginName"
        >
          <el-input
            v-model="pluginName"
            placeholder="请输入插件名称"
            clearable
          />
          <div
            v-if="mode === 'add'"
            class="form-tip"
          >
            用于标识插件的唯一名称
          </div>
        </el-form-item>

        <template v-if="mode === 'add'">
          <el-form-item
            label="版本号"
            prop="version"
          >
            <el-input
              v-model="version"
              placeholder="如：1.0.0"
              clearable
            />
          </el-form-item>

          <el-form-item
            label="插件类型"
            prop="pluginType"
          >
            <el-select
              v-model="pluginType"
              placeholder="请选择插件类型"
              style="width: 100%"
            >
              <el-option
                v-for="item in pluginTypes"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
            <div class="form-tip">
              决定插件在宿主中的执行方式
            </div>
          </el-form-item>

          <el-form-item
            label="插件描述"
            prop="pluginDescription"
          >
            <el-input
              v-model="pluginDescription"
              type="textarea"
              placeholder="请输入插件功能描述"
              :rows="3"
              clearable
            />
            <div class="form-tip">
              用于说明插件能力、适用场景和调用限制
            </div>
          </el-form-item>
        </template>

        <template v-else>
          <el-form-item
            label="插件描述"
            prop="pluginDescription"
          >
            <el-input
              v-model="pluginDescription"
              type="textarea"
              placeholder="请输入插件功能描述"
              :rows="3"
              clearable
            />
          </el-form-item>

          <el-form-item
            label="版本号"
            prop="version"
          >
            <el-input
              v-model="version"
              placeholder="如：1.0.0"
              clearable
            />
          </el-form-item>

          <el-form-item
            label="插件类型"
            prop="pluginType"
          >
            <el-select
              v-model="pluginType"
              placeholder="请选择"
              style="width: 100%"
            >
              <el-option
                v-for="item in pluginTypes"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </template>
      </div>
    </div>

    <div class="code-pane">
      <div class="code-block">
        <div class="code-editor-wrapper">
          <div class="code-editor-header">
            <span class="code-editor-title">参数模板</span>
            <span class="code-editor-desc">{{ paramsDemoDesc }}</span>
          </div>
          <div class="code-editor-body">
            <el-form-item
              prop="paramsDemo"
              label-width="0"
              class="no-padding-item"
            >
              <el-input
                v-model="paramsDemo"
                type="textarea"
                placeholder="请输入 JSON 格式的参数模板，例如：{&quot;cmd&quot;:&quot;ls&quot;}"
                :rows="4"
                clearable
                class="code-textarea"
              />
              <div class="form-tip">
                {{ paramsDemoTip }}
              </div>
            </el-form-item>
          </div>
        </div>
      </div>

      <div class="code-block">
        <div class="code-editor-wrapper">
          <div class="code-editor-header">
            <span class="code-editor-title">{{ bytecodeTitle }}</span>
            <span class="code-editor-desc">{{ bytecodeDesc }}</span>
          </div>
          <div class="code-editor-body">
            <el-form-item
              prop="bytecode"
              label-width="0"
              class="no-padding-item"
            >
              <el-input
                v-model="bytecode"
                type="textarea"
                :placeholder="bytecodePlaceholder"
                :rows="6"
                clearable
                class="bytecode-input code-textarea"
              />
              <div class="form-tip">
                {{ bytecodeTip }}
              </div>
            </el-form-item>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  formData: {
    type: Object,
    required: true
  },
  pluginTypes: {
    type: Array,
    default: () => []
  },
  mode: {
    type: String,
    default: 'add',
    validator: (v) => v === 'add' || v === 'edit'
  }
})

const isAdd = computed(() => props.mode === 'add')
const emit = defineEmits(['update:form-data'])

const createFieldModel = (field) => computed({
  get: () => props.formData?.[field] ?? '',
  set: (value) => {
    emit('update:form-data', {
      ...props.formData,
      [field]: value
    })
  }
})

const pluginId = createFieldModel('pluginId')
const pluginName = createFieldModel('pluginName')
const pluginDescription = createFieldModel('pluginDescription')
const version = createFieldModel('version')
const paramsDemo = createFieldModel('paramsDemo')
const bytecode = createFieldModel('bytecode')
const pluginType = computed({
  get: () => props.formData?.pluginType || 'java',
  set: (value) => {
    emit('update:form-data', {
      ...props.formData,
      pluginType: value,
      runtime: value === 'php' ? 'php' : 'java',
      language: value
    })
  }
})

const paramsDemoDesc = computed(() =>
  isAdd.value
    ? 'JSON 示例，用于插件调用参数校验和输入约束'
    : 'JSON 示例，用于插件调用参数验证'
)

const paramsDemoTip = computed(() =>
  isAdd.value
    ? '建议提供一个最小可运行的参数示例，便于后续快速调试'
    : 'JSON格式的参数示例，用于插件调用时的参数验证'
)

const isSourcePlugin = computed(() => pluginType.value !== 'java')
const bytecodeTitle = computed(() => isSourcePlugin.value
  ? (isAdd.value ? '插件源码' : '源码更新')
  : (isAdd.value ? '字节码' : '字节码更新'))

const bytecodeDesc = computed(() =>
  isSourcePlugin.value
    ? (isAdd.value ? '输入运行时源码' : '留空则保留现有源码')
    : (isAdd.value ? 'BASE64 编码的插件字节码内容' : 'BASE64 编码；留空则不更新')
)

const bytecodePlaceholder = computed(() =>
  isSourcePlugin.value
    ? (isAdd.value ? '请输入插件源码；PHP 插件填写函数体' : '输入新的插件源码')
    : isAdd.value
    ? '请输入 BASE64 编码的插件字节码'
    : '如需更新字节码，请输入BASE64编码的字节码；留空则保持原有字节码不变'
)

const bytecodeTip = computed(() =>
  isSourcePlugin.value
    ? '源码会按 UTF-8 保存，并在匹配的运行时节点中执行'
    : isAdd.value
    ? '用于创建插件实例的核心内容，提交前请确认编码完整无截断'
    : '留空表示不更新字节码，填写新值将替换原有字节码'
)
</script>

<style scoped>
@import '@/styles/plugin-dialog-shared.css';

.disabled-input {
  opacity: 0.6;
}
</style>
