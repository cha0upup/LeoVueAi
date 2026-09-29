<template>
  <div class="form-group obfus-editor">
    <details class="obfus-disclosure">
      <summary class="obfus-summary">
        <strong>JSP 混淆层</strong>
        <span>{{ enabledStepCount }}/{{ localSteps.length }} 已启用</span>
        <Icon :icon="iconMap.arrowDown" />
      </summary>

      <div class="obfus-content">
        <!-- 步骤列表 -->
        <div class="obfus-list">
          <template
            v-for="(item, idx) in renderedItems"
            :key="item.type === 'single' ? item.step.id : item.groupId"
          >
            <!-- 普通步骤 -->
            <div
              v-if="item.type === 'single'"
              class="obfus-item"
              :class="{
                'is-enabled': item.step.enabled,
                'is-blocked': blockedByEnabled.has(item.step.id) && !item.step.enabled,
                'has-order-warning': orderViolations.has(item.step.id),
                'is-drop-target': dropTargetIdx === idx && dragFromIdx >= 0 && dragFromIdx !== idx
              }"
              draggable="true"
              @dragstart="onDragStart(idx)"
              @dragover.prevent="onDragOver(idx)"
              @dragend="onDragEnd"
            >
              <span
                class="drag-handle"
                title="拖拽排序"
              >⠿</span>
              <el-switch
                v-model="item.step.enabled"
                size="small"
                @change="onStepToggle(item.step)"
              />
              <div class="step-info">
                <span class="step-name">{{ item.step.nameZh }}</span>
                <span class="step-compat">
                  <el-tag
                    v-if="item.step.jspCompatible"
                    size="small"
                    type="primary"
                    effect="plain"
                  >JSP</el-tag>
                  <el-tag
                    v-if="item.step.jspxCompatible"
                    size="small"
                    type="warning"
                    effect="plain"
                  >JSPX</el-tag>
                </span>
              </div>
              <el-tooltip
                v-if="orderViolations.has(item.step.id)"
                :content="orderViolationHint(item.step)"
                placement="left"
                :show-after="150"
              >
                <span class="step-icon step-icon--warn">⚠</span>
              </el-tooltip>
              <el-tooltip
                :content="item.step.description"
                placement="left"
                :show-after="200"
              >
                <Icon
                  :icon="iconMap.info"
                  class="step-desc-icon"
                />
              </el-tooltip>
            </div>

            <!-- 互斥步骤组 -->
            <div
              v-else
              class="obfus-mutex-group"
              :class="{ 'is-drop-target': dropTargetIdx === idx && dragFromIdx >= 0 && dragFromIdx !== idx }"
              draggable="true"
              @dragstart="onDragStart(idx)"
              @dragover.prevent="onDragOver(idx)"
              @dragend="onDragEnd"
            >
              <div class="mutex-group-header">
                <span
                  class="drag-handle"
                  title="拖拽排序"
                >⠿</span>
                <span class="mutex-group-label">选其一</span>
              </div>
              <div class="mutex-group-items">
                <div
                  v-for="step in item.steps"
                  :key="step.id"
                  class="obfus-item mutex-option"
                  :class="{ 'is-enabled': step.enabled, 'has-order-warning': orderViolations.has(step.id) }"
                >
                  <el-switch
                    v-model="step.enabled"
                    size="small"
                    @change="onStepToggle(step)"
                  />
                  <div class="step-info">
                    <span class="step-name">{{ step.nameZh }}</span>
                    <span class="step-compat">
                      <el-tag
                        v-if="step.jspCompatible"
                        size="small"
                        type="primary"
                        effect="plain"
                      >JSP</el-tag>
                      <el-tag
                        v-if="step.jspxCompatible"
                        size="small"
                        type="warning"
                        effect="plain"
                      >JSPX</el-tag>
                    </span>
                  </div>
                  <el-tooltip
                    v-if="orderViolations.has(step.id)"
                    :content="orderViolationHint(step)"
                    placement="left"
                    :show-after="150"
                  >
                    <span class="step-icon step-icon--warn">⚠</span>
                  </el-tooltip>
                  <el-tooltip
                    :content="step.description"
                    placement="left"
                    :show-after="200"
                  >
                    <Icon
                      :icon="iconMap.info"
                      class="step-desc-icon"
                    />
                  </el-tooltip>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- 操作按钮行 -->
        <div class="obfus-actions">
          <button
            type="button"
            class="obfus-link-btn"
            @click="resetToDefault"
          >
            重置
          </button>
          <button
            type="button"
            class="obfus-link-btn"
            @click="enableAll"
          >
            全部启用
          </button>
          <button
            type="button"
            class="obfus-link-btn"
            @click="disableAll"
          >
            全部禁用
          </button>
          <button
            v-if="orderViolations.size > 0"
            type="button"
            class="obfus-link-btn obfus-link-btn--warn"
            @click="fixOrder"
          >
            修复顺序
          </button>
        </div>
      </div>
    </details>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { icons } from '@/utils/icons.js'
