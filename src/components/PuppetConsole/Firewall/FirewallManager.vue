<template>
  <div class="fw-workbench">
    <div class="fw-shell">
      <!-- 工具栏 -->
      <section class="fw-toolbar">
        <div class="toolbar-left">
          <el-button
            type="primary"
            size="small"
            :loading="isLoading && loadType === 'status'"
            @click="handleGetStatus"
          >
            <el-icon><Icon icon="mdi:shield-check" /></el-icon>
            刷新状态
          </el-button>
          <el-button
            size="small"
            :loading="isLoading && loadType === 'rules'"
            @click="handleListRules"
          >
            <el-icon><Icon icon="mdi:format-list-bulleted" /></el-icon>
            刷新规则
          </el-button>
          <el-select
            v-model="directionFilter"
            placeholder="方向筛选"
            size="small"
            clearable
            style="width: 120px"
          >
            <el-option
              label="入站 (in)"
              value="in"
            />
            <el-option
              label="出站 (out)"
              value="out"
            />
          </el-select>
          <el-input
            v-model="searchText"
            placeholder="搜索规则名 / 端口 / 地址"
            size="small"
            clearable
            class="search-input"
          >
            <template #prefix>
              <el-icon><Icon icon="mdi:magnify" /></el-icon>
            </template>
          </el-input>
        </div>
        <div class="toolbar-right">
          <span
            v-if="filteredRules.length > 0"
            class="result-count"
          >
            {{ filteredRules.length }} / {{ rules.length }} 条规则
          </span>
          <el-button
            size="small"
            text
            @click="showAddDialog = true"
          >
            <el-icon><Icon icon="mdi:plus" /></el-icon>
            添加规则
          </el-button>
          <el-button
            size="small"
            text
            :disabled="!filteredRules.length"
            @click="handleExport"
          >
            <el-icon><Icon icon="mdi:download" /></el-icon>
            导出
          </el-button>
        </div>
      </section>

      <!-- 状态卡片 -->
      <section
        v-if="fwStatus"
        class="fw-status-section"
      >
        <div class="status-card">
          <div class="status-header">
            <el-icon size="18">
              <Icon icon="mdi:shield-lock" />
            </el-icon>
            <span class="status-title">防火墙状态</span>
            <el-tag
              :type="fwEnabled ? 'success' : 'danger'"
              size="small"
              effect="dark"
            >
              {{ fwEnabled ? '已启用' : '已禁用' }}
            </el-tag>
            <div class="status-actions">
              <el-popconfirm
                v-if="fwEnabled"
                title="确认禁用防火墙？这将暴露所有端口！"
                confirm-button-text="禁用"
                cancel-button-text="取消"
                @confirm="handleToggle(false)"
              >
                <template #reference>
                  <el-button
                    size="small"
                    type="danger"
                    text
                  >
                    禁用防火墙
                  </el-button>
                </template>
              </el-popconfirm>
              <el-button
                v-else
                size="small"
                type="success"
                text
                @click="handleToggle(true)"
              >
                启用防火墙
              </el-button>
            </div>
          </div>
          <div class="status-details">
            <div
              v-for="(val, key) in statusDisplay"
              :key="key"
              class="status-item"
            >
              <span class="status-key">{{ key }}</span>
              <span class="status-val">{{ val }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 规则表格 -->
      <section class="fw-table-wrap">
        <div
          v-if="!rulesLoaded && !isLoading"
          class="empty-state"
        >
          <el-icon size="40">
            <Icon icon="mdi:shield-lock" />
          </el-icon>
          <p>点击「刷新规则」加载规则列表；点击「刷新状态」查看开关状态</p>
        </div>

        <el-table
          v-else
          v-loading="isLoading"
          :data="filteredRules"
          stripe
          border
          size="small"
          height="100%"
          :default-sort="{ prop: 'name', order: 'ascending' }"
          highlight-current-row
          class="fw-table"
          @sort-change="handleSortChange"
        >
          <el-table-column
            prop="name"
            label="规则名"
            min-width="200"
            sortable="custom"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              <span class="rule-name">{{ row.name || row.ruleName || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column
            prop="direction"
            label="方向"
            width="80"
            sortable="custom"
          >
            <template #default="{ row }">
              <el-tag
                v-if="row.direction"
                size="small"
                :type="row.direction.toLowerCase() === 'in' ? 'warning' : 'info'"
                effect="plain"
              >
                {{ row.direction }}
              </el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column
            prop="action"
            label="动作"
            width="80"
            sortable="custom"
          >
            <template #default="{ row }">
              <el-tag
                v-if="row.action"
                size="small"
                :type="actionColor(row.action)"
                effect="plain"
              >
                {{ row.action }}
              </el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column
            prop="protocol"
            label="协议"
            width="80"
            sortable="custom"
            show-overflow-tooltip
          />
          <el-table-column
            prop="localPort"
            label="本地端口"
            width="120"
            sortable="custom"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ row.localPort || row.port || '-' }}
            </template>
          </el-table-column>
          <el-table-column
            prop="remoteAddress"
            label="远程地址"
            min-width="140"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ row.remoteAddress || row.remoteIP || '-' }}
            </template>
          </el-table-column>
          <el-table-column
            prop="program"
            label="程序"
            min-width="160"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ row.program || '-' }}
            </template>
          </el-table-column>
          <el-table-column
            prop="enabled"
            label="启用"
            width="70"
          >
            <template #default="{ row }">
              <el-tag
                v-if="row.enabled !== undefined"
                size="small"
                :type="row.enabled === 'Yes' || row.enabled === true ? 'success' : 'info'"
                effect="plain"
              >
                {{ row.enabled === 'Yes' || row.enabled === true ? 'Yes' : 'No' }}
              </el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column
            label="操作"
            width="80"
            fixed="right"
          >
            <template #default="{ row }">
              <el-popconfirm
                :title="`确认删除规则 '${row.name || row.ruleName || ''}'？`"
                confirm-button-text="删除"
                cancel-button-text="取消"
                @confirm="handleDeleteRule(row)"
              >
                <template #reference>
                  <el-button
                    type="danger"
                    size="small"
                    text
                  >
                    删除
                  </el-button>
                </template>
              </el-popconfirm>
            </template>
          </el-table-column>
        </el-table>
      </section>
    </div>

    <!-- 添加规则对话框 -->
    <el-dialog
      v-model="showAddDialog"
      title="添加防火墙规则"
      width="520px"
      destroy-on-close
    >
      <el-form
        label-width="90px"
        size="small"
      >
        <el-form-item label="规则名称">
          <el-input
            v-model="addForm.ruleName"
            placeholder="Windows 必填，如 Allow_HTTP"
          />
        </el-form-item>
        <el-form-item label="方向">
          <el-select
            v-model="addForm.direction"
            style="width: 100%"
          >
            <el-option
              label="入站 (in)"
              value="in"
            />
            <el-option
              label="出站 (out)"
              value="out"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="动作">
          <el-select
            v-model="addForm.action"
            style="width: 100%"
          >
            <el-option
              label="允许 (allow)"
              value="allow"
            />
            <el-option
              label="阻止 (block)"
              value="block"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="协议">
          <el-select
            v-model="addForm.protocol"
            style="width: 100%"
          >
            <el-option
              label="TCP"
              value="tcp"
            />
            <el-option
              label="UDP"
              value="udp"
            />
            <el-option
              label="Any"
              value="any"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="本地端口">
          <el-input
            v-model="addForm.localPort"
            placeholder="如 80、443、8080-8090"
          />
        </el-form-item>
        <el-form-item label="远程地址">
          <el-input
            v-model="addForm.remoteAddress"
            placeholder="如 192.168.1.0/24（可选）"
          />
        </el-form-item>
        <el-form-item label="原始规则">
          <el-input
            v-model="addForm.rawRule"
            type="textarea"
            :rows="2"
            placeholder="Linux 原始参数，直接传递给 ufw/firewall-cmd/iptables（可选）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button
          size="small"
          @click="showAddDialog = false"
        >
          取消
        </el-button>
        <el-button
          type="primary"
          size="small"
          :loading="isLoading"
          @click="handleAddRule"
        >
          添加
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import { Icon } from '@iconify/vue'
import {
  getFirewallStatusApi,
  listFirewallRulesApi,
  addFirewallRuleApi,
  deleteFirewallRuleApi,
  toggleFirewallApi
} from '@/services/api.js'
import { showError, showSuccess, showWarning } from '@/utils/messageUtils.js'
import { exportTsv } from '@/utils/exportUtils.js'

