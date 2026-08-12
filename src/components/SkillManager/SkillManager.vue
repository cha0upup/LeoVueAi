<template>
  <div class="skill-manager-root">
    <!-- 能力目录：面向批量治理和快速检索的全宽视图 -->
    <section
      v-if="viewMode === 'catalog'"
      class="catalog-shell"
    >
      <header class="catalog-header">
        <div class="catalog-heading">
          <div class="catalog-heading-icon">
            <Icon :icon="iconMap.bookOpenPageVariant" />
          </div>
          <div>
            <span class="catalog-kicker">CAPABILITY LIBRARY</span>
            <h1>能力库</h1>
            <p>管理 Skill 的生命周期、运行可用性、风险边界和依赖关系。</p>
          </div>
        </div>
        <div class="catalog-header-actions">
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
            @click="openNewDialog"
          >
            <el-icon><Icon :icon="iconMap.add" /></el-icon>
            新增 Skill
          </el-button>
          <el-dropdown
            trigger="click"
            @command="handleCatalogCommand"
          >
            <el-badge
              :value="catalogAlertCount"
              :hidden="catalogAlertCount === 0"
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
                  健康检查<span v-if="catalogAlertCount">（{{ catalogAlertCount }}）</span>
                </el-dropdown-item>
                <el-dropdown-item command="refresh">
                  刷新目录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <div class="catalog-stats">
        <button
          type="button"
          class="stat-card"
          :class="{ active: !filters.availability && !filters.health }"
          @click="applyQuickFilter('all')"
        >
          <span>全部</span>
          <strong>{{ catalogSummary.total }}</strong>
          <em>当前 Scope</em>
        </button>
        <button
          type="button"
          class="stat-card stat-card--success"
          :class="{ active: filters.availability === 'runtime' }"
          @click="applyQuickFilter('runtime')"
        >
          <span>可运行</span>
          <strong>{{ catalogSummary.runtime }}</strong>
          <em>已进入目录</em>
        </button>
        <button
          type="button"
          class="stat-card stat-card--warning"
          :class="{ active: filters.availability === 'controlled' }"
          @click="applyQuickFilter('controlled')"
        >
          <span>受控启用</span>
          <strong>{{ catalogSummary.controlled }}</strong>
          <em>需授权确认</em>
        </button>
        <button
          type="button"
          class="stat-card stat-card--danger"
          :class="{ active: filters.health === 'problems' }"
          @click="applyQuickFilter('problems')"
        >
          <span>存在问题</span>
          <strong>{{ catalogSummary.problems }}</strong>
          <em>警告或错误</em>
        </button>
      </div>

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
              @click="onScopeChange(scope.value)"
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

          <el-popover
            v-model:visible="showFilterPanel"
            placement="bottom-end"
            :width="catalogMode === 'governance' ? 760 : 520"
            trigger="click"
            popper-class="skill-filter-popper"
          >
            <template #reference>
              <el-button
                :type="hasFilters ? 'primary' : ''"
                plain
              >
                <el-icon><Icon icon="mdi:filter-variant" /></el-icon>
                筛选
                <span v-if="activeFilterEntries.length">({{ activeFilterEntries.length }})</span>
              </el-button>
            </template>
            <div>
              <div class="filter-popover-title">
                <div>
                  <strong>筛选能力</strong>
                  <span>筛选变化会清空当前批量选择，避免操作隐藏条目。</span>
                </div>
                <el-button
                  v-if="hasFilters"
                  text
                  @click="clearFilters"
                >
                  清除全部
                </el-button>
              </div>
              <div
                class="filter-grid"
                :class="{ 'filter-grid--simple': catalogMode === 'simple' }"
              >
                <label v-if="catalogMode === 'governance'">
                  <span>能力域</span>
                  <el-select
                    v-model="filters.domain"
                    clearable
                    placeholder="全部能力域"
                  >
                    <el-option
                      v-for="item in taxonomy.domains"
                      :key="item"
                      :label="item"
                      :value="item"
                    />
                  </el-select>
                </label>
                <label>
                  <span>主分类</span>
                  <el-select
                    v-model="filters.category"
                    clearable
                    filterable
                    placeholder="全部分类"
                  >
                    <el-option
                      v-for="item in availableCategories"
                      :key="item"
                      :label="item"
                      :value="item"
                    />
                  </el-select>
                </label>
                <label v-if="catalogMode === 'governance'">
                  <span>能力包</span>
                  <el-select
                    v-model="filters.pack"
                    clearable
                    filterable
                    placeholder="全部能力包"
                  >
                    <el-option
                      v-for="item in availablePacks"
                      :key="item"
                      :label="item"
                      :value="item"
                    />
                  </el-select>
                </label>
                <label>
                  <span>平台</span>
                  <el-select
                    v-model="filters.platform"
                    clearable
                    filterable
                    placeholder="全部平台"
                  >
                    <el-option
                      v-for="item in availablePlatforms"
                      :key="item"
                      :label="item"
                      :value="item"
                    />
                  </el-select>
                </label>
                <label>
                  <span>风险</span>
                  <el-select
                    v-model="filters.risk"
                    clearable
                    placeholder="全部风险"
                  >
                    <el-option
                      v-for="item in taxonomy.risks"
                      :key="item"
                      :label="item"
                      :value="item"
                    />
                  </el-select>
                </label>
                <label v-if="catalogMode === 'governance'">
                  <span>访问模式</span>
                  <el-select
                    v-model="filters.accessMode"
                    clearable
                    placeholder="全部访问模式"
                  >
                    <el-option
                      v-for="item in taxonomy.accessModes"
                      :key="item"
                      :label="item"
                      :value="item"
                    />
                  </el-select>
                </label>
                <label v-if="catalogMode === 'governance'">
                  <span>生命周期</span>
                  <el-select
                    v-model="filters.status"
                    clearable
                    placeholder="全部状态"
                  >
                    <el-option
                      v-for="item in taxonomy.statuses"
                      :key="item"
                      :label="item"
                      :value="item"
                    />
                  </el-select>
                </label>
                <label>
                  <span>运行可用性</span>
                  <el-select
                    v-model="filters.availability"
                    clearable
                    placeholder="全部可用性"
                  >
                    <el-option
                      label="可进入运行目录"
                      value="runtime"
                    />
                    <el-option
                      label="受控启用"
                      value="controlled"
                    />
                    <el-option
                      label="已禁用"
                      value="disabled"
                    />
                    <el-option
                      label="草稿"
                      value="draft"
                    />
                    <el-option
                      label="待发布"
                      value="reviewed"
                    />
                    <el-option
                      label="已弃用"
                      value="deprecated"
                    />
                    <el-option
                      label="不可运行"
                      value="invalid"
                    />
                  </el-select>
                </label>
                <label v-if="catalogMode === 'governance'">
                  <span>授权要求</span>
                  <el-select
                    v-model="filters.approval"
                    clearable
                    placeholder="全部"
                  >
                    <el-option
                      label="需要显式授权"
                      value="required"
                    />
                    <el-option
                      label="不要求显式授权"
                      value="not-required"
                    />
                  </el-select>
                </label>
                <label v-if="catalogMode === 'governance'">
                  <span>健康状态</span>
                  <el-select
                    v-model="filters.health"
                    clearable
                    placeholder="全部"
                  >
                    <el-option
                      label="存在问题"
                      value="problems"
                    />
                    <el-option
                      label="健康"
                      value="healthy"
                    />
                    <el-option
                      label="存在警告"
                      value="warning"
                    />
                    <el-option
                      label="存在错误"
                      value="invalid"
                    />
                  </el-select>
                </label>
              </div>
            </div>
          </el-popover>
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

        <div class="catalog-table-wrap">
          <el-table
            ref="tableRef"
            v-loading="catalogLoading"
            :data="filteredSkills"
            row-key="name"
            height="100%"
            class="catalog-table"
            @selection-change="onTableSelectionChange"
            @row-dblclick="openWorkspace"
          >
            <el-table-column
              type="selection"
              width="46"
              :reserve-selection="false"
            />
            <el-table-column
              prop="name"
              label="Skill"
              min-width="230"
              sortable
              show-overflow-tooltip
            >
              <template #default="{ row }">
                <div class="skill-name-cell">
                  <div class="skill-name-icon">
                    <Icon :icon="iconMap.bookOpenPageVariant" />
                  </div>
                  <div>
                    <strong>{{ row.name }}</strong>
                    <span>{{ row.description || '暂无描述' }}</span>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column
              v-if="catalogMode === 'simple'"
              label="分类 / 平台"
              min-width="170"
            >
              <template #default="{ row }">
                <div class="stacked-cell">
                  <strong>{{ row.category || '未分类' }}</strong>
                  <span>{{ (row.platforms || []).slice(0, 3).join(' · ') || '—' }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column
              v-if="catalogMode === 'governance'"
              label="分类 / 能力包"
              min-width="155"
              sortable
              :sort-by="(row) => row.category || ''"
            >
              <template #default="{ row }">
                <div class="stacked-cell">
                  <strong>{{ row.category || '未分类' }}</strong>
                  <span>{{ row.pack || row.domain || '—' }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column
              v-if="catalogMode === 'governance'"
              label="平台"
              min-width="105"
            >
              <template #default="{ row }">
                <div class="mini-tags">
                  <el-tag
                    v-for="platform in (row.platforms || []).slice(0, 2)"
                    :key="platform"
                    size="small"
                    effect="plain"
                    type="info"
                  >
                    {{ platform }}
                  </el-tag>
                  <span v-if="(row.platforms || []).length > 2">+{{ row.platforms.length - 2 }}</span>
                  <span v-if="!(row.platforms || []).length">—</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column
              :label="catalogMode === 'governance' ? '风险 / 访问' : '风险'"
              min-width="125"
              sortable
              :sort-by="(row) => row.risk || ''"
            >
              <template #default="{ row }">
                <div class="stacked-cell">
                  <el-tag
                    size="small"
                    effect="plain"
                    :type="riskTagType(row.risk)"
                  >
                    {{ row.risk || 'unknown' }}
                  </el-tag>
                  <span v-if="catalogMode === 'governance'">{{ row.accessMode || '—' }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column
              v-if="catalogMode === 'governance'"
              label="生命周期"
              min-width="100"
              sortable
              prop="status"
            >
              <template #default="{ row }">
                <div class="stacked-cell">
                  <strong>{{ row.status || 'unknown' }}</strong>
                  <span>{{ row.version || '—' }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column
              label="运行状态"
              min-width="112"
              fixed="right"
            >
              <template #default="{ row }">
                <SkillAvailabilityTag :skill="row" />
              </template>
            </el-table-column>
            <el-table-column
              label="操作"
              width="150"
              fixed="right"
              align="right"
            >
              <template #default="{ row }">
                <el-button
                  size="small"
                  text
                  type="primary"
                  @click.stop="openWorkspace(row)"
                >
                  打开
                </el-button>
                <el-tooltip
                  v-if="isAdmin"
                  :content="toggleDisabledReason(row) || (row.enabled ? '禁用' : '启用')"
                >
                  <span>
                    <el-button
                      size="small"
                      text
                      :type="row.enabled ? '' : 'success'"
                      :disabled="Boolean(toggleDisabledReason(row))"
                      @click.stop="handleToggleForSkill(row)"
                    >
                      {{ row.enabled ? '禁用' : '启用' }}
                    </el-button>
                  </span>
                </el-tooltip>
                <el-dropdown
                  trigger="click"
                  @command="(command) => handleRowCommand(command, row)"
                  @click.stop
                >
                  <el-button
                    size="small"
                    text
                    aria-label="更多 Skill 操作"
                  >
                    <el-icon><Icon :icon="iconMap.more" /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="export">
                        导出
                      </el-dropdown-item>
                      <el-dropdown-item
                        v-if="isAdmin"
                        command="delete"
                        divided
                        class="danger-item"
                      >
                        删除
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </template>
            </el-table-column>
          </el-table>
        </div>
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
            @command="handleDetailCommand"
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
          <div class="overview-scroll">
            <section class="overview-card">
              <div class="section-heading">
                <div>
                  <span>SKILL GUIDE</span>
                  <h2>使用说明</h2>
                </div>
                <el-button
                  v-if="isAdmin"
                  text
                  type="primary"
                  @click="showManifestEditor = true"
                >
                  编辑配置
                </el-button>
              </div>
              <p class="skill-brief-description">
                {{ selectedSkill.description || '暂无说明，请编辑 SKILL.md 补充适用场景和执行边界。' }}
              </p>
              <div class="skill-brief-meta">
                <span><small>分类</small>{{ selectedSkill.category || '未分类' }}</span>
                <span><small>平台</small>{{ (selectedSkill.platforms || []).join('、') || '未声明' }}</span>
                <span><small>风险</small>{{ selectedSkill.risk || 'unknown' }}</span>
                <span><small>访问</small>{{ selectedSkill.accessMode || '未声明' }}</span>
              </div>
            </section>

            <section
              v-if="catalogMode === 'governance'"
              class="overview-card"
            >
              <div class="section-heading">
                <div>
                  <span>GOVERNANCE</span>
                  <h2>治理信息</h2>
                </div>
              </div>
              <el-descriptions
                :column="3"
                border
              >
                <el-descriptions-item label="稳定 ID">
                  {{ selectedSkill.id }}
                </el-descriptions-item>
                <el-descriptions-item label="负责人">
                  {{ selectedSkill.owner }}
                </el-descriptions-item>
                <el-descriptions-item label="来源">
                  {{ selectedSkill.source }}
                </el-descriptions-item>
                <el-descriptions-item label="能力域">
                  {{ selectedSkill.domain }}
                </el-descriptions-item>
                <el-descriptions-item label="主分类">
                  {{ selectedSkill.category }}
                </el-descriptions-item>
                <el-descriptions-item label="能力包">
                  {{ selectedSkill.pack || '—' }}
                </el-descriptions-item>
                <el-descriptions-item label="执行模式">
                  {{ selectedSkill.mode }}
                </el-descriptions-item>
                <el-descriptions-item label="风险">
                  {{ selectedSkill.risk }}
                </el-descriptions-item>
                <el-descriptions-item label="访问模式">
                  {{ selectedSkill.accessMode }}
                </el-descriptions-item>
              </el-descriptions>
            </section>

            <div
              v-if="catalogMode === 'governance'"
              class="overview-grid"
            >
              <OverviewListCard
                title="平台与目标"
                kicker="TARGETING"
                :groups="[
                  { label: 'Platforms', values: selectedSkill.platforms },
                  { label: 'Targets', values: selectedSkill.targets }
                ]"
              />
              <OverviewListCard
                title="ATT&CK 映射"
                kicker="ATT&CK"
                :groups="[
                  { label: 'Tactics', values: selectedSkill.tactics },
                  { label: 'Techniques', values: selectedSkill.techniques }
                ]"
              />
              <OverviewListCard
                title="运行依赖"
                kicker="REQUIRES"
                :groups="[
                  { label: 'Tools', values: selectedSkill.requiredTools },
                  { label: 'Skills', values: selectedSkill.requiredSkills },
                  { label: 'Facts', values: selectedSkill.requiredFacts }
                ]"
              />
              <OverviewListCard
                title="产出与后续"
                kicker="OUTPUTS"
                :groups="[
                  { label: 'Produces', values: selectedSkill.produces },
                  { label: 'Next', values: selectedSkill.next }
                ]"
              />
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane
          :label="`文件 (${skillFiles.length})`"
          name="files"
        >
          <div class="workspace-file-area">
            <SkillFileTree
              class="content-tree"
              :style="{ width: treePanelWidth + 'px', flex: '0 0 auto' }"
              :scope="activeScope"
              :skill-name="selectedSkill.name"
              :files="skillFiles"
              :loading="filesLoading"
              :current-path="currentFilePath"
              :dirty-paths="dirtyFilePaths"
              :read-only="!isAdmin"
              @select="onFileSelect"
              @refresh="reloadFiles"
              @open-after-write="onOpenAfterWrite"
            />
            <SplitterBar
              v-model="treePanelWidth"
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

    <el-drawer
      v-model="showIssueDrawer"
      title="校验与问题定位"
      size="520px"
      append-to-body
    >
      <div
        v-if="selectedSkill"
        class="validation-scroll validation-drawer"
      >
        <div class="validation-summary">
          <div :class="selectedSkill.valid ? 'validation-icon--success' : 'validation-icon--danger'">
            <Icon :icon="selectedSkill.valid ? 'mdi:check-decagram-outline' : 'mdi:alert-decagram-outline'" />
          </div>
          <div>
            <h2>{{ selectedSkill.valid ? '基础校验通过' : '存在阻塞错误' }}</h2>
            <p>
              错误 {{ selectedErrorCount }} · 警告 {{ selectedWarnings.length }}。
              {{ getSkillAvailability(selectedSkill).description }}
            </p>
          </div>
          <el-button
            size="small"
            @click="refreshWorkspaceHealth"
          >
            重新校验
          </el-button>
        </div>

        <div
          v-if="selectedIssues.length"
          class="validation-list"
        >
          <button
            v-for="(issue, index) in selectedIssues"
            :key="`${issue.field}-${index}`"
            type="button"
            class="validation-item"
            @click="openIssueFile(issue)"
          >
            <span
              class="issue-level"
              :class="`issue-level--${String(issue.severity).toLowerCase()}`"
            >
              {{ issue.severity }}
            </span>
            <span class="issue-content">
              <strong>{{ issue.field }}</strong>
              <span>{{ issue.message }}</span>
            </span>
            <span class="issue-target">
              打开 {{ issueTargetFile(issue) }}
              <Icon icon="mdi:arrow-right" />
            </span>
          </button>
        </div>
        <div
          v-else
          class="validation-empty"
        >
          <Icon icon="mdi:check-circle-outline" />
          <strong>没有发现校验问题</strong>
          <span>manifest、依赖关系和生命周期状态均通过当前校验。</span>
        </div>
      </div>
    </el-drawer>

    <el-dialog
      v-model="showHealthDialog"
      title="Skill Catalog 健康检查"
      width="940px"
    >
      <div class="health-summary">
        <div>
          <span>健康</span>
          <strong>{{ healthCounts.healthy }}</strong>
        </div>
        <div class="health-warning">
          <span>警告</span>
          <strong>{{ healthCounts.warning }}</strong>
        </div>
        <div class="health-danger">
          <span>错误</span>
          <strong>{{ healthCounts.invalid }}</strong>
        </div>
        <p>共检查 {{ healthCounts.total }} 个 {{ activeScope }} Skill</p>
      </div>
      <el-table
        :data="healthData.skills || []"
        size="small"
        max-height="540"
      >
        <el-table-column
          prop="name"
          label="Skill"
          min-width="190"
        />
        <el-table-column
          label="健康状态"
          width="120"
        >
          <template #default="{ row }">
            <el-tag
              :type="healthRowState(row).type"
              size="small"
              effect="plain"
            >
              {{ healthRowState(row).label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          label="问题"
          min-width="440"
        >
          <template #default="{ row }">
            <div
              v-if="row.issues?.length"
              class="health-issues"
            >
              <div
                v-for="(issue, index) in row.issues"
                :key="index"
                :class="`issue-${String(issue.severity).toLowerCase()}`"
              >
                {{ issue.field }}：{{ issue.message }}
              </div>
            </div>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column
          label="操作"
          width="100"
          align="right"
        >
          <template #default="{ row }">
            <el-button
              size="small"
              text
              type="primary"
              @click="locateHealthRow(row)"
            >
              定位
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <el-dialog
      v-model="showBatchResultDialog"
      :title="batchResultTitle"
      width="760px"
    >
      <div class="batch-result-summary">
        <el-tag type="success">
          已变更 {{ batchResultData.changed || 0 }}
        </el-tag>
        <el-tag type="info">
          未变更 {{ batchResultData.unchanged || 0 }}
        </el-tag>
        <el-tag
          v-if="batchResultData.failed"
          type="danger"
        >
          失败 {{ batchResultData.failed }}
        </el-tag>
      </div>
      <el-table
        :data="batchResultData.results || []"
        size="small"
        max-height="440"
      >
        <el-table-column
          prop="name"
          label="Skill"
          min-width="180"
        />
        <el-table-column
          label="结果"
          width="100"
        >
          <template #default="{ row }">
            <el-tag
              size="small"
              :type="batchResultType(row.status)"
              effect="plain"
            >
              {{ batchResultLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="message"
          label="说明"
          min-width="340"
        />
        <el-table-column
          label="操作"
          width="90"
          align="right"
        >
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'failed' && findSkill(row.name)"
              size="small"
              text
              type="primary"
              @click="locateBatchResult(row.name)"
            >
              定位
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, defineComponent, h, nextTick, ref, watch } from 'vue'
import { ElMessageBox, ElTag } from 'element-plus'
import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'
import { executeRequest } from '@/utils/apiUtils.js'
import { executeDeleteWithConfirm } from '@/utils/confirmUtils.js'
import { showError, showSuccess, showWarning } from '@/utils/messageUtils.js'
import {
  deleteSkillApi,
  deleteSkillsBatchApi,
  exportSkillApi,
  exportSkillsBatchApi,
  getSkillFileApi,
  getSkillHealthApi,
  getSkillTaxonomyApi,
  listSkillFilesApi,
  listSkillsApi,
  saveSkillApi,
  searchSkillsApi,
  toggleSkillApi,
  toggleSkillsBatchApi
} from '@/services/api.js'
import SkillEditorDialog from './SkillEditorDialog.vue'
import SkillFileTree from './SkillFileTree.vue'
import SkillFileEditor from './SkillFileEditor.vue'
import ImportSkillDialog from './ImportSkillDialog.vue'
import SkillAvailabilityTag from './SkillAvailabilityTag.vue'
import SkillManifestEditorDialog from './SkillManifestEditorDialog.vue'
import BatchActionBar from '@/components/common/BatchActionBar.vue'
import SplitterBar from '@/components/common/SplitterBar.vue'
import { useSkillUiState } from './useSkillUiState.js'
import { downloadBlob } from '@/utils/downloadBlob.js'
import { useAuth } from '@/composables/useAuth.js'
import { buildSkillManifest, buildSkillMarkdown } from './skillManifestSerializer.js'
import {
  filterSkills,
  getSkillAvailability,
  issueTargetFile,
  keepVisibleSelection,
  summarizeSelectedRisk,
  summarizeSkillCatalog
} from './skillUiModel.js'

const OverviewListCard = defineComponent({
  name: 'OverviewListCard',
  props: {
    title: { type: String, required: true },
    kicker: { type: String, default: '' },
    groups: { type: Array, default: () => [] }
  },
  setup(props) {
    return () =>
      h('section', { class: 'overview-card overview-list-card' }, [
        h('div', { class: 'section-heading' }, [
          h('div', [h('span', props.kicker), h('h2', props.title)])
        ]),
        ...props.groups.map((group) =>
          h('div', { class: 'overview-list-group', key: group.label }, [
            h('strong', group.label),
            h(
              'div',
              { class: 'overview-tag-list' },
              group.values?.length
                ? group.values.map((value) =>
                    h(ElTag, { key: value, size: 'small', effect: 'plain', type: 'info' }, () => value)
                  )
                : [h('span', { class: 'empty-value' }, '未声明')]
            )
          ])
        )
      ])
  }
})

const iconMap = icons
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
  { value: 'puppet-node', label: 'puppet-node' },
  { value: 'platform', label: 'platform' }
]
const activeScope = ref(uiState.value.activeScope || 'puppet-node')
const viewMode = ref('catalog')
const workspaceTab = ref('overview')
const scopeCatalog = ref({ 'puppet-node': [], platform: [] })
const selectedSkill = ref(null)
const selectedSkillName = ref('')
const searchKeyword = ref('')
const searchResults = ref(null)
const searchError = ref('')

const catalogLoading = ref(false)
const toggleLoading = ref(false)
const searchLoading = ref(false)
const batchToggleLoading = ref(false)
const batchExportLoading = ref(false)
const batchDeleteLoading = ref(false)

const showNewDialog = ref(false)
const showImportDialog = ref(false)
const showManifestEditor = ref(false)
const showIssueDrawer = ref(false)
const showHealthDialog = ref(false)
const showFilterPanel = ref(false)
const showBatchResultDialog = ref(false)
const batchResultTitle = ref('批量操作结果')
const batchResultData = ref({ changed: 0, unchanged: 0, failed: 0, results: [] })
const healthData = ref({ total: 0, valid: 0, invalid: 0, skills: [] })

const taxonomy = ref({
  domains: [],
  categories: [],
  modes: [],
  risks: [],
  accessModes: [],
  statuses: []
})

const emptyFilters = () => ({
  domain: '',
  category: '',
  platform: '',
  risk: '',
  status: '',
  accessMode: '',
  pack: '',
  approval: '',
  health: '',
  availability: ''
})
const filters = ref(emptyFilters())

const tableRef = ref(null)
const selectedNames = ref(new Set())

const skillFiles = ref([])
const filesLoading = ref(false)
const currentFilePath = ref('')
const currentFileContent = ref('')
const currentFileEncoding = ref('text')
const currentFileSize = ref(0)
const fileLoading = ref(false)
const dirtyFilePaths = ref([])
const fileEditorRef = ref(null)

const treePanelWidth = computed({
  get: () => uiState.value.treePanelWidth,
  set: (value) => {
    uiState.value = { ...uiState.value, treePanelWidth: value }
  }
})

watch(activeScope, (value) => {
  uiState.value = { ...uiState.value, activeScope: value }
})

const skills = computed(() => scopeCatalog.value[activeScope.value] || [])
const searchSource = computed(() => {
  if (!searchKeyword.value.trim()) return skills.value
  return Array.isArray(searchResults.value) ? searchResults.value : []
})
const filteredSkills = computed(() => filterSkills(searchSource.value, filters.value))
const catalogSummary = computed(() => summarizeSkillCatalog(skills.value))
const catalogAlertCount = computed(() => catalogSummary.value.problems)

const availableCategories = computed(() =>
  [...new Set(skills.value.map((item) => item.category).filter(Boolean))].sort()
)
const availablePlatforms = computed(() =>
  [...new Set(skills.value.flatMap((item) => item.platforms || []))].sort()
)
const availablePacks = computed(() =>
  [...new Set(skills.value.map((item) => item.pack).filter(Boolean))].sort()
)
const hasFilters = computed(() => Object.values(filters.value).some(Boolean))

const filterLabels = {
  domain: '能力域',
  category: '分类',
  platform: '平台',
  risk: '风险',
  status: '生命周期',
  accessMode: '访问模式',
  pack: '能力包',
  approval: '授权',
  health: '健康',
  availability: '可用性'
}
const filterValueLabels = {
  required: '需要显式授权',
  'not-required': '不要求显式授权',
  healthy: '健康',
  problems: '存在问题',
  warning: '存在警告',
  invalid: '存在错误',
  runtime: '可进入运行目录',
  controlled: '受控启用',
  disabled: '已禁用',
  draft: '草稿',
  reviewed: '待发布',
  deprecated: '已弃用'
}
const activeFilterEntries = computed(() =>
  Object.entries(filters.value)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => ({
      key,
      label: filterLabels[key] || key,
      value: filterValueLabels[value] || value
    }))
)

const selectedSkills = computed(() =>
  filteredSkills.value.filter((skill) => selectedNames.value.has(skill.name))
)
const allFilteredSelected = computed(
  () =>
    filteredSkills.value.length > 0 &&
    filteredSkills.value.every((skill) => selectedNames.value.has(skill.name))
)
const someFilteredSelected = computed(() => {
  const count = selectedSkills.value.length
  return count > 0 && count < filteredSkills.value.length
})
const hasBatchEnableTarget = computed(() => selectedSkills.value.some((skill) => !skill.enabled))
const hasBatchDisableTarget = computed(() => selectedSkills.value.some((skill) => skill.enabled))

const selectedIssues = computed(() => selectedSkill.value?.issues || [])
const selectedWarnings = computed(() =>
  selectedIssues.value.filter((issue) => String(issue.severity).toUpperCase() === 'WARNING')
)
const selectedErrorCount = computed(
  () =>
    selectedIssues.value.filter((issue) => String(issue.severity).toUpperCase() === 'ERROR').length
)

const healthCounts = computed(() => {
  const rows = healthData.value.skills || []
  let warning = 0
  let invalid = 0
  let healthy = 0
  for (const row of rows) {
    if (!row.valid) invalid += 1
    else if ((row.issues || []).some((issue) => String(issue.severity).toUpperCase() === 'WARNING')) {
      warning += 1
    } else healthy += 1
  }
  return { total: rows.length, warning, invalid, healthy }
})

const riskTagType = (risk) => {
  if (risk === 'critical' || risk === 'high') return 'danger'
  if (risk === 'medium') return 'warning'
  return 'success'
}

const scopeCount = (scope) => scopeCatalog.value[scope]?.length || 0
const findSkill = (name, scope = activeScope.value) =>
  (scopeCatalog.value[scope] || []).find((skill) => skill.name === name)

const removeFilter = (key) => {
  filters.value = { ...filters.value, [key]: '' }
}

const clearFilters = () => {
  filters.value = emptyFilters()
}

const applyQuickFilter = (kind) => {
  const next = emptyFilters()
  if (kind === 'runtime') next.availability = 'runtime'
  else if (kind === 'controlled') next.availability = 'controlled'
  else if (kind === 'problems') next.health = 'problems'
  else if (kind === 'warning') next.health = 'warning'
  else if (kind === 'invalid') next.health = 'invalid'
  else if (kind === 'draft') next.availability = 'draft'
  filters.value = next
}

const handleCatalogCommand = async (command) => {
  if (command === 'import') showImportDialog.value = true
  else if (command === 'health') await openHealthDialog()
  else if (command === 'refresh') await loadAllSkills()
}

const loadTaxonomy = async () => {
  try {
    const response = await getSkillTaxonomyApi()
    taxonomy.value = { ...taxonomy.value, ...(response.data || {}) }
  } catch (error) {
    showError(error?.response?.data?.msg || '加载 Skill 分类字典失败')
  }
}

const loadScopeSkills = async (scope) => {
  const response = await listSkillsApi(scope)
  const list = Array.isArray(response.data) ? response.data : []
  scopeCatalog.value = { ...scopeCatalog.value, [scope]: list }
  if (scope === activeScope.value && selectedSkillName.value) {
    const latest = list.find((skill) => skill.name === selectedSkillName.value)
    if (latest) selectedSkill.value = latest
  }
  return list
}

const loadSkills = async () => {
  try {
    await loadScopeSkills(activeScope.value)
  } catch (error) {
    showError(error?.response?.data?.msg || '加载 Skill 列表失败')
  }
}

const loadAllSkills = async () => {
  catalogLoading.value = true
  try {
    await Promise.all(scopes.map((scope) => loadScopeSkills(scope.value)))
    selectedNames.value = keepVisibleSelection(selectedNames.value, filteredSkills.value)
  } catch (error) {
    showError(error?.response?.data?.msg || '加载 Skill Catalog 失败')
  } finally {
    catalogLoading.value = false
  }
}

let searchTimer = null
const doSearch = async (keyword) => {
  const normalized = keyword.trim()
  if (!normalized) {
    searchResults.value = null
    searchError.value = ''
    return
  }
  searchLoading.value = true
  searchError.value = ''
  try {
    const response = await searchSkillsApi(activeScope.value, normalized)
    searchResults.value = Array.isArray(response.data) ? response.data : []
  } catch (error) {
    searchResults.value = []
    searchError.value = error?.response?.data?.msg || '搜索失败，请重试'
  } finally {
    searchLoading.value = false
  }
}

watch(searchKeyword, (value) => {
  clearTimeout(searchTimer)
  clearBatchSelection()
  if (!value.trim()) {
    searchResults.value = null
    searchError.value = ''
    return
  }
  searchResults.value = []
  searchTimer = setTimeout(() => doSearch(value), 350)
})

watch(
  filters,
  () => {
    clearBatchSelection()
  },
  { deep: true }
)

watch(catalogMode, (mode) => {
  if (mode !== 'simple') return
  const current = filters.value
  filters.value = {
    ...emptyFilters(),
    category: current.category,
    platform: current.platform,
    risk: current.risk,
    availability: current.availability,
    health: current.health === 'problems' ? 'problems' : ''
  }
})

const onScopeChange = async (scope) => {
  if (scope === activeScope.value) return
  activeScope.value = scope
  searchKeyword.value = ''
  searchResults.value = null
  searchError.value = ''
  clearFilters()
  clearBatchSelection()
}

const hasUnsavedChanges = () => dirtyFilePaths.value.length > 0
const confirmLeaveEdit = async () => {
  if (!hasUnsavedChanges()) return true
  try {
    await ElMessageBox.confirm(
      `有 ${dirtyFilePaths.value.length} 个文件未保存，离开后将丢失修改。`,
      '存在未保存内容',
      {
        confirmButtonText: '放弃并离开',
        cancelButtonText: '继续编辑',
        type: 'warning'
      }
    )
    return true
  } catch {
    return false
  }
}

const clearWorkspace = () => {
  selectedSkill.value = null
  selectedSkillName.value = ''
  skillFiles.value = []
  currentFilePath.value = ''
  currentFileContent.value = ''
  currentFileEncoding.value = 'text'
  currentFileSize.value = 0
  dirtyFilePaths.value = []
}

const openWorkspace = async (skill, tab = 'overview') => {
  if (!skill?.name) return
  if (selectedSkillName.value && selectedSkillName.value !== skill.name) {
    if (!(await confirmLeaveEdit())) return
  }
  viewMode.value = 'workspace'
  const requestedTab = typeof tab === 'string' ? tab : 'overview'
  workspaceTab.value = requestedTab === 'validation' ? 'overview' : requestedTab
  await openSkill(skill)
  if (requestedTab === 'validation') showIssueDrawer.value = true
}

const backToCatalog = async () => {
  if (!(await confirmLeaveEdit())) return
  viewMode.value = 'catalog'
  showIssueDrawer.value = false
  clearWorkspace()
}

const openSkill = async (skill) => {
  const sameSkill = skill.name === selectedSkillName.value
  selectedSkill.value = skill
  selectedSkillName.value = skill.name
  dirtyFilePaths.value = []
  if (!sameSkill) {
    currentFilePath.value = ''
    currentFileContent.value = ''
  }
  await loadSkillFiles()
  const remembered = sameSkill ? uiState.value.lastFilePath : ''
  const exists = (path) => skillFiles.value.some((file) => file.path === path)
  const target =
    (remembered && exists(remembered) && remembered) ||
    (exists('SKILL.md') && 'SKILL.md') ||
    skillFiles.value[0]?.path ||
    ''
  if (target) await openFile(target)
}

const loadSkillFiles = async () => {
  if (!selectedSkillName.value) return
  filesLoading.value = true
  try {
    const response = await listSkillFilesApi(activeScope.value, selectedSkillName.value)
    skillFiles.value = Array.isArray(response.data) ? response.data : []
  } catch (error) {
    showError(error?.response?.data?.msg || '加载文件列表失败')
    skillFiles.value = []
  } finally {
    filesLoading.value = false
  }
}

const reloadFiles = async () => {
  await loadSkillFiles()
  if (currentFilePath.value && !skillFiles.value.some((file) => file.path === currentFilePath.value)) {
    currentFilePath.value = ''
    currentFileContent.value = ''
  }
}

const openFile = async (path, force = false) => {
  if (!path || !selectedSkillName.value) return
  if (!force && path === currentFilePath.value) return
  if (fileEditorRef.value?.hasUnsavedChanges?.()) {
    try {
      await ElMessageBox.confirm('当前文件有未保存修改，切换后将丢失。', '存在未保存内容', {
        confirmButtonText: '放弃并切换',
        cancelButtonText: '继续编辑',
        type: 'warning'
      })
    } catch {
      return
    }
  }
  fileLoading.value = true
  try {
    const response = await getSkillFileApi(activeScope.value, selectedSkillName.value, path)
    const data = response.data || {}
    currentFilePath.value = path
    currentFileContent.value = data.content ?? ''
    currentFileEncoding.value = data.encoding || 'text'
    currentFileSize.value = data.size || 0
    uiState.value = { ...uiState.value, lastFilePath: path }
  } catch (error) {
    showError(error?.response?.data?.msg || '加载文件失败')
  } finally {
    fileLoading.value = false
  }
}

const onFileSelect = (path) => openFile(path)
const onOpenAfterWrite = async (path) => {
  await loadSkillFiles()
  await openFile(path, true)
}
const onFileSaved = async ({ path }) => {
  dirtyFilePaths.value = dirtyFilePaths.value.filter((item) => item !== path)
  await loadSkillFiles()
  if (path === 'SKILL.md' || path === 'manifest.yaml') await loadSkills()
}
const onDirtyChange = (dirty) => {
  const path = currentFilePath.value
  if (!path) return
  const hasPath = dirtyFilePaths.value.includes(path)
  if (dirty && !hasPath) dirtyFilePaths.value = [...dirtyFilePaths.value, path]
  else if (!dirty && hasPath) dirtyFilePaths.value = dirtyFilePaths.value.filter((item) => item !== path)
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

const openNewDialog = () => {
  showNewDialog.value = true
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
  await loadAllSkills()
  viewMode.value = 'catalog'
}

const handleManifestSaved = async () => {
  await loadSkills()
  await loadSkillFiles()
  if (currentFilePath.value === 'manifest.yaml') await openFile('manifest.yaml', true)
}

const toggleDisabledReason = (skill) => {
  if (!skill || skill.enabled) return ''
  if (!skill.valid) return '校验失败，修复错误后才能启用'
  if (skill.status !== 'published') return '只有 published 状态的 Skill 才能启用'
  return ''
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
  try {
    await ElMessageBox.confirm(
      `本次启用包含受控能力：${lines.join('，')}。启用只代表进入运行目录，每次执行仍必须绑定精确目标、ROE 和必要确认。`,
      '确认启用受控能力',
      {
        type: 'warning',
        confirmButtonText: '确认启用',
        cancelButtonText: '取消'
      }
    )
    return true
  } catch {
    return false
  }
}

const handleToggleForSkill = async (skill) => {
  if (!skill) return
  if (dirtyFilePaths.value.includes('manifest.yaml') && skill.name === selectedSkillName.value) {
    showWarning('manifest.yaml 有未保存修改，请先保存或放弃修改')
    return
  }
  const enabled = !skill.enabled
  if (enabled && !(await confirmRiskyEnable([skill]))) return
  toggleLoading.value = true
  try {
    await toggleSkillApi({ scope: activeScope.value, name: skill.name, enabled })
    showSuccess(enabled ? 'Skill 已启用' : 'Skill 已禁用')
    await loadSkills()
  } catch (error) {
    showError(error?.response?.data?.msg || '操作失败')
  } finally {
    toggleLoading.value = false
  }
}

const handleDetailCommand = async (command) => {
  if (command === 'export') await handleExport()
  else if (command === 'delete') await handleDelete(selectedSkill.value)
}

const handleRowCommand = async (command, skill) => {
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

const handleExport = async () => {
  if (selectedSkill.value) await downloadSkill(activeScope.value, selectedSkill.value.name)
}
const downloadSkill = async (scope, name) => {
  try {
    const response = await exportSkillApi(scope, name)
    const blob =
      response.data instanceof Blob
        ? response.data
        : new Blob([response.data], { type: 'application/zip' })
    downloadBlob(blob, `${name}.skill`)
  } catch (error) {
    showError(error?.response?.data?.msg || error?.message || '导出失败')
  }
}

const onTableSelectionChange = (rows) => {
  selectedNames.value = new Set((rows || []).map((row) => row.name))
}
const clearBatchSelection = () => {
  selectedNames.value = new Set()
  tableRef.value?.clearSelection?.()
}
const toggleSelectAll = (selected) => {
  tableRef.value?.clearSelection?.()
  if (selected) {
    for (const skill of filteredSkills.value) tableRef.value?.toggleRowSelection?.(skill, true)
  }
}
const restoreTableSelection = async (names) => {
  await nextTick()
  tableRef.value?.clearSelection?.()
  for (const skill of filteredSkills.value) {
    if (names.has(skill.name)) tableRef.value?.toggleRowSelection?.(skill, true)
  }
}

const showBatchResults = (title, data) => {
  batchResultTitle.value = title
  batchResultData.value = {
    changed: Number(data?.changed) || 0,
    unchanged: Number(data?.unchanged) || 0,
    failed: Number(data?.failed) || 0,
    results: data?.results || []
  }
  showBatchResultDialog.value = true
}

const handleBatchToggle = async (enabled) => {
  const targets = selectedSkills.value
  if (!targets.length) return
  if (dirtyFilePaths.value.includes('manifest.yaml')) {
    showWarning('manifest.yaml 有未保存修改，请先保存或放弃修改')
    return
  }
  if (enabled && !(await confirmRiskyEnable(targets))) return
  if (!enabled) {
    try {
      await ElMessageBox.confirm(`确认禁用选中的 ${targets.length} 个 Skill？`, '批量禁用', {
        type: 'info',
        confirmButtonText: '禁用',
        cancelButtonText: '取消'
      })
    } catch {
      return
    }
  } else {
    const hasControlledTarget = targets.some(
      (skill) => skill.requiresExplicitApproval || ['high', 'critical'].includes(skill.risk)
    )
    if (!hasControlledTarget) {
      try {
        await ElMessageBox.confirm(
          `确认启用选中的 ${targets.length} 个 Skill？只有已发布且校验通过的条目会被启用。`,
          '批量启用',
          {
            type: 'warning',
            confirmButtonText: '启用',
            cancelButtonText: '取消'
          }
        )
      } catch {
        return
      }
    }
  }

  batchToggleLoading.value = true
  try {
    const response = await toggleSkillsBatchApi({
      scope: activeScope.value,
      names: targets.map((skill) => skill.name),
      enabled
    })
    const data = response.data || {}
    await loadSkills()
    showBatchResults(`批量${enabled ? '启用' : '禁用'}结果`, data)
    const failedNames = new Set(
      (data.results || []).filter((item) => item.status === 'failed').map((item) => item.name)
    )
    selectedNames.value = failedNames
    await restoreTableSelection(failedNames)
  } catch (error) {
    showError(error?.response?.data?.msg || error?.message || '批量操作失败')
  } finally {
    batchToggleLoading.value = false
  }
}

const handleBatchExport = async () => {
  const targets = selectedSkills.value
  if (!targets.length) return
  batchExportLoading.value = true
  try {
    const response = await exportSkillsBatchApi({
      scope: activeScope.value,
      names: targets.map((skill) => skill.name)
    })
    const blob =
      response.data instanceof Blob
        ? response.data
        : new Blob([response.data], { type: 'application/zip' })
    const date = new Date().toISOString().slice(0, 10)
    downloadBlob(blob, `skills_${activeScope.value}_${date}.zip`)
    clearBatchSelection()
  } catch (error) {
    showError(error?.response?.data?.msg || error?.message || '批量导出失败')
  } finally {
    batchExportLoading.value = false
  }
}

const handleBatchDelete = async () => {
  const targets = selectedSkills.value
  if (!targets.length) return
  try {
    await ElMessageBox.confirm(
      `确认删除选中的 ${targets.length} 个 Skill？删除后无法恢复。`,
      '批量删除确认',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        confirmButtonClass: 'el-button--danger'
      }
    )
  } catch {
    return
  }
  batchDeleteLoading.value = true
  try {
    const response = await deleteSkillsBatchApi({
      scope: activeScope.value,
      names: targets.map((skill) => skill.name)
    })
    const data = response.data || {}
    await loadSkills()
    showBatchResults('批量删除结果', data)
    const failedNames = new Set(
      (data.results || []).filter((item) => item.status === 'failed').map((item) => item.name)
    )
    selectedNames.value = failedNames
    await restoreTableSelection(failedNames)
  } catch (error) {
    showError(error?.response?.data?.msg || error?.message || '批量删除失败')
  } finally {
    batchDeleteLoading.value = false
  }
}

const batchResultType = (status) =>
  ({ changed: 'success', deleted: 'success', unchanged: 'info', failed: 'danger' })[status] || 'info'
const batchResultLabel = (status) =>
  ({ changed: '已变更', deleted: '已删除', unchanged: '未变更', failed: '失败' })[status] || status
const locateBatchResult = async (name) => {
  const skill = findSkill(name)
  if (!skill) return
  showBatchResultDialog.value = false
  await openWorkspace(skill, 'validation')
}

const openHealthDialog = async () => {
  try {
    const response = await getSkillHealthApi(activeScope.value)
    healthData.value = response.data || healthData.value
    showHealthDialog.value = true
  } catch (error) {
    showError(error?.response?.data?.msg || 'Skill 健康检查失败')
  }
}

const healthRowState = (row) => {
  if (!row.valid) return { label: '错误', type: 'danger' }
  if ((row.issues || []).some((issue) => String(issue.severity).toUpperCase() === 'WARNING')) {
    return { label: '警告', type: 'warning' }
  }
  return { label: '健康', type: 'success' }
}

const locateHealthRow = async (row) => {
  const skill = findSkill(row.name)
  if (!skill) return
  showHealthDialog.value = false
  await openWorkspace(skill, 'validation')
}

loadTaxonomy()
loadAllSkills()
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

.catalog-header,
.workspace-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  flex-shrink: 0;
}

.catalog-heading,
.workspace-title-wrap {
  display: flex;
  align-items: flex-start;
  min-width: 0;
  gap: 12px;
}

.catalog-heading-icon,
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

.catalog-kicker,
.section-heading span {
  display: block;
  margin-bottom: 3px;
  color: var(--el-text-color-secondary);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.catalog-heading h1,
.workspace-title h1 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 22px;
  line-height: 1.2;
}

.catalog-heading p,
.workspace-title p {
  margin: 5px 0 0;
  max-width: 760px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.catalog-header-actions,
.workspace-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.catalog-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  flex-shrink: 0;
}

.stat-card {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 2px 10px;
  padding: 10px 12px;
  border: 1px solid var(--app-surface-border-subtle);
  border-radius: var(--app-control-radius);
  color: var(--el-text-color-primary);
  background: var(--app-card-background);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
}

.stat-card:hover,
.stat-card.active {
  border-color: color-mix(in srgb, var(--el-color-primary) 50%, var(--app-border-color));
  background: color-mix(in srgb, var(--el-color-primary) 4%, var(--app-card-background));
}

.stat-card:active {
  transform: translateY(1px);
}

.stat-card span {
  color: var(--el-text-color-secondary);
  font-size: 11px;
  font-weight: 600;
}

.stat-card strong {
  grid-row: span 2;
  align-self: center;
  color: var(--el-text-color-primary);
  font-size: 24px;
}

.stat-card em {
  color: var(--el-text-color-placeholder);
  font-size: 10px;
  font-style: normal;
}

.stat-card--success strong {
  color: var(--el-color-success);
}

.stat-card--warning strong {
  color: var(--el-color-warning);
}

.stat-card--danger strong {
  color: var(--el-color-danger);
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
  padding: 12px 14px;
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

.filter-popover-title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.filter-popover-title strong,
.filter-popover-title span {
  display: block;
}

.filter-popover-title strong {
  margin-bottom: 3px;
  font-size: 14px;
}

.filter-popover-title span {
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.filter-grid--simple {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.filter-grid label > span {
  display: block;
  margin-bottom: 5px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
  font-weight: 600;
}

.filter-grid :deep(.el-select) {
  width: 100%;
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

.catalog-table-wrap {
  flex: 1;
  min-height: 0;
  padding: 0 8px 8px;
}

.catalog-table {
  height: 100%;
  --el-table-header-bg-color: var(--app-control-background-soft);
  --el-table-row-hover-bg-color: color-mix(in srgb, var(--el-color-primary) 4%, transparent);
}

.catalog-table :deep(.el-table__row) {
  cursor: default;
}

.skill-name-cell {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 9px;
}

.skill-name-icon {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 7px;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 9%, var(--app-control-background));
}

.skill-name-cell > div:last-child {
  min-width: 0;
}

.skill-name-cell strong,
.skill-name-cell span,
.stacked-cell strong,
.stacked-cell span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-name-cell strong,
.stacked-cell strong {
  color: var(--el-text-color-primary);
  font-size: 12px;
}

.skill-name-cell span,
.stacked-cell span {
  margin-top: 3px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.stacked-cell .el-tag + span {
  margin-top: 4px;
}

.mini-tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  color: var(--el-text-color-secondary);
  font-size: 10px;
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

.workspace-title h1 {
  font-size: 19px;
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

.overview-scroll,
.validation-scroll {
  height: 100%;
  overflow: auto;
  padding: 18px;
}

.overview-card {
  padding: 15px;
  border: 1px solid var(--app-surface-border-subtle);
  border-radius: var(--app-control-radius);
  background: var(--app-card-background);
}

.skill-brief-description {
  max-width: 860px;
  margin: 0;
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: 1.7;
}

.skill-brief-meta {
  display: grid;
  margin-top: 18px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.skill-brief-meta > span {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding: 10px 12px;
  overflow: hidden;
  border-radius: var(--app-control-radius);
  color: var(--el-text-color-primary);
  background: var(--app-control-background-soft);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-brief-meta small {
  color: var(--el-text-color-secondary);
  font-size: 10px;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.section-heading h2 {
  margin: 0;
  font-size: 14px;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 12px;
}

.overview-list-card :deep(.section-heading) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.overview-list-card :deep(.section-heading span) {
  display: block;
  margin-bottom: 3px;
  color: var(--el-text-color-secondary);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.overview-list-card :deep(.section-heading h2) {
  margin: 0;
  font-size: 14px;
}

.overview-list-card :deep(.overview-list-group + .overview-list-group) {
  margin-top: 12px;
}

.overview-list-card :deep(.overview-list-group > strong) {
  display: block;
  margin-bottom: 6px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.overview-list-card :deep(.overview-tag-list) {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.overview-list-card :deep(.empty-value) {
  color: var(--el-text-color-placeholder);
  font-size: 11px;
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

.validation-summary {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 15px;
  border: 1px solid var(--app-surface-border-subtle);
  border-radius: var(--app-control-radius);
  background: var(--app-control-background-soft);
}

.validation-drawer {
  height: auto;
  padding: 0;
}

.validation-summary > div:first-child {
  font-size: 30px;
}

.validation-icon--success {
  color: var(--el-color-success);
}

.validation-icon--danger {
  color: var(--el-color-danger);
}

.validation-summary > div:nth-child(2) {
  flex: 1;
}

.validation-summary h2 {
  margin: 0;
  font-size: 15px;
}

.validation-summary p {
  margin: 4px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.validation-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.validation-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--app-surface-border-subtle);
  border-radius: var(--app-control-radius);
  color: var(--el-text-color-primary);
  background: var(--app-card-background);
  text-align: left;
  cursor: pointer;
}

.validation-item:hover {
  border-color: color-mix(in srgb, var(--el-color-primary) 35%, var(--app-border-color));
  background: color-mix(in srgb, var(--el-color-primary) 3%, var(--app-card-background));
}

.issue-level {
  min-width: 64px;
  padding: 3px 7px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  text-align: center;
}

.issue-level--error {
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
}

.issue-level--warning {
  color: var(--el-color-warning);
  background: var(--el-color-warning-light-9);
}

.issue-content {
  flex: 1;
  min-width: 0;
}

.issue-content strong,
.issue-content span {
  display: block;
}

.issue-content strong {
  margin-bottom: 3px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}

.issue-content span,
.issue-target {
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.issue-target {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.validation-empty {
  min-height: 240px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: var(--el-text-color-secondary);
}

.validation-empty svg {
  font-size: 40px;
  color: var(--el-color-success);
}

.validation-empty strong {
  color: var(--el-text-color-primary);
  font-size: 14px;
}

.validation-empty span {
  font-size: 12px;
}

.health-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.health-summary > div {
  min-width: 92px;
  padding: 9px 12px;
  border: 1px solid var(--app-surface-border-subtle);
  border-radius: var(--app-control-radius);
}

.health-summary span {
  display: block;
  color: var(--el-text-color-secondary);
  font-size: 10px;
}

.health-summary strong {
  display: block;
  margin-top: 2px;
  color: var(--el-color-success);
  font-size: 20px;
}

.health-warning strong {
  color: var(--el-color-warning);
}

.health-danger strong {
  color: var(--el-color-danger);
}

.health-summary p {
  margin-left: auto;
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.health-issues {
  display: flex;
  flex-direction: column;
  gap: 4px;
  white-space: normal;
  line-height: 1.45;
}

.issue-error {
  color: var(--el-color-danger);
}

.issue-warning {
  color: var(--el-color-warning);
}

.batch-result-summary {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

@media (max-width: 1180px) {
  .catalog-stats {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .catalog-heading p {
    display: none;
  }

  .workspace-actions .el-button span:not(.el-icon) {
    display: none;
  }
}

@media (max-width: 900px) {
  .catalog-header,
  .workspace-header {
    flex-direction: column;
  }

  .catalog-header-actions,
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

  .overview-grid,
  .filter-grid {
    grid-template-columns: 1fr;
  }

  .skill-brief-meta {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
