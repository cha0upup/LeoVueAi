<template>
  <section class="project-workspace">
    <div class="project-workspace__eyebrow">
      <span>项目工作区</span>
      <span
        v-if="projects.length"
        class="project-workspace__count"
      >
        {{ activeProjects.length }} 进行中 · {{ archivedProjects.length }} 已归档
      </span>
    </div>

    <div class="project-workspace__row">
      <el-popover
        v-model:visible="pickerVisible"
        placement="bottom-start"
        :width="336"
        trigger="click"
        popper-class="project-picker-popper"
      >
        <template #reference>
          <button
            class="project-trigger"
            type="button"
            aria-label="切换项目工作区"
            :disabled="loading"
          >
            <span
              class="project-trigger__icon"
              :class="{ unassigned: modelValue === UNASSIGNED_PROJECT_ID }"
            >
              <el-icon :class="{ 'u-spin': loading }">
                <Icon :icon="loading ? iconMap.loading : currentIcon" />
              </el-icon>
            </span>
            <span class="project-trigger__body">
              <strong>{{ currentTitle }}</strong>
              <small>{{ currentSubtitle }}</small>
            </span>
            <el-icon class="project-trigger__chevron">
              <Icon :icon="pickerVisible ? iconMap.arrowUp : iconMap.arrowDown" />
            </el-icon>
          </button>
        </template>

        <div class="project-picker">
          <div class="project-picker__header">
            <strong>切换工作区</strong>
            <button
              type="button"
              class="project-picker__create"
              @click="createProject"
            >
              <el-icon><Icon :icon="iconMap.add" /></el-icon>
              新建
            </button>
          </div>
          <el-input
            ref="searchInput"
            v-model="query"
            size="small"
            clearable
            placeholder="搜索项目名称或编码"
            class="project-picker__search"
          >
            <template #prefix>
              <el-icon><Icon :icon="iconMap.search" /></el-icon>
            </template>
          </el-input>

          <div class="project-picker__list">
            <button
              v-if="matchesAll"
              type="button"
              class="project-option-card project-option-card--all"
              :class="{ selected: modelValue === ALL_PROJECTS_ID }"
              @click="choose(ALL_PROJECTS_ID)"
            >
              <span class="project-option-card__icon">
                <el-icon><Icon :icon="iconMap.server" /></el-icon>
              </span>
              <span class="project-option-card__body">
                <strong>全部资产</strong>
                <small>跨项目查看全部入口主机和活动会话</small>
              </span>
              <el-icon
                v-if="modelValue === ALL_PROJECTS_ID"
                class="selected-check"
              >
                <Icon :icon="iconMap.check" />
              </el-icon>
            </button>
            <button
              v-if="matchesUnassigned"
              type="button"
              class="project-option-card project-option-card--inbox"
              :class="{ selected: modelValue === UNASSIGNED_PROJECT_ID }"
              @click="choose(UNASSIGNED_PROJECT_ID)"
            >
              <span class="project-option-card__icon">
                <el-icon><Icon :icon="iconMap.inbox" /></el-icon>
              </span>
              <span class="project-option-card__body">
                <strong>待整理主机</strong>
                <small>尚未归属任何项目的入口主机</small>
              </span>
              <el-icon
                v-if="modelValue === UNASSIGNED_PROJECT_ID"
                class="selected-check"
              >
                <Icon :icon="iconMap.check" />
              </el-icon>
            </button>

            <section
              v-if="filteredActiveProjects.length"
              class="project-option-group"
            >
              <div class="project-option-group__title">
                <span>进行中</span><small>{{ filteredActiveProjects.length }}</small>
              </div>
              <button
                v-for="project in filteredActiveProjects"
                :key="project.projectId"
                type="button"
                class="project-option-card"
                :class="{ selected: modelValue === project.projectId }"
                @click="choose(project.projectId)"
              >
                <span class="project-option-card__icon">
                  <el-icon><Icon :icon="iconMap.folder" /></el-icon>
                </span>
                <span class="project-option-card__body">
                  <strong>{{ project.projectName || '未命名项目' }}</strong>
                  <small>
                    {{ project.projectCode ? `${project.projectCode} · ` : '' }}{{ project.hostCount || 0 }}
                    主机 · {{ project.activeSessionCount || 0 }} 会话
                  </small>
                </span>
                <el-icon
                  v-if="modelValue === project.projectId"
                  class="selected-check"
                >
                  <Icon :icon="iconMap.check" />
                </el-icon>
              </button>
            </section>
            <section
              v-if="filteredArchivedProjects.length"
              class="project-option-group"
            >
              <div class="project-option-group__title">
                <span>已归档</span><small>{{ filteredArchivedProjects.length }}</small>
              </div>
              <button
                v-for="project in filteredArchivedProjects"
                :key="project.projectId"
                type="button"
                class="project-option-card archived"
                :class="{ selected: modelValue === project.projectId }"
                @click="choose(project.projectId)"
              >
                <span class="project-option-card__icon">
                  <el-icon><Icon icon="mdi:archive-outline" /></el-icon>
                </span>
                <span class="project-option-card__body">
                  <strong>{{ project.projectName || '未命名项目' }}</strong>
                  <small>
                    {{ project.projectCode ? `${project.projectCode} · ` : '' }}{{ project.hostCount || 0 }}
                    主机 · {{ project.activeSessionCount || 0 }} 会话
                  </small>
                </span>
                <el-icon
                  v-if="modelValue === project.projectId"
                  class="selected-check"
                >
                  <Icon :icon="iconMap.check" />
                </el-icon>
              </button>
            </section>

            <div
              v-if="!hasResults"
              class="project-picker__empty"
            >
              <el-icon><Icon :icon="iconMap.search" /></el-icon>
              <span>没有匹配的项目</span>
            </div>
          </div>
        </div>
      </el-popover>

      <el-tooltip
        content="新建项目"
        placement="top"
      >
        <button
          class="workspace-action"
          type="button"
          aria-label="新建项目"
          @click="$emit('create')"
        >
          <el-icon><Icon :icon="iconMap.folderAdd" /></el-icon>
        </button>
      </el-tooltip>
      <el-tooltip
        v-if="activeProject?.manageable"
        content="项目设置"
        placement="top"
      >
        <button
          class="workspace-action"
          type="button"
          aria-label="项目设置"
          @click="$emit('edit', activeProject)"
        >
          <el-icon><Icon :icon="iconMap.settings" /></el-icon>
        </button>
      </el-tooltip>
    </div>

    <div class="project-workspace__meta">
      <template v-if="activeProject">
        <span
          class="workspace-state"
          :class="activeProject.status"
        >
          <i />{{ activeProject.status === 'archived' ? '只读归档' : '进行中' }}
        </span>
        <span><strong>{{ activeProject.hostCount }}</strong> 入口主机</span>
        <span><strong>{{ activeProject.activeSessionCount }}</strong> 活动会话</span>
        <span
          v-if="!activeProject.contentEditable"
          class="workspace-readonly"
        >归属只读</span>
      </template>
      <template v-else>
        <template v-if="modelValue === ALL_PROJECTS_ID">
          <span class="workspace-state all"><i />全局视图</span>
          <span>跨项目管理全部主机和活动会话</span>
        </template>
        <template v-else>
          <span class="workspace-state unassigned"><i />待整理</span>
          <span>为主机选择项目后会从这里移出</span>
        </template>
      </template>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'