const props = defineProps({
  sessionId: {
    type: String,
    required: true
  }
})

// ==================== 状态 ====================

const isLoading = ref(false)
const loadType = ref('')
const rulesLoaded = ref(false)
const rules = ref([])
const fwStatus = ref(null)
const fwEnabled = ref(false)
const searchText = ref('')
const directionFilter = ref('')
const sortState = ref({ prop: 'name', order: 'ascending' })
const showAddDialog = ref(false)

const addForm = reactive({
  ruleName: '',
  direction: 'in',
  action: 'allow',
  protocol: 'tcp',
  localPort: '',
  remoteAddress: '',
  rawRule: ''
})

// ==================== 计算属性 ====================

const statusDisplay = computed(() => {
  if (!fwStatus.value) return {}
  const result = {}
  const data = fwStatus.value
  // 展平显示关键字段，排除 code/msg 等元字段
  for (const [k, v] of Object.entries(data)) {
    if (['code', 'msg', 'os'].includes(k)) continue
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [sk, sv] of Object.entries(v)) {
        result[`${k}.${sk}`] = String(sv)
      }
    } else if (v !== null && v !== undefined) {
      result[k] = String(v)
    }
  }
  return result
})

const filteredRules = computed(() => {
  let list = [...rules.value]
  if (directionFilter.value) {
    const f = directionFilter.value.toLowerCase()
    list = list.filter(r => (r.direction || '').toLowerCase() === f)
  }
  const q = searchText.value.trim().toLowerCase()
  if (q) {
    list = list.filter(r => {
      const name = (r.name || r.ruleName || '').toLowerCase()
      const port = (r.localPort || r.port || '').toString().toLowerCase()
      const addr = (r.remoteAddress || r.remoteIP || '').toLowerCase()
      const prog = (r.program || '').toLowerCase()
      return name.includes(q) || port.includes(q) || addr.includes(q) || prog.includes(q)
    })
  }
  const { prop, order } = sortState.value
  if (prop && order) {
    list.sort((a, b) => {
      const va = (a[prop] || '').toString()
      const vb = (b[prop] || '').toString()
      const cmp = va.localeCompare(vb)
      return order === 'ascending' ? cmp : -cmp
    })
  }
  return list
})

