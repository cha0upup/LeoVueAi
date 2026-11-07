<template>
  <div class="skill-manager-root">
    <!-- 能力目录：面向批量治理和快速检索的全宽视图 -->
    <section
      v-if="viewMode === 'catalog'"
      class="catalog-shell"
    >
      <PageHeader
        title="能力库"
        :icon="iconMap.bookOpenPageVariant"
      >
        <template #actions>
          <el-segmented
            v-if="isAdmin"
            v-model="catalogMode"
            :options="catalogModeOptions"
            size="small"
            aria-label="目录视图"
          />
          <el-button
            v-if="isAdmin"
            type="primary"
            @click="showNewDialog = true"
          >
            <el-icon><Icon :icon="iconMap.add" /></el-icon>
            新增 Skill
          </el-button>
          <el-dropdown
            trigger="click"
            @command="handleCatalogCommand"
          >
            <el-badge
              :value="catalogSummary.problems"
              :hidden="catalogSummary.problems === 0"
              type="warning"
            >
              <el-button aria-label="更多能力库操作">
                <el-icon><Icon :icon="iconMap.more" /></el-icon>
              </el-button>
            </el-badge>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-if="isAdmin"
                  command="import"
                >
                  导入 Skill
                </el-dropdown-item>
                <el-dropdown-item command="health">
                  健康检查<span v-if="catalogSummary.problems">（{{ catalogSummary.problems }}）</span>
                </el-dropdown-item>
                <el-dropdown-item command="refresh">
                  刷新目录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
      </PageHeader>

      <StatsStrip :columns="4">
        <button
          type="button"
          class="metric-card"
          :class="{ 'is-active': !filters.availability && !filters.health }"
          :aria-pressed="!filters.availability && !filters.health"
          @click="applyQuickFilter('all')"
        >
          <span class="metric-label">全部</span>
          <strong class="metric-value">{{ catalogSummary.total }}</strong>
          <span class="metric-hint">当前 Scope</span>
        </button>
        <button
          type="button"
          class="metric-card metric-card--success"
          :class="{ 'is-active': filters.availability === 'runtime' }"
          :aria-pressed="filters.availability === 'runtime'"
          @click="applyQuickFilter('runtime')"
        >
          <span class="metric-label">可运行</span>
          <strong class="metric-value">{{ catalogSummary.runtime }}</strong>
          <span class="metric-hint">已进入目录</span>
        </button>
        <button
          type="button"
          class="metric-card metric-card--warning"
          :class="{ 'is-active': filters.availability === 'controlled' }"
          :aria-pressed="filters.availability === 'controlled'"
          @click="applyQuickFilter('controlled')"
        >
          <span class="metric-label">受控启用</span>
          <strong class="metric-value">{{ catalogSummary.controlled }}</strong>
          <span class="metric-hint">需授权确认</span>
        </button>
        <button
          type="button"
          class="metric-card metric-card--danger"
          :class="{ 'is-active': filters.health === 'problems' }"
          :aria-pressed="filters.health === 'problems'"
          @click="applyQuickFilter('problems')"
        >
          <span class="metric-label">存在问题</span>
          <strong class="metric-value">{{ catalogSummary.problems }}</strong>
          <span class="metric-hint">警告或错误</span>
        </button>
      </StatsStrip>

      <section class="catalog-panel">
        <div class="catalog-toolbar">
          <div
            class="scope-tabs"
            role="tablist"
            aria-label="Skill Scope"
          >
            <button
              v-for="scope in scopes"
              :key="scope.value"
              type="button"
              role="tab"
              class="scope-tab"
              :class="{ 'is-active': activeScope === scope.value }"
              :aria-selected="activeScope === scope.value"
              @click="activeScope = scope.value"
            >
              {{ scope.label }}
              <span>{{ scopeCount(scope.value) }}</span>
            </button>
          </div>

          <el-input
            v-model="searchKeyword"
            placeholder="搜索名称、描述、ID、分类或正文"
            clearable
            class="catalog-search"
            :loading="searchLoading"
          >
            <template #prefix>
              <el-icon><Icon :icon="iconMap.search" /></el-icon>
            </template>
          </el-input>

          <SkillCatalogFilters
            :filters="filters"
            :fields="catalogFilterFields"
            :mode="catalogMode"
            @change="setFilter"
            @clear="clearFilters"
          />
        </div>

        <div
          v-if="activeFilterEntries.length || searchError"
          class="active-filter-row"
        >
          <span
            v-if="activeFilterEntries.length"
            class="active-filter-label"
          >已筛选</span>
          <el-tag
            v-for="entry in activeFilterEntries"
            :key="entry.key"
            closable
            effect="plain"
            @close="removeFilter(entry.key)"
          >
            {{ entry.label }}：{{ entry.value }}
          </el-tag>
          <span
            v-if="searchError"
            class="search-error"
          >{{ searchError }}</span>
          <span class="catalog-result-count">显示 {{ filteredSkills.length }} / {{ skills.length }}</span>
        </div>
        <div
          v-else
          class="catalog-result-row"
        >
          <span>显示 {{ filteredSkills.length }} / {{ skills.length }} 个 Skill</span>
          <span>双击行或点击“打开”进入 Skill 工作台</span>
        </div>

        <BatchActionBar
          :count="selectedNames.size"
          :total-label="filteredSkills.length"
          :all-selected="allFilteredSelected"
          :some-selected="someFilteredSelected"
          @toggle-all="toggleSelectAll"
          @clear="clearBatchSelection"
        >
          <el-button
            v-if="isAdmin"
            size="small"
            type="success"
            :loading="batchToggleLoading"
            :disabled="!hasBatchEnableTarget"
            @click="handleBatchToggle(true)"
          >
            启用
          </el-button>
          <el-button
            v-if="isAdmin"
            size="small"
            :loading="batchToggleLoading"
            :disabled="!hasBatchDisableTarget"
            @click="handleBatchToggle(false)"
          >
            禁用
          </el-button>
          <el-button
            size="small"
            :loading="batchExportLoading"
            @click="handleBatchExport"
          >
            导出 zip
          </el-button>
          <el-button
            v-if="isAdmin"
            size="small"
            type="danger"
            :loading="batchDeleteLoading"
            @click="handleBatchDelete"
          >
            删除
          </el-button>
        </BatchActionBar>

        <SkillCatalogTable
          :items="filteredSkills"
          :selected-names="selectedNames"
          :mode="catalogMode"
          :loading="catalogLoading"
          :is-admin="isAdmin"
          @selection-change="setSelection"
          @open="openWorkspace"
          @toggle="handleToggleForSkill"
          @command="handleSkillCommand"
        />
      </section>
    </section>

    <!-- Skill 工作台：结构化概览、文件编辑和校验闭环 -->
    <section
      v-else-if="selectedSkill"
      class="workspace-shell"
    >
      <header class="workspace-header">
        <div class="workspace-title-wrap">
          <el-button
            class="back-button"
            text
            aria-label="返回能力目录"
            @click="backToCatalog"
          >
            <el-icon><Icon icon="mdi:arrow-left" /></el-icon>
          </el-button>
          <div class="workspace-skill-icon">
            <Icon :icon="iconMap.bookOpenPageVariant" />
          </div>
          <div class="workspace-title">
            <div class="workspace-title-row">
              <h1>{{ selectedSkill.name }}</h1>
              <SkillAvailabilityTag :skill="selectedSkill" />
              <el-tag
                v-if="selectedSkill.requiresExplicitApproval"
                type="warning"
                effect="plain"
                size="small"
                round
              >
                需要显式授权
              </el-tag>
            </div>
            <p>{{ selectedSkill.description }}</p>
            <div class="workspace-meta">
              <span>{{ activeScope }}</span>
              <span>{{ selectedSkill.category }}</span>
              <span>{{ selectedSkill.version }}</span>
              <span>{{ skillFiles.length }} 文件</span>
              <span
                v-if="dirtyFilePaths.length"
                class="meta-warning"
              >
                {{ dirtyFilePaths.length }} 个未保存
              </span>
              <span v-else>已保存</span>
            </div>
          </div>
        </div>
        <div class="workspace-actions">
          <el-badge
            :value="selectedIssues.length"
            :hidden="selectedIssues.length === 0"
            :type="selectedErrorCount ? 'danger' : 'warning'"
          >
            <el-button @click="showIssueDrawer = true">
              <el-icon><Icon icon="mdi:shield-check-outline" /></el-icon>
              {{ selectedIssues.length ? '查看问题' : '校验通过' }}
            </el-button>
          </el-badge>
          <el-button
            v-if="isAdmin"
            @click="showManifestEditor = true"
          >
            <el-icon><Icon icon="mdi:tune-variant" /></el-icon>
            编辑配置
          </el-button>
          <el-button
            v-if="isAdmin"
            :type="selectedSkill.enabled ? '' : 'success'"
            :loading="toggleLoading"
            :disabled="Boolean(toggleDisabledReason(selectedSkill))"
            @click="handleToggleForSkill(selectedSkill)"
          >
            {{ selectedSkill.enabled ? '禁用' : '启用' }}
          </el-button>
          <el-dropdown
            v-if="isAdmin"
            trigger="click"
            @command="command => handleSkillCommand(command, selectedSkill)"
          >
            <el-button aria-label="更多 Skill 操作">
              <el-icon><Icon :icon="iconMap.more" /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="export">
                  导出 Skill
                </el-dropdown-item>
                <el-dropdown-item
                  command="delete"
                  divided
                  class="danger-item"
                >
                  删除 Skill
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <el-tabs
        v-model="workspaceTab"
        class="workspace-tabs"
      >
        <el-tab-pane
          label="说明"
          name="overview"
        >
          <SkillWorkspaceOverview
            :skill="selectedSkill"
            :mode="catalogMode"
            :is-admin="isAdmin"
            @edit-config="isAdmin && (showManifestEditor = true)"
          />
        </el-tab-pane>

        <el-tab-pane
          :label="`文件 (${skillFiles.length})`"
          name="files"
        >
          <div class="workspace-file-area">
            <SkillFileTree
              class="content-tree"
              :style="{ width: uiState.treePanelWidth + 'px', flex: '0 0 auto' }"
              :scope="activeScope"
              :skill-name="selectedSkill.name"
              :files="skillFiles"
              :loading="filesLoading"
              :current-path="currentFilePath"
              :dirty-paths="dirtyFilePaths"
              :read-only="!isAdmin"
              @select="openFile"
              @refresh="reloadFiles"
              @open-after-write="onOpenAfterWrite"
            />
            <SplitterBar
              v-model="uiState.treePanelWidth"
              :min="190"
              :max="420"
            />
            <SkillFileEditor
              ref="fileEditorRef"
              class="content-editor"
              :scope="activeScope"
              :skill-name="selectedSkill.name"
              :file-path="currentFilePath"
              :file-content="currentFileContent"
              :encoding="currentFileEncoding"
              :file-size="currentFileSize"
              :loading="fileLoading"
              :read-only="!isAdmin"
              @saved="onFileSaved"
              @dirty-change="onDirtyChange"
            />
          </div>
        </el-tab-pane>
      </el-tabs>
    </section>

    <SkillEditorDialog
      v-model="showNewDialog"
      :default-scope="activeScope"
      @confirm="handleNewConfirm"
    />
    <ImportSkillDialog
      v-model="showImportDialog"
      :default-scope="activeScope"
      @imported="handleImported"
    />
    <SkillManifestEditorDialog
      v-model="showManifestEditor"
      :skill="selectedSkill"
      :taxonomy="taxonomy"
      @saved="handleManifestSaved"
    />

    <SkillIssueDrawer
      v-model="showIssueDrawer"
      :skill="selectedSkill"
      @open-file="openIssueFile"
      @revalidate="refreshWorkspaceHealth"
    />

    <SkillHealthDialog
      v-model="showHealthDialog"
      :data="healthData"
      :scope="activeScope"
      @locate="locateHealthRow"
    />

    <SkillBatchResultDialog
      v-model="showBatchResultDialog"
      :title="batchResultTitle"
      :data="batchResultData"
      :available-names="skills.map(skill => skill.name)"
      @locate="locateBatchResult"
    />
  </div>
