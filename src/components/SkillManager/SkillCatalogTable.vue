<template>
  <div class="catalog-table-wrap">
    <el-table
      ref="tableRef"
      v-loading="loading"
      :data="items"
      row-key="name"
      height="100%"
      class="catalog-table"
      @selection-change="onSelectionChange"
      @row-dblclick="row => emit('open', row)"
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
              <span class="skill-description">{{ row.description || '暂无描述' }}</span>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column
        v-if="mode === 'simple'"
        label="分类 / 平台"
        min-width="170"
      >
        <template #default="{ row }">
          <div class="stacked-cell">
            <strong>{{ row.category || '未分类' }}</strong>
            <span class="cell-secondary">{{ (row.platforms || []).slice(0, 3).join(' · ') || '—' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column
        v-if="mode === 'governance'"
        label="分类 / 能力包"
        min-width="155"
        sortable
        :sort-by="(row) => row.category || ''"
      >
        <template #default="{ row }">
          <div class="stacked-cell">
            <strong>{{ row.category || '未分类' }}</strong>
            <span class="cell-secondary">{{ row.pack || row.domain || '—' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column
        v-if="mode === 'governance'"
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
        :label="mode === 'governance' ? '风险 / 访问' : '风险'"
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
            <span
              v-if="mode === 'governance'"
              class="cell-secondary"
            >{{ row.accessMode || '—' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column
        v-if="mode === 'governance'"
        label="生命周期"
        min-width="100"
        sortable
        prop="status"
      >
        <template #default="{ row }">
          <div class="stacked-cell">
            <strong>{{ row.status || 'unknown' }}</strong>
            <span class="cell-secondary">{{ row.version || '—' }}</span>
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
            @click.stop="emit('open', row)"
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
                @click.stop="emit('toggle', row)"
              >
                {{ row.enabled ? '禁用' : '启用' }}
              </el-button>
            </span>
          </el-tooltip>
          <el-dropdown
            trigger="click"
            @command="command => emit('command', command, row)"
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
</template>

<script setup>
import { nextTick, onScopeDispose, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { icons as iconMap } from '@/utils/icons.js'
import SkillAvailabilityTag from './SkillAvailabilityTag.vue'
import { skillRiskTagType as riskTagType, skillToggleDisabledReason as toggleDisabledReason } from './skillUiModel.js'

const props = defineProps({
  items: { type: Array, default: () => [] },
  selectedNames: { type: Set, default: () => new Set() },
  mode: { type: String, default: 'simple' },
  loading: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false }
})
const emit = defineEmits(['selection-change', 'open', 'toggle', 'command'])
const tableRef = ref(null)
let syncing = false, revision = 0, disposed = false

// Element Plus selection details stay private. Parent code owns only a set of names.
watch([() => props.items, () => Array.from(props.selectedNames)], async () => {
  const request = ++revision
  syncing = true
  await nextTick()
  if (disposed || request !== revision) return
  try {
    tableRef.value?.clearSelection?.()
    for (const row of props.items) {
      if (props.selectedNames.has(row.name)) tableRef.value?.toggleRowSelection?.(row, true)
    }
  } finally {
    await nextTick()
    if (request === revision) syncing = false
  }
}, { immediate: true })

const onSelectionChange = (rows) => {
  if (syncing || disposed) return
  const requested = new Set((rows || []).map(row => row.name))
  const visibleRows = props.items.filter(row => requested.has(row.name))
  if (visibleRows.length === props.selectedNames.size && visibleRows.every(row => props.selectedNames.has(row.name))) return
  emit('selection-change', visibleRows)
}
onScopeDispose(() => { disposed = true; revision += 1 })
</script>

<style scoped>
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
.skill-description,
.stacked-cell > strong,
.stacked-cell > .cell-secondary {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-name-cell strong,
.stacked-cell > strong {
  color: var(--el-text-color-primary);
  font-size: var(--font-size-body);
}

.skill-description,
.stacked-cell > .cell-secondary {
  margin-top: var(--space-1);
  color: var(--el-text-color-secondary);
  font-size: var(--font-size-helper);
}

.stacked-cell > .el-tag + .cell-secondary {
  margin-top: var(--space-1);
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
</style>