// ==================== 方法 ====================

async function handleGetStatus() {
  isLoading.value = true
  loadType.value = 'status'
  try {
    const res = await getFirewallStatusApi({ sessionId: props.sessionId })
    const data = res.data
    fwStatus.value = data
    // 尝试判断是否启用
    const raw = JSON.stringify(data).toLowerCase()
    fwEnabled.value = raw.includes('"on"') || raw.includes('"enabled"')
      || raw.includes('"running"') || raw.includes('"active"')
      || raw.includes('"state":"on"')
  } catch (err) {
    showError('获取防火墙状态失败: ' + (err.message || err))
  } finally {
    isLoading.value = false
    loadType.value = ''
  }
}

async function handleListRules() {
  isLoading.value = true
  loadType.value = 'rules'
  rulesLoaded.value = true
  try {
    const res = await listFirewallRulesApi({ sessionId: props.sessionId })
    const data = res.data
    rules.value = data.rules || []
    if (rules.value.length === 0) {
      showWarning('未获取到防火墙规则')
    }
  } catch (err) {
    showError('获取防火墙规则失败: ' + (err.message || err))
  } finally {
    isLoading.value = false
    loadType.value = ''
  }
}

async function handleAddRule() {
  isLoading.value = true
  try {
    const params = { sessionId: props.sessionId }
    if (addForm.ruleName.trim()) params.ruleName = addForm.ruleName.trim()
    if (addForm.direction) params.direction = addForm.direction
    if (addForm.action) params.action = addForm.action
    if (addForm.protocol) params.protocol = addForm.protocol
    if (addForm.localPort.trim()) params.localPort = addForm.localPort.trim()
    if (addForm.remoteAddress.trim()) params.remoteAddress = addForm.remoteAddress.trim()
    if (addForm.rawRule.trim()) params.rawRule = addForm.rawRule.trim()

    await addFirewallRuleApi(params)
    showSuccess('防火墙规则已添加')
    showAddDialog.value = false
    // 重置表单
    addForm.ruleName = ''
    addForm.localPort = ''
    addForm.remoteAddress = ''
    addForm.rawRule = ''
    if (rulesLoaded.value) await handleListRules()
  } catch (err) {
    showError('添加规则失败: ' + (err.message || err))
  } finally {
    isLoading.value = false
  }
}