</template>

<script setup>
import StatsStrip from '@/components/common/StatsStrip.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import { computed, nextTick, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { icons as iconMap } from '@/utils/icons.js'
import { executeRequest } from '@/utils/apiUtils.js'
import { confirmAction, executeDeleteWithConfirm } from '@/utils/confirmUtils.js'
import { showSuccess, showWarning } from '@/utils/messageUtils.js'
import {
  deleteSkillApi,
  exportSkillApi,
  saveSkillApi,
  toggleSkillApi
} from '@/services/api/skills.js'
import SkillEditorDialog from './SkillEditorDialog.vue'
import SkillFileTree from './SkillFileTree.vue'
import SkillFileEditor from './SkillFileEditor.vue'
import ImportSkillDialog from './ImportSkillDialog.vue'
import SkillAvailabilityTag from './SkillAvailabilityTag.vue'
import SkillManifestEditorDialog from './SkillManifestEditorDialog.vue'
import BatchActionBar from '@/components/common/BatchActionBar.vue'
import SplitterBar from '@/components/common/SplitterBar.vue'
import { useSkillUiState } from './useSkillUiState.js'
import SkillIssueDrawer from './SkillIssueDrawer.vue'
import SkillHealthDialog from './SkillHealthDialog.vue'
import SkillBatchResultDialog from './SkillBatchResultDialog.vue'
import { useSkillWorkspace } from './useSkillWorkspace.js'
import { useSkillCatalog } from './useSkillCatalog.js'
import { executeBlobDownload } from '@/utils/exportUtils.js'
import { useAuth } from '@/composables/useAuth.js'
import SkillCatalogTable from './SkillCatalogTable.vue'
import SkillCatalogFilters from './SkillCatalogFilters.vue'
import SkillWorkspaceOverview from './SkillWorkspaceOverview.vue'
import { useSkillFilters } from './useSkillFilters.js'
import { useSkillBatchActions } from './useSkillBatchActions.js'
import { buildSkillManifest, buildSkillMarkdown } from './skillManifestSerializer.js'
import {
  skillToggleDisabledReason as toggleDisabledReason,
  issueTargetFile,
  summarizeSelectedRisk
} from './skillUiModel.js'