import {
  MEMSHELL_DEFAULTS,
} from './scriptGeneratorConstants.js'

const iconMap = icons

const props = defineProps({
  obfuscationSteps:      { type: Array,  default: () => [] },
  packerObfuscationSteps:{ type: Object, default: () => ({}) },
  packerTypesStructure:  { type: Object, required: true },
  generateType:          { type: String, required: true },
  shellType:             { type: String, default: '' },
  packerType:            { type: String, default: '' },
})

const modelValue = defineModel({ type: Array, default: () => [] })

// ---- 本地步骤状态 ----

const localSteps = ref([])
const enabledStepCount = computed(() => localSteps.value.filter(step => step.enabled).length)

const syncLocalSteps = () => {
  const type = props.generateType
  let allSteps

  if (type === 'webshell') {
    const isJspx = props.shellType === 'JSPX'
    allSteps = props.obfuscationSteps.filter(s =>
      (s.webshellCompatible !== false) && (isJspx ? s.jspxCompatible : s.jspCompatible)
    )
  } else {
    const pt = props.packerType
    const allowedIds = pt && props.packerObfuscationSteps[pt]?.length
      ? new Set(props.packerObfuscationSteps[pt])
      : null
    allSteps = allowedIds === null
      ? props.obfuscationSteps
      : props.obfuscationSteps.filter(s => allowedIds.has(s.id))
  }

  const prev = Object.fromEntries(localSteps.value.map(s => [s.id, s.enabled]))
  const isWebshell = type === 'webshell'

  localSteps.value = allSteps.map(s => {
    if (prev[s.id] !== undefined) return { ...s, enabled: prev[s.id] }
    if (modelValue.value?.length) return { ...s, enabled: modelValue.value.includes(s.id) }
    return { ...s, enabled: !isWebshell && MEMSHELL_DEFAULTS.has(s.id) }
  })
}

watch(() => props.obfuscationSteps, syncLocalSteps, { immediate: true })
watch(() => props.packerType, () => { modelValue.value = []; syncLocalSteps(); emitSteps() })
watch(() => props.shellType, (nv, ov) => {
  if (props.generateType !== 'webshell' || nv === ov) return
  modelValue.value = []; syncLocalSteps(); emitSteps()
})

// ---- 互斥可视化 ----

const blockedByEnabled = computed(() => {
  const blocked = new Set()
  localSteps.value.forEach(s => {
    if (!s.enabled) return
    s.incompatibleWith.forEach(id => blocked.add(id))
  })
  return blocked
})

// ---- 互斥分组 ----

const mutexGroups = computed(() => {
  const groups = new Map()
  localSteps.value.forEach(s => {
    const inc = s.incompatibleWith
    if (!inc.length) return
    let found = null
    for (const [, ids] of groups) { if (ids.has(s.id)) { found = ids; break } }
    if (found) { inc.forEach(id => found.add(id)) }
    else {
      const ids = new Set([s.id, ...inc])
      groups.set([...ids].sort().join('|'), ids)
    }
  })
  return groups
})