import {
  ALL_PROJECTS_ID,
  UNASSIGNED_PROJECT_ID
} from '@/composables/useProjectDirectory.js'
import { icons } from '@/utils/icons.js'

const props = defineProps({
  modelValue: { type: String, required: true },
  projects: { type: Array, default: () => [] },
  activeProject: { type: Object, default: null },
  loading: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue', 'create', 'edit'])

const iconMap = { ...icons, inbox: 'mdi:inbox-arrow-down-outline' }
const pickerVisible = ref(false)
const query = ref('')
const searchInput = ref(null)

const activeProjects = computed(() => props.projects.filter((item) => item.status !== 'archived'))
const archivedProjects = computed(() => props.projects.filter((item) => item.status === 'archived'))
const normalizedQuery = computed(() => query.value.trim().toLocaleLowerCase())
const matches = (project) => {
  if (!normalizedQuery.value) return true
  return [project.projectName, project.projectCode, project.description]
    .filter(Boolean)
    .some((value) => String(value).toLocaleLowerCase().includes(normalizedQuery.value))
}
const filteredActiveProjects = computed(() => activeProjects.value.filter(matches))
const filteredArchivedProjects = computed(() => archivedProjects.value.filter(matches))
const matchesUnassigned = computed(
  () => !normalizedQuery.value || '待整理主机 未归属项目'.includes(normalizedQuery.value)
)
const matchesAll = computed(
  () => !normalizedQuery.value || '全部资产 全部主机 全局'.includes(normalizedQuery.value)
)
const hasResults = computed(
  () =>
    matchesAll.value ||
    matchesUnassigned.value ||
    filteredActiveProjects.value.length > 0 ||
    filteredArchivedProjects.value.length > 0
)
const currentTitle = computed(() => {
  if (props.activeProject) return props.activeProject.projectName
  return props.modelValue === ALL_PROJECTS_ID ? '全部资产' : '待整理主机'
})
const currentSubtitle = computed(() => {
  if (!props.activeProject) {
    return props.modelValue === ALL_PROJECTS_ID ? '跨项目主机与活动会话' : '未归属项目'
  }
  return props.activeProject.projectCode || props.activeProject.description || '项目主机与活动会话'
})
const currentIcon = computed(() => {
  if (props.activeProject) return iconMap.folderOpened
  return props.modelValue === ALL_PROJECTS_ID ? iconMap.server : iconMap.inbox
})

const choose = (projectId) => {
  emit('update:modelValue', projectId)
  pickerVisible.value = false
}
const createProject = () => {
  pickerVisible.value = false
  emit('create')
}

watch(pickerVisible, async (visible) => {
  if (!visible) {
    query.value = ''
    return
  }
  await nextTick()
  searchInput.value?.focus?.()
})
</script>

<style scoped>
.project-workspace {
  margin: 0 8px 8px;
  padding: 10px;
  border: 1px solid var(--app-divider-color);
  border-radius: 10px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--el-color-primary) 6%, transparent), transparent 58%),
    var(--app-surface-background-soft);
}