const { isAdmin } = useAuth()
const { state: uiState } = useSkillUiState()
const catalogModeOptions = [
  { label: '简洁', value: 'simple' },
  { label: '治理', value: 'governance' }
]
const catalogMode = computed({
  get: () => (isAdmin.value && uiState.value.catalogMode === 'governance' ? 'governance' : 'simple'),
  set: (value) => {
    uiState.value = { ...uiState.value, catalogMode: value }
  }
})

const scopes = [
  { value: 'agent-node', label: 'agent-node' },
  { value: 'platform', label: 'platform' }
]
const activeScope = ref(uiState.value.activeScope || 'agent-node')
const viewMode = ref('catalog')
const workspaceTab = ref('overview')

const toggleLoading = ref(false)

const showNewDialog = ref(false)
const showImportDialog = ref(false)
const showManifestEditor = ref(false)
const showIssueDrawer = ref(false)
const showHealthDialog = ref(false)
const healthData = ref({ total: 0, valid: 0, invalid: 0, skills: [] })

const {
  selectedSkill, selectedSkillName, skillFiles, filesLoading, currentFilePath, currentFileContent,
  currentFileEncoding, currentFileSize, fileLoading, dirtyFilePaths, fileEditorRef,
  confirmLeaveEdit, clearWorkspace, openSkill, loadSkillFiles, reloadFiles, openFile,
  onOpenAfterWrite, onFileSaved, onDirtyChange
} = useSkillWorkspace({ activeScope, uiState, onMetadataChanged: () => loadSkills() })