const mutexGroupMap = computed(() => {
  const map = new Map()
  for (const [key, ids] of mutexGroups.value) for (const id of ids) map.set(id, key)
  return map
})

const renderedItems = computed(() => {
  const items = []
  const seen = new Set()
  localSteps.value.forEach(s => {
    const gid = mutexGroupMap.value.get(s.id)
    if (!gid) { items.push({ type: 'single', step: s }) }
    else if (!seen.has(gid)) {
      seen.add(gid)
      items.push({ type: 'group', groupId: gid, steps: localSteps.value.filter(x => mutexGroupMap.value.get(x.id) === gid) })
    }
  })
  return items
})

// ---- 顺序约束 ----

const orderViolations = computed(() => {
  const v = new Set()
  const idxMap = {}
  localSteps.value.forEach((s, i) => { idxMap[s.id] = i })
  localSteps.value.forEach(s => {
    if (!s.enabled) return
    s.mustPrecede.forEach(afterId => { if (idxMap[afterId] !== undefined && idxMap[afterId] < idxMap[s.id]) v.add(s.id) })
  })
  return v
})

const orderViolationHint = (step) => {
  const names = step.mustPrecede.map(id => localSteps.value.find(s => s.id === id)?.nameZh || id).join('、')
  return `建议在「${names}」之前执行`
}

// ---- 写回 ----

const emitSteps = () => {
  modelValue.value = localSteps.value.filter(s => s.enabled).map(s => s.id)
}

const onStepToggle = (step) => {
  if (step.enabled) {
    const inc = new Set(step.incompatibleWith)
    localSteps.value.forEach(s => {
      if (s.id === step.id) return
      if (inc.has(s.id)) { s.enabled = false; return }
      if (s.incompatibleWith.includes(step.id)) s.enabled = false
    })
  }
  emitSteps()
}

const resetToDefault = () => {
  if (props.generateType === 'webshell') localSteps.value.forEach(s => { s.enabled = false })
  else localSteps.value.forEach(s => { s.enabled = MEMSHELL_DEFAULTS.has(s.id) })
  emitSteps()
}

const enableAll = () => {
  const skipped = new Set()
  localSteps.value.forEach(s => {
    if (skipped.has(s.id)) { s.enabled = false; return }
    s.enabled = true
    s.incompatibleWith.forEach(id => skipped.add(id))
  })
  emitSteps()
}

const disableAll = () => { localSteps.value.forEach(s => { s.enabled = false }); emitSteps() }

const fixOrder = () => {
  const steps = [...localSteps.value]
  const idxOf = (id) => steps.findIndex(s => s.id === id)
  let changed = true, iter = 0
  while (changed && iter < steps.length * steps.length) {
    changed = false; iter++
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i]
      if (!s.enabled) continue
      for (const afterId of s.mustPrecede) {
        const ai = idxOf(afterId)
        if (ai !== -1 && ai < i) { steps.splice(i, 1); steps.splice(ai, 0, s); changed = true; break }
      }
      if (changed) break
    }
  }
  localSteps.value = steps; emitSteps()
}

// ---- 拖拽排序 ----

const dragFromIdx  = ref(-1)
const dropTargetIdx = ref(-1)

const onDragStart = (idx) => { dragFromIdx.value = idx; dropTargetIdx.value = -1 }
const onDragOver  = (idx) => {
  dropTargetIdx.value = idx
  if (dragFromIdx.value < 0 || dragFromIdx.value === idx) return
  const items = [...renderedItems.value]
  const [moved] = items.splice(dragFromIdx.value, 1)
  items.splice(idx, 0, moved)
  const newOrder = items.flatMap(item => item.type === 'single' ? [item.step.id] : item.steps.map(s => s.id))
  const stepMap = Object.fromEntries(localSteps.value.map(s => [s.id, s]))
  localSteps.value = newOrder.map(id => stepMap[id]).filter(Boolean)
  dragFromIdx.value = idx
}
const onDragEnd = () => { dragFromIdx.value = -1; dropTargetIdx.value = -1; emitSteps() }
</script>

