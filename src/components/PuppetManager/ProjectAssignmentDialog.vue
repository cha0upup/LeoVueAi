<template>
  <el-dialog
    v-model="visible"
    width="560px"
    class="project-assignment-dialog"
    destroy-on-close
    @closed="reset"
  >
    <template #header>
      <div class="assignment-title">
        <span class="assignment-title__icon">
          <el-icon><Icon :icon="iconMap.folderAdd" /></el-icon>
        </span>
        <span>
          <strong>加入项目</strong>
          <small>主机资产保持不变，仅增加项目归属</small>
        </span>
      </div>
    </template>

    <section class="assignment-summary">
      <div>
        <span class="assignment-summary__label">已选择</span>
        <strong>{{ puppets.length }} 个主机节点</strong>
      </div>
      <div
        class="assignment-hosts"
        :title="puppetNames.join('、')"
      >
        <span
          v-for="name in puppetNames.slice(0, 3)"
          :key="name"
        >{{ name }}</span>
        <span v-if="puppetNames.length > 3">+{{ puppetNames.length - 3 }}</span>
      </div>
    </section>

    <div class="assignment-section-title">
      <span>选择目标项目</span>
      <small>子节点自动归并到入口主机，同一入口可加入多个项目</small>
    </div>
    <el-input
      ref="searchInput"
      v-model="query"
      clearable
      placeholder="搜索项目名称或编码"
      class="assignment-search"
    >
      <template #prefix>
        <el-icon><Icon :icon="iconMap.search" /></el-icon>
      </template>
    </el-input>

    <div class="assignment-projects">
      <button
        v-for="project in filteredProjects"
        :key="project.projectId"
        type="button"
        class="assignment-project"
        :class="{ selected: projectId === project.projectId }"
        @click="projectId = project.projectId"
      >
        <span class="assignment-project__radio"><i /></span>
        <span class="assignment-project__icon">
          <el-icon><Icon :icon="iconMap.folder" /></el-icon>
        </span>
        <span class="assignment-project__body">
          <strong>{{ project.projectName }}</strong>
          <small>
            {{ project.projectCode || '未设置编码' }} · {{ project.hostCount || 0 }} 台入口主机
          </small>
        </span>
      </button>
      <div
        v-if="!filteredProjects.length"
        class="assignment-empty"
      >
        <el-icon><Icon :icon="iconMap.folder" /></el-icon>
        <strong>{{ editableProjects.length ? '没有匹配项目' : '暂无可维护的进行中项目' }}</strong>
        <small>可先新建项目，再整理主机归属</small>
      </div>
    </div>

    <div
      v-if="selectedProject"
      class="assignment-options"
    >
      <div>
        <strong>项目环境</strong>
        <small>用于标记这批主机在项目中的用途</small>
      </div>
      <el-select
        v-model="environment"
        clearable
        placeholder="暂不标记"
        style="width: 150px"
      >
        <el-option
          label="开发"
          value="dev"
        />
        <el-option
          label="测试"
          value="test"
        />
        <el-option
          label="预发布"
          value="staging"
        />
        <el-option
          label="生产"
          value="prod"
        />
      </el-select>
    </div>

    <template #footer>
      <div class="assignment-footer">
        <span class="assignment-footer__destination">
          <template v-if="selectedProject">
            将加入 <strong>{{ selectedProject.projectName }}</strong>
          </template>
          <template v-else>请选择目标项目</template>
        </span>
        <el-button @click="visible = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="saving"
          :disabled="!projectId || !puppets.length"
          @click="save"
        >
          确认加入
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'
import { Icon } from '@iconify/vue'

import { attachProjectPuppetsApi } from '@/services/api.js'
import { icons } from '@/utils/icons.js'
import { showSuccess } from '@/utils/messageUtils.js'

const props = defineProps({
  projects: { type: Array, default: () => [] },
  currentProjectId: { type: String, default: '' }
})
const emit = defineEmits(['saved'])
const iconMap = icons
const visible = ref(false)
const saving = ref(false)
const projectId = ref('')
const environment = ref('')
const puppets = ref([])
const query = ref('')
const searchInput = ref(null)

const editableProjects = computed(() =>
  props.projects.filter(
    (project) =>
      project.status !== 'archived' &&
      project.contentEditable &&
      project.projectId !== props.currentProjectId
  )
)
const normalizedQuery = computed(() => query.value.trim().toLocaleLowerCase())
const filteredProjects = computed(() => {
  const value = normalizedQuery.value
  if (!value) return editableProjects.value
  return editableProjects.value.filter((project) =>
    [project.projectName, project.projectCode, project.description]
      .filter(Boolean)
      .some((field) => String(field).toLocaleLowerCase().includes(value))
  )
})
const selectedProject = computed(
  () => editableProjects.value.find((project) => project.projectId === projectId.value) || null
)
const puppetNames = computed(() =>
  puppets.value.map((item) => item.puppetName || item.puppetId).filter(Boolean)
)