const {
  scopeCatalog, catalogLoading, searchKeyword, searchResults, searchError, searchLoading, taxonomy,
  loadTaxonomy, loadScopeSkills, loadSkills, loadCatalog, loadHealth
} = useSkillCatalog({
  activeScope,
  scopes: scopes.map(scope => scope.value),
  onScopeLoaded: (scope, list) => {
    if (scope !== activeScope.value || !selectedSkillName.value) return
    const latest = list.find(skill => skill.name === selectedSkillName.value)
    if (latest) selectedSkill.value = latest
  },
  onSearchChanged: () => clearBatchSelection()
})

watch(activeScope, (value) => {
  uiState.value = { ...uiState.value, activeScope: value }
  viewMode.value = 'catalog'
  showHealthDialog.value = false
  showIssueDrawer.value = false
  showBatchResultDialog.value = false
})

const skills = computed(() => scopeCatalog.value[activeScope.value] || [])
const {
  filters, filteredSkills, catalogSummary, catalogFilterFields, activeFilterEntries,
  setFilter, removeFilter, clearFilters, applyQuickFilter
} = useSkillFilters({
  skills, taxonomy, catalogMode, activeScope, searchKeyword, searchResults,
  onChange: () => clearBatchSelection()
})

const {
  selectedNames, allFilteredSelected, someFilteredSelected, hasBatchEnableTarget, hasBatchDisableTarget,
  setSelection, clearBatchSelection, toggleSelectAll, batchToggleLoading, batchExportLoading, batchDeleteLoading,
  showBatchResultDialog, batchResultTitle, batchResultData, handleBatchToggle, handleBatchExport, handleBatchDelete
} = useSkillBatchActions({
  activeScope, items: filteredSkills, isAdmin, dirtyFilePaths,
  confirmEnable: targets => confirmRiskyEnable(targets),
  refreshScope: loadScopeSkills
})