<style scoped>
.obfus-disclosure { border-top: 0; }
.obfus-summary { display: flex; align-items: center; gap: 8px; min-height: 34px; padding: 0 2px; color: var(--sg-ink); cursor: pointer; list-style: none; }
.obfus-summary::-webkit-details-marker { display: none; }
.obfus-summary strong { font-size: 11px; }
.obfus-summary span { margin-right: auto; color: var(--sg-muted); font-size: 9px; }
.obfus-summary > svg { color: var(--sg-muted); transition: transform .16s ease; }
.obfus-disclosure[open] .obfus-summary { margin-bottom: 8px; }
.obfus-disclosure[open] .obfus-summary > svg { transform: rotate(180deg); }
.obfus-content { padding-top: 1px; }
/* 步骤列表 */
.obfus-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  position: relative;
}
.obfus-item {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 3px 7px;
  border-radius: 6px;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 24%, transparent);
  background: color-mix(in srgb, var(--sg-panel-soft) 58%, transparent);
  transition: background 0.15s, border-color 0.15s;
  cursor: grab;
  user-select: none;
}
.obfus-item.is-enabled {
  border-color: color-mix(in srgb, var(--sg-blue) 30%, transparent);
  background: color-mix(in srgb, var(--sg-blue) 5%, transparent);
}
.obfus-item.is-blocked        { opacity: 0.45; }
.obfus-item.has-order-warning { border-color: color-mix(in srgb, var(--el-color-warning) 50%, var(--sg-border)); }
.obfus-item.is-drop-target,
.obfus-mutex-group.is-drop-target {
  outline: 2px solid var(--sg-blue);
  outline-offset: -1px;
}
.drag-handle {
  color: var(--sg-muted);
  font-size: 14px;
  opacity: 0.45;
  flex-shrink: 0;
}
.step-info {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 5px;
}
.step-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--sg-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.step-compat {
  display: flex;
  gap: 3px;
  flex-shrink: 0;
}
.step-icon          { flex-shrink: 0; font-size: 11px; cursor: default; }
.step-icon--warn    { color: var(--el-color-warning); }
.step-desc-icon {
  color: var(--sg-muted);
  opacity: 0.55;
  flex-shrink: 0;
  font-size: 12px;
}

/* 互斥组 */
.obfus-mutex-group {
  border: 1px solid color-mix(in srgb, var(--el-border-color) 28%, transparent);
  border-radius: 6px;
  background: color-mix(in srgb, var(--sg-panel-soft) 44%, transparent);
  overflow: hidden;
  cursor: grab;
  user-select: none;
}
.mutex-group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 7px;
  border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 20%, transparent);
}
.mutex-group-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--sg-muted);
}
.mutex-group-items { display: flex; flex-direction: column; }
.obfus-item.mutex-option {
  border: none;
  border-radius: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--sg-border) 40%, transparent);
  background: transparent;
  cursor: default;
}
.obfus-item.mutex-option:last-child { border-bottom: none; }
.obfus-item.mutex-option.is-enabled { background: color-mix(in srgb, var(--sg-blue) 7%, transparent); }

/* 操作按钮行 */
.obfus-actions {
  display: flex;
  gap: 9px;
  margin-top: 6px;
  flex-wrap: wrap;
}
.obfus-link-btn {
  padding: 0;
  border: 0;
  background: transparent;
  font-size: 11px;
  color: var(--sg-blue);
  cursor: pointer;
  opacity: 0.75;
}
.obfus-link-btn:hover       { opacity: 1; text-decoration: underline; }
.obfus-link-btn--warn       { color: var(--el-color-warning); }
.obfus-link-btn--warn:hover { color: var(--el-color-warning); }
</style>