const reset = () => {
  saving.value = false
  projectId.value = ''
  environment.value = ''
  puppets.value = []
  query.value = ''
}

const open = async (rows = [], defaultProjectId = '') => {
  reset()
  puppets.value = rows
  if (editableProjects.value.some((project) => project.projectId === defaultProjectId)) {
    projectId.value = defaultProjectId
  }
  visible.value = true
  await nextTick()
  searchInput.value?.focus?.()
}

const save = async () => {
  if (!projectId.value || !puppets.value.length) return
  saving.value = true
  try {
    const response = await attachProjectPuppetsApi(
      projectId.value,
      puppets.value.map((item) => item.puppetId),
      { environment: environment.value || null }
    )
    const changedCount = Number(response.data?.changedCount ?? puppets.value.length)
    showSuccess(`已将 ${changedCount} 台入口主机加入 ${selectedProject.value?.projectName || '项目'}`)
    visible.value = false
    emit('saved', projectId.value)
  } finally {
    saving.value = false
  }
}

defineExpose({ open })
</script>

<style scoped>
.assignment-title,
.assignment-title > span:last-child,
.assignment-summary,
.assignment-hosts,
.assignment-section-title,
.assignment-project,
.assignment-project__body,
.assignment-options,
.assignment-options > div,
.assignment-footer {
  display: flex;
}

.assignment-title {
  align-items: center;
  gap: 10px;
}

.assignment-title__icon {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 12%, transparent);
}

.assignment-title > span:last-child,
.assignment-project__body,
.assignment-options > div {
  flex-direction: column;
}

.assignment-title strong {
  font-size: 15px;
}

.assignment-title small,
.assignment-options small {
  color: var(--el-text-color-placeholder);
  font-size: 11px;
}

.assignment-summary {
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 11px 12px;
  margin-bottom: 18px;
  border-radius: 9px;
  background: var(--app-control-background-soft);
}

.assignment-summary > div:first-child {
  display: flex;
  align-items: baseline;
  gap: 7px;
}

.assignment-summary__label {
  color: var(--el-text-color-placeholder);
  font-size: 11px;
}

.assignment-summary strong {
  font-size: 13px;
}

.assignment-hosts {
  min-width: 0;
  justify-content: flex-end;
  gap: 4px;
  overflow: hidden;
}

.assignment-hosts span {
  max-width: 92px;
  padding: 2px 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--app-card-background);
  color: var(--el-text-color-secondary);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.assignment-section-title {
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 7px;
  font-size: 12px;
  font-weight: 700;
}

.assignment-section-title small {
  color: var(--el-text-color-placeholder);
  font-size: 10px;
  font-weight: 400;
}

.assignment-search {
  margin-bottom: 8px;
}

.assignment-projects {
  max-height: 250px;
  min-height: 110px;
  overflow-y: auto;
  padding: 2px;
}

.assignment-project {
  width: 100%;
  align-items: center;
  gap: 9px;
  padding: 9px;
  margin-bottom: 5px;
  border: 1px solid var(--app-divider-color);
  border-radius: 9px;
  background: var(--app-card-background);
  color: var(--el-text-color-primary);
  text-align: left;
  cursor: pointer;
}

.assignment-project:hover {
  border-color: color-mix(in srgb, var(--el-color-primary) 35%, var(--el-border-color));
}

.assignment-project.selected {
  border-color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 7%, var(--app-card-background));
}

.assignment-project__radio {
  width: 15px;
  height: 15px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border: 1px solid var(--el-border-color-darker);
  border-radius: 50%;
}

.assignment-project.selected .assignment-project__radio {
  border-color: var(--el-color-primary);
}

.assignment-project.selected .assignment-project__radio i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--el-color-primary);
}

.assignment-project__icon {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border-radius: 8px;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 11%, transparent);
}

.assignment-project__body {
  min-width: 0;
  flex: 1;
}

.assignment-project__body strong,
.assignment-project__body small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.assignment-project__body strong {
  font-size: 12px;
}

.assignment-project__body small {
  color: var(--el-text-color-placeholder);
  font-size: 10px;
}

.assignment-empty {
  min-height: 110px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 4px;
  color: var(--el-text-color-placeholder);
}

.assignment-empty strong {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.assignment-empty small {
  font-size: 10px;
}

.assignment-options {
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 11px 12px;
  margin-top: 10px;
  border-top: 1px solid var(--app-divider-color);
}

.assignment-options strong {
  font-size: 12px;
}

.assignment-footer {
  width: 100%;
  align-items: center;
}

.assignment-footer__destination {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--el-text-color-placeholder);
  font-size: 11px;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.assignment-footer__destination strong {
  color: var(--el-text-color-primary);
}
</style>