async function handleDeleteRule(row) {
  try {
    const params = { sessionId: props.sessionId }
    if (row.name || row.ruleName) params.ruleName = row.name || row.ruleName
    if (row.ruleIndex) params.ruleIndex = String(row.ruleIndex)

    await deleteFirewallRuleApi(params)
    showSuccess('防火墙规则已删除')
    rules.value = rules.value.filter(r => r !== row)
  } catch (err) {
    showError('删除规则失败: ' + (err.message || err))
  }
}

async function handleToggle(enable) {
  try {
    await toggleFirewallApi({ sessionId: props.sessionId, enable })
    showSuccess(`防火墙已${enable ? '启用' : '禁用'}`)
    fwEnabled.value = enable
    await handleGetStatus()
  } catch (err) {
    showError('操作失败: ' + (err.message || err))
  }
}

function handleSortChange({ prop, order }) {
  sortState.value = { prop, order }
}

function handleExport() {
  exportTsv(filteredRules.value, 'firewall_rules', [
    { label: 'Name', key: r => r.name || r.ruleName || '' },
    { label: 'Direction', key: 'direction' },
    { label: 'Action', key: 'action' },
    { label: 'Protocol', key: 'protocol' },
    { label: 'LocalPort', key: r => r.localPort || r.port || '' },
    { label: 'RemoteAddress', key: r => r.remoteAddress || r.remoteIP || '' },
    { label: 'Program', key: 'program' },
    { label: 'Enabled', key: r => r.enabled !== undefined ? String(r.enabled) : '' }
  ])
}

function actionColor(action) {
  if (!action) return 'info'
  const a = action.toLowerCase()
  if (a.includes('allow') || a.includes('accept') || a.includes('pass')) return 'success'
  if (a.includes('block') || a.includes('deny') || a.includes('drop') || a.includes('reject')) return 'danger'
  return 'info'
}
</script>

<style scoped>
.fw-workbench {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
}

.fw-shell {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.fw-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  gap: 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color-page);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-input {
  width: 260px;
}

.result-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

/* ── 状态卡片 ── */
.fw-status-section {
  padding: 8px 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.status-card {
  background: var(--el-bg-color-page);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 10px 14px;
}

.status-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.status-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.status-actions {
  margin-left: auto;
}

.status-details {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 24px;
}

.status-item {
  display: flex;
  gap: 6px;
  font-size: 12px;
  line-height: 1.8;
}

.status-key {
  color: var(--el-text-color-secondary);
  font-weight: 500;
  flex-shrink: 0;
}

.status-val {
  color: var(--el-text-color-regular);
  word-break: break-all;
}

/* ── 表格 ── */
.fw-table-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.fw-table {
  font-size: 12px;
}

.rule-name {
  color: var(--el-text-color-primary);
  font-weight: 500;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--el-text-color-placeholder);
  gap: 12px;
  padding: 40px;
}

.empty-state p {
  font-size: 13px;
}
</style>