.project-workspace__eyebrow,
.project-workspace__meta,
.project-workspace__row,
.project-trigger,
.project-picker__header,
.project-option-card,
.project-option-group__title {
  display: flex;
  align-items: center;
}

.project-workspace__eyebrow {
  justify-content: space-between;
  margin-bottom: 7px;
  color: var(--el-text-color-placeholder);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.project-workspace__count {
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
}

.project-workspace__row {
  gap: 6px;
}

.project-workspace__row :deep(.el-popover__reference-wrapper) {
  min-width: 0;
  flex: 1;
}

.project-trigger {
  width: 100%;
  min-width: 0;
  gap: 9px;
  padding: 7px 8px;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 75%, transparent);
  border-radius: 8px;
  background: var(--app-card-background);
  color: var(--el-text-color-primary);
  text-align: left;
  cursor: pointer;
  transition: border-color var(--motion-fast) var(--motion-easing), background var(--motion-fast) var(--motion-easing);
}

.project-trigger:hover {
  border-color: color-mix(in srgb, var(--el-color-primary) 45%, var(--el-border-color));
  background: color-mix(in srgb, var(--el-color-primary) 4%, var(--app-card-background));
}

.project-trigger__icon,
.project-option-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 12%, transparent);
}

.project-trigger__icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  font-size: 17px;
}

