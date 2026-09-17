<template>
  <section
    class="fingerprint-selector"
    aria-label="组件识别规则"
  >
    <div class="selector-heading">
      <strong>组件识别规则</strong>
      <el-button
        text
        :loading="loading"
        @click="loadRules"
      >
        刷新规则
      </el-button>
    </div>
    <el-radio-group
      v-model="mode"
      aria-label="规则选择方式"
      @change="changeMode"
    >
      <el-radio-button value="all">
        全部
      </el-radio-button>
      <el-radio-button value="tags">
        按标签
      </el-radio-button>
      <el-radio-button value="ids">
        指定规则
      </el-radio-button>
    </el-radio-group>
    <el-select
      v-if="mode === 'ids'"
      :model-value="modelValue.ids"
      multiple
      filterable
      clearable
      placeholder="选择指纹规则"
      aria-label="指纹规则"
      @update:model-value="updateIds"
    >
      <el-option
        v-for="rule in rules"
        :key="rule.fingerprintId"
        :label="rule.name || rule.fingerprintId"
        :value="rule.fingerprintId"
      />
    </el-select>
    <el-select
      v-if="mode === 'tags'"
      :model-value="modelValue.tags"
      multiple
      filterable
      clearable
      placeholder="选择标签，匹配任一标签"
      aria-label="规则标签"
      @update:model-value="updateTags"
    >
      <el-option
        v-for="tag in tags"
        :key="tag"
        :label="tag"
        :value="tag"
      />
    </el-select>
    <p
      v-if="error"
      role="alert"
      class="error"
    >
      {{ error }}
    </p>
    <p v-else-if="loading">
      正在读取指纹库…
    </p>
    <p v-else-if="!rules.length">
      暂无 HTTP 指纹，请先在指纹管理中添加或导入规则。
    </p>
    <p v-else>
      已选择 {{ selectedCount }} 条 HTTP 指纹，每次最多 64 条。{{
        selectedCount > 64 ? '请按标签或指定规则缩小范围。' : '匹配成功后保存组件与响应证据。'
      }}
    </p>
  </section>
</template>

<script setup>
import { computed, onMounted, onScopeDispose, ref, watch } from 'vue'
import { getFingerprintsApi } from '@/services/api.js'

const props = defineProps({ modelValue: { type: Object, required: true } })
const emit = defineEmits(['update:modelValue', 'validity-change'])
const mode = ref(
  props.modelValue.ids?.length ? 'ids' : props.modelValue.tags?.length ? 'tags' : 'all'
)
const rules = ref([])
const loading = ref(true)
const error = ref('')
let sequence = 0
const tags = computed(() =>
  [
    ...new Set(
      rules.value.flatMap((rule) => rule.tags || []).map((tag) => String(tag).toLowerCase())
    )
  ].sort()
)
const selectedCount = computed(
  () =>
    rules.value.filter(
      (rule) =>
        mode.value === 'all' ||
        (mode.value === 'ids'
          ? props.modelValue.ids.includes(rule.fingerprintId)
          : (rule.tags || []).some((tag) =>
              props.modelValue.tags.includes(String(tag).toLowerCase())
            ))
    ).length
)
watch(
  [selectedCount, loading, error],
  () =>
    emit(
      'validity-change',
      !loading.value && !error.value && selectedCount.value > 0 && selectedCount.value <= 64
    ),
  { immediate: true }
)
function changeMode() {
  emit('update:modelValue', { ids: [], tags: [] })
}
function updateIds(ids) {
  emit('update:modelValue', { ids, tags: [] })
}
function updateTags(tags) {
  emit('update:modelValue', { ids: [], tags })
}
async function loadRules() {
  const current = ++sequence
  loading.value = true
  error.value = ''
  try {
    const response = await getFingerprintsApi()
    if (current !== sequence) return
    rules.value = (Array.isArray(response.data) ? response.data : []).filter(
      (rule) => rule.protocol === 'http'
    )
  } catch (cause) {
    if (current === sequence) error.value = cause?.message || '读取规则失败，请重试'
  } finally {
    if (current === sequence) loading.value = false
  }
}
onMounted(loadRules)
onScopeDispose(() => {
  sequence += 1
})
</script>

<style scoped>
.fingerprint-selector {
  display: grid;
  gap: 10px;
  padding: 14px 0;
  border-top: 1px solid var(--el-border-color-lighter);
}
.selector-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
strong {
  font-size: 13px;
}
p {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}
.error {
  color: var(--el-color-danger);
}
</style>