const selectedIssues = computed(() => selectedSkill.value?.issues || [])
const selectedErrorCount = computed(
  () =>
    selectedIssues.value.filter((issue) => String(issue.severity).toUpperCase() === 'ERROR').length
)

const scopeCount = (scope) => scopeCatalog.value[scope]?.length || 0
const findSkill = (name, scope = activeScope.value) =>
  (scopeCatalog.value[scope] || []).find((skill) => skill.name === name)

const handleCatalogCommand = async (command) => {
  if (command === 'import') showImportDialog.value = true
  else if (command === 'health') await openHealthDialog()
  else if (command === 'refresh') await loadCatalog()
}

const openWorkspace = async (skill, tab = 'overview') => {
  if (!skill?.name) return
  if (selectedSkillName.value && selectedSkillName.value !== skill.name) {
    if (!(await confirmLeaveEdit())) return
  }
  viewMode.value = 'workspace'
  const requestedTab = typeof tab === 'string' ? tab : 'overview'
  workspaceTab.value = requestedTab === 'validation' ? 'overview' : requestedTab
  const opened = await openSkill(skill)
  if (opened && requestedTab === 'validation') showIssueDrawer.value = true
}

const backToCatalog = async () => {
  if (!(await confirmLeaveEdit())) return
  viewMode.value = 'catalog'
  showIssueDrawer.value = false
  clearWorkspace()
}

const openIssueFile = async (issue) => {
  showIssueDrawer.value = false
  workspaceTab.value = 'files'
  await nextTick()
  await openFile(issueTargetFile(issue), true)
}

const refreshWorkspaceHealth = async () => {
  await loadSkills()
  showSuccess('已重新校验')
}

