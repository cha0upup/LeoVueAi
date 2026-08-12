<template>
  <div
    class="entity-card"
    :class="{
      active: active,
      disabled: disabled,
      'is-selected': selected,
      'has-selection': inSelectionMode
    }"
    role="button"
    tabindex="0"
    @click="onClick"
    @keyup.enter="onClick"
  >
    <div class="entity-top">
      <!-- 多选 checkbox：默认隐藏，hover/选中态/进入多选模式时显示 -->
      <div
        v-if="selectable"
        class="entity-checkbox"
        @click.stop="toggleSelected"
      >
        <el-checkbox
          :model-value="selected"
          @click.stop
          @change="toggleSelected"
        />
      </div>

      <!-- 左侧 icon -->
      <div
        v-if="icon || $slots.icon"
        class="entity-icon"
        :class="{ 'entity-icon-disabled': disabled }"
      >
        <slot name="icon">
          <el-icon><Icon :icon="icon" /></el-icon>
        </slot>
      </div>

      <!-- 主内容 -->
      <div class="entity-main">
        <div class="entity-title-row">
          <strong>{{ title }}</strong>
          <slot name="badge" />
        </div>
        <span class="entity-desc">{{ description || '暂无描述' }}</span>
        <div
          v-if="tags && tags.length"
          class="entity-tags"
        >
          <el-tag
            v-for="t in tags"
            :key="t"
            size="small"
            type="info"
            effect="plain"
            round
          >
            {{ t }}
          </el-tag>
        </div>
        <slot name="extra" />
      </div>

      <!-- 右侧：状态 chip + hover 操作按钮 -->
      <div class="entity-aside">
        <slot name="status">
          <el-tag
            v-if="disabled"
            size="small"
            type="info"
            effect="plain"
            class="disabled-tag"
          >
            禁用
          </el-tag>
        </slot>
        <div
          v-if="$slots.actions"
          class="entity-actions"
        >
          <slot name="actions" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { Icon } from '@iconify/vue'

/**
 * 通用「实体卡片」——用于 list+detail 模块的列表项。
 *
 * 三种交互态可独立组合：
 * - active：当前打开的项（左侧 primary 高亮条 + 浅蓝背景）
 * - selected：批量选中中（边框 primary 40% + 浅蓝背景）
 * - disabled：业务上的禁用状态（去饱和 + 半透明）
 *
 * 槽：
 * - icon：左侧 32×32 容器（默认走 icon prop）
 * - badge：标题旁的 chip（如文件数）
 * - extra：标签下方的额外行
 * - status：右上角状态 tag（默认 disabled 时显示「禁用」）
 * - actions：右下角操作按钮（hover 时显示，建议用 .u-icon-btn）
 *
 * 事件：
 * - click（item）：单击；批量模式下不触发，由 toggle 处理
 * - toggle-selected（boolean）：选中状态变化
 */

const props = defineProps({
  title:       { type: String, required: true },
  description: { type: String, default: '' },
  icon:        { type: String, default: '' },
  tags:        { type: Array, default: () => [] },
  active:      { type: Boolean, default: false },
  disabled:    { type: Boolean, default: false },
  selectable:  { type: Boolean, default: false },
  selected:    { type: Boolean, default: false },
  /** 是否处于「至少有一个被选中」的批量模式：影响点击行为和 checkbox 显示 */
  inSelectionMode: { type: Boolean, default: false }
})

const emit = defineEmits(['click', 'toggle-selected'])

const onClick = () => {
  if (props.selectable && props.inSelectionMode) {
    emit('toggle-selected', !props.selected)
    return
  }
  emit('click')
}

const toggleSelected = (val) => {
  emit('toggle-selected', typeof val === 'boolean' ? val : !props.selected)
}
</script>

<style scoped>
.entity-card {
  width: 100%;
  padding: var(--list-item-padding-y) var(--list-item-padding-x);
  margin-bottom: var(--list-item-gap-vertical);
  border: 1px solid var(--app-surface-border-subtle);
  border-radius: var(--list-item-radius);
  background: color-mix(in srgb, var(--app-card-background) 90%, var(--app-control-background-soft));
  text-align: left;
  cursor: pointer;
  transition: border-color var(--motion-base) var(--motion-easing),
              background var(--motion-base) var(--motion-easing);
}

.entity-card:hover {
  border-color: var(--list-item-hover-border);
  background: var(--list-item-hover-bg);
  box-shadow: none;
}

.entity-card:focus-visible {
  outline: var(--focus-outline);
  outline-offset: var(--focus-outline-offset);
}

.entity-card.active {
  border-color: var(--list-item-active-border);
  background: var(--list-item-active-bg);
  box-shadow: inset 3px 0 0 var(--list-item-active-bar);
}

.entity-card.is-selected {
  border-color: var(--list-item-selected-border);
  background: var(--list-item-selected-bg);
}

.entity-card.disabled {
  opacity: var(--disabled-opacity);
  filter: saturate(var(--disabled-saturation));
}

.entity-card.disabled:hover {
  opacity: var(--disabled-opacity-hover);
  filter: saturate(var(--disabled-saturation-hover));
}

.entity-card.disabled .entity-main strong,
.entity-card.disabled .entity-main .entity-desc {
  color: var(--el-text-color-disabled);
}

.entity-icon-disabled {
  color: var(--el-text-color-placeholder) !important;
  background: var(--el-fill-color) !important;
}

.entity-top {
  display: flex;
  align-items: center;
  gap: var(--list-item-gap-horizontal);
}

.entity-icon {
  width: var(--list-item-icon-size);
  height: var(--list-item-icon-size);
  border-radius: var(--list-item-icon-radius);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 10%, var(--app-control-background));
}

.entity-main {
  min-width: 0;
  flex: 1;
}

.entity-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.entity-main strong {
  font-size: 13px;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.entity-main .entity-desc {
  display: block;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

.entity-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}

.entity-tags :deep(.el-tag) {
  height: 18px;
  padding: 0 6px;
  font-size: 11px;
}

.entity-aside {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
  margin-left: auto;
}

.disabled-tag {
  flex-shrink: 0;
}

/* 多选 checkbox：默认隐藏，根据交互态显示 */
.entity-checkbox {
  display: none;
  align-items: center;
  margin-right: -2px;
  flex-shrink: 0;
}

.entity-card:hover .entity-checkbox,
.entity-card.is-selected .entity-checkbox,
.entity-card.has-selection .entity-checkbox {
  display: inline-flex;
}

.entity-checkbox :deep(.el-checkbox) {
  height: 18px;
}

.entity-checkbox :deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
  background-color: var(--el-color-primary);
  border-color: var(--el-color-primary);
}

/* hover 操作按钮：在卡片 hover 时淡入；包一层 .entity-actions
   是为了不依赖 slot 内容的根元素结构（用 :slotted 会被 el-tooltip
   等 wrapper 截胡）。 */
.entity-actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--motion-fast) var(--motion-easing);
}

.entity-card:hover .entity-actions,
.entity-card:focus-within .entity-actions {
  opacity: 1;
  pointer-events: auto;
}

/* 进入批量模式时不再露出 hover 操作（避免和 checkbox 语义冲突） */
.entity-card.has-selection .entity-actions {
  opacity: 0;
  pointer-events: none;
}
</style>