.project-trigger__icon.unassigned {
  color: var(--el-color-warning-dark-2);
  background: color-mix(in srgb, var(--el-color-warning) 13%, transparent);
}

.project-trigger__body,
.project-option-card__body {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
}

.project-trigger__body strong,
.project-trigger__body small,
.project-option-card__body strong,
.project-option-card__body small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-trigger__body strong {
  font-size: 13px;
  line-height: 18px;
}

.project-trigger__body small {
  color: var(--el-text-color-placeholder);
  font-size: 10px;
}

.project-trigger__chevron {
  color: var(--el-text-color-placeholder);
}

.workspace-action {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border: 1px solid var(--app-divider-color);
  border-radius: 8px;
  background: var(--app-card-background);
  color: var(--el-text-color-secondary);
  cursor: pointer;
}

.workspace-action:hover {
  color: var(--el-color-primary);
  border-color: color-mix(in srgb, var(--el-color-primary) 35%, var(--el-border-color));
}

.project-workspace__meta {
  min-height: 19px;
  margin-top: 8px;
  gap: 9px;
  color: var(--el-text-color-placeholder);
  font-size: 10px;
}

.project-workspace__meta strong {
  color: var(--el-text-color-regular);
  font-weight: 700;
}

.workspace-state {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--el-color-success-dark-2);
  font-weight: 700;
}

.workspace-state i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.workspace-state.archived,
.workspace-state.unassigned,
.workspace-readonly {
  color: var(--el-text-color-secondary);
}

.workspace-state.all {
  color: var(--el-color-primary);
}

.workspace-readonly {
  margin-left: auto;
  padding: 1px 5px;
  border-radius: 999px;
  background: var(--app-hover-background);
}

.project-picker {
  margin: -4px;
}

.project-picker__header {
  justify-content: space-between;
  margin-bottom: 10px;
}

.project-picker__header strong {
  font-size: 13px;
}

.project-picker__create {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  border: 0;
  background: transparent;
  color: var(--el-color-primary);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.project-picker__search {
  margin-bottom: 8px;
}

.project-picker__list {
  max-height: 380px;
  overflow-y: auto;
  padding-right: 2px;
}

.project-option-group {
  margin-top: 9px;
}

.project-option-group__title {
  justify-content: space-between;
  padding: 0 5px 4px;
  color: var(--el-text-color-placeholder);
  font-size: 10px;
  font-weight: 700;
}

.project-option-group__title small {
  font-weight: 500;
}

.project-option-card {
  width: 100%;
  gap: 9px;
  padding: 7px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--el-text-color-primary);
  text-align: left;
  cursor: pointer;
}

.project-option-card:hover,
.project-option-card.selected {
  background: var(--app-hover-background);
}

.project-option-card.selected {
  border-color: color-mix(in srgb, var(--el-color-primary) 24%, transparent);
}

.project-option-card.archived {
  opacity: 0.72;
}

.project-option-card__icon {
  width: 28px;
  height: 28px;
  border-radius: 7px;
}

.project-option-card--inbox .project-option-card__icon {
  color: var(--el-color-warning-dark-2);
  background: color-mix(in srgb, var(--el-color-warning) 13%, transparent);
}

.project-option-card--all .project-option-card__icon {
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 12%, transparent);
}

.project-option-card__body strong {
  font-size: 12px;
  line-height: 17px;
}

.project-option-card__body small {
  color: var(--el-text-color-placeholder);
  font-size: 10px;
}

.selected-check {
  display: inline-flex;
  flex: 0 0 auto;
  color: var(--el-color-primary);
  font-size: 15px;
}

.project-picker__empty {
  min-height: 110px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 6px;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}
</style>