const handleNewConfirm = async (data) => {
  const content = buildSkillMarkdown(data.name, data.description)
  const manifest = buildSkillManifest({
    ...data,
    id: `leo.custom.${data.scope}.${data.name}`,
    version: '0.1.0',
    status: 'draft',
    source: 'custom',
    owner: 'leo',
    enabled: false,
    tactics: [],
    techniques: [],
    requiredTools: [],
    requiredSkills: [],
    requiredFacts: [],
    produces: [],
    next: []
  })
  await executeRequest(
    () =>
      saveSkillApi({
        scope: data.scope,
        name: data.name,
        content,
        manifest
      }),
    {
      successMessage: 'Skill 已创建为草稿',
      errorMessage: '创建失败',
      onSuccess: async () => {
        activeScope.value = data.scope
        await loadScopeSkills(data.scope)
        const created = findSkill(data.name, data.scope)
        if (created) await openWorkspace(created)
      }
    }
  )
}

const handleImported = async ({ scope }) => {
  if (scope) activeScope.value = scope
  await loadCatalog()
  viewMode.value = 'catalog'
}

const handleManifestSaved = async () => {
  await loadSkills()
  await loadSkillFiles()
  if (currentFilePath.value === 'manifest.yaml') await openFile('manifest.yaml', true)
}

const confirmRiskyEnable = async (targets) => {
  const summary = summarizeSelectedRisk(targets)
  if (!summary.highRisk && !summary.approvalRequired && !summary.activeLogin && !summary.writeCapable) {
    return true
  }
  const lines = [
    `高风险 ${summary.highRisk} 个`,
    `需要显式授权 ${summary.approvalRequired} 个`,
    `主动登录 ${summary.activeLogin} 个`,
    `具备写入或破坏能力 ${summary.writeCapable} 个`
  ]
  return confirmAction({
    title: '确认启用受控能力',
    message: `本次启用包含受控能力：${lines.join('，')}。启用只代表进入运行目录，每次执行仍必须绑定精确目标、ROE 和必要确认。`,
    confirmButtonText: '确认启用'
  })
}

const handleToggleForSkill = async (skill) => {
  if (!skill) return
  if (dirtyFilePaths.value.includes('manifest.yaml') && skill.name === selectedSkillName.value) {
    showWarning('manifest.yaml 有未保存修改，请先保存或放弃修改')
    return
  }
  const enabled = !skill.enabled
  if (enabled && !(await confirmRiskyEnable([skill]))) return
  await executeRequest(
    () => toggleSkillApi({ scope: activeScope.value, name: skill.name, enabled }),
    {
      loadingRef: toggleLoading,
      successMessage: enabled ? 'Skill 已启用' : 'Skill 已禁用',
      errorMessage: '操作失败',
      onSuccess: loadSkills
    }
  ).catch(() => false)
}

const handleSkillCommand = async (command, skill) => {
  if (!skill) return
  if (command === 'export') await downloadSkill(activeScope.value, skill.name)
  else if (command === 'delete') await handleDelete(skill)
}

const handleDelete = async (skill) => {
  if (!skill) return
  await executeDeleteWithConfirm(
    () => deleteSkillApi({ scope: activeScope.value, name: skill.name }),
    {
      successMessage: '删除成功',
      errorMessage: '删除失败',
      onSuccess: async () => {
        if (selectedSkillName.value === skill.name) {
          viewMode.value = 'catalog'
          clearWorkspace()
        }
        await loadSkills()
      }
    }
  )
}

const downloadSkill = (scope, name) =>
  executeBlobDownload(() => exportSkillApi(scope, name), `${name}.skill`).catch(() => false)

const locateBatchResult = async (name) => {
  const skill = findSkill(name)
  if (!skill) return
  showBatchResultDialog.value = false
  await openWorkspace(skill, 'validation')
}

const openHealthDialog = async () => {
  const response = await loadHealth()
  if (response) {
    healthData.value = response.data || healthData.value
    showHealthDialog.value = true
  }
}

const locateHealthRow = async (row) => {
  const skill = findSkill(row.name)
  if (!skill) return
  showHealthDialog.value = false
  await openWorkspace(skill, 'validation')
}

loadTaxonomy()
loadCatalog()
</script>

<style scoped>
.skill-manager-root {
  width: 100%;
  height: 100%;
  min-height: 0;
  color: var(--el-text-color-primary);
}

.catalog-shell,
.workspace-shell {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.workspace-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  flex-shrink: 0;
}

.workspace-title-wrap {
  display: flex;
  align-items: flex-start;
  min-width: 0;
  gap: 12px;
}

.workspace-skill-icon {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 10px;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 10%, var(--app-card-background));
  font-size: 21px;
}

.workspace-title h1 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 19px;
  line-height: 1.35;
}

.workspace-title p {
  margin: 5px 0 0;
  max-width: 760px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.workspace-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.catalog-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--app-surface-border-strong);
  border-radius: var(--app-panel-radius);
  background: var(--app-card-background);
}

.catalog-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px var(--space-4);
  border-bottom: 1px solid var(--app-surface-border-subtle);
  flex-shrink: 0;
}

.scope-tabs {
  display: inline-flex;
  align-items: center;
  padding: 3px;
  border-radius: var(--app-control-radius);
  background: var(--app-control-background-soft);
}

.scope-tab {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 30px;
  padding: 0 12px;
  border: 0;
  border-radius: calc(var(--app-control-radius) - 2px);
  color: var(--el-text-color-secondary);
  background: transparent;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.scope-tab span {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--el-fill-color);
  font-size: 10px;
  line-height: 18px;
  text-align: center;
}

.scope-tab.is-active {
  color: var(--el-color-primary);
  background: var(--app-card-background);
  box-shadow: 0 1px 3px color-mix(in srgb, #000 10%, transparent);
}

.scope-tab.is-active span {
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 10%, transparent);
}

.catalog-search {
  flex: 1;
  max-width: 520px;
  margin-left: auto;
}

.active-filter-row,
.catalog-result-row {
  min-height: 34px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 14px;
  border-bottom: 1px solid var(--app-surface-border-subtle);
  color: var(--el-text-color-secondary);
  font-size: 11px;
  flex-shrink: 0;
}

.catalog-result-row {
  justify-content: space-between;
}

.active-filter-label {
  margin-right: 2px;
  font-weight: 600;
}

.catalog-result-count {
  margin-left: auto;
}

.search-error {
  color: var(--el-color-danger);
}

.catalog-panel :deep(.batch-bar) {
  margin: 8px 14px 0;
}

.danger-item {
  color: var(--el-color-danger) !important;
}

.workspace-shell {
  gap: 0;
  overflow: hidden;
  border: 1px solid var(--app-surface-border-strong);
  border-radius: var(--app-panel-radius);
  background: var(--app-card-background);
}

.workspace-header {
  padding: 14px 16px;
  border-bottom: 1px solid var(--app-surface-border-subtle);
  background: var(--app-container-background);
}

.back-button {
  margin-top: 4px;
  font-size: 19px;
}

.workspace-title {
  min-width: 0;
}

.workspace-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.workspace-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px 15px;
  margin-top: 6px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.workspace-meta span + span {
  position: relative;
}

.workspace-meta span + span::before {
  content: '';
  position: absolute;
  left: -9px;
  top: 50%;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--el-text-color-placeholder);
}

.meta-warning {
  color: var(--el-color-warning);
  font-weight: 700;
}

.workspace-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.workspace-tabs :deep(.el-tabs__header) {
  margin: 0;
  padding: 0 18px;
  flex-shrink: 0;
}

.workspace-tabs :deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
}

.workspace-tabs :deep(.el-tab-pane) {
  height: 100%;
  min-height: 0;
}

.workspace-file-area {
  height: 100%;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

.content-tree,
.content-editor {
  min-height: 0;
  min-width: 0;
}

.content-editor {
  flex: 1;
}

@media (max-width: 1180px) {

  .workspace-actions .el-button span:not(.el-icon) {
    display: none;
  }
}

@media (max-width: 900px) {
  .workspace-header {
    flex-direction: column;
  }

  .workspace-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .catalog-toolbar {
    flex-wrap: wrap;
  }

  .catalog-search {
    order: 3;
    width: 100%;
    max-width: none;
  }

}
</style>
