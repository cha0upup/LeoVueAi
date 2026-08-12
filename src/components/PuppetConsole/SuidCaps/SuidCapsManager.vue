<template>
  <div class="suid-workbench">
    <div class="suid-shell">
      <!-- 工具栏 -->
      <section class="suid-toolbar">
        <div class="toolbar-left">
          <el-button
            type="primary"
            size="small"
            :loading="isLoading && loadType === 'all'"
            @click="handleLoadAll"
          >
            <el-icon><Icon icon="mdi:shield-search" /></el-icon>
            全部枚举
          </el-button>
          <el-divider direction="vertical" />
          <el-button
            size="small"
            :loading="isLoading && loadType === 'suid'"
            @click="handleLoad('suid')"
          >
            SUID
          </el-button>
          <el-button
            size="small"
            :loading="isLoading && loadType === 'sgid'"
            @click="handleLoad('sgid')"
          >
            SGID
          </el-button>
          <el-button
            size="small"
            :loading="isLoading && loadType === 'caps'"
            @click="handleLoad('caps')"
          >
            Capabilities
          </el-button>
        </div>
        <div class="toolbar-right">
          <span
            v-if="flatList.length > 0"
            class="result-count"
          >
            共 {{ flatList.length }} 项
            <template v-if="exploitableCount > 0">
              ，<span class="danger-text">{{ exploitableCount }} 个可提权</span>
            </template>
          </span>
          <el-button
            size="small"
            text
            :disabled="!flatList.length"
            @click="handleExport"
          >
            <el-icon><Icon icon="mdi:download" /></el-icon>
            导出
          </el-button>
        </div>
      </section>

      <!-- 表格 -->
      <section class="suid-table-wrap">
        <div
          v-if="!loaded && !isLoading"
          class="empty-state"
        >
          <el-icon size="40">
            <Icon icon="mdi:shield-alert" />
          </el-icon>
          <p>点击上方按钮枚举 SUID/SGID/Capabilities 文件（仅 Linux）</p>
        </div>

        <el-table
          v-else
          v-loading="isLoading"
          :data="flatList"
          stripe
          border
          size="small"
          height="100%"
          highlight-current-row
          :row-class-name="rowClassName"
        >
          <el-table-column
            prop="path"
            label="路径"
            min-width="300"
            show-overflow-tooltip
          />
          <el-table-column
            prop="type"
            label="类型"
            width="100"
          >
            <template #default="{ row }">
              <el-tag
                size="small"
                :type="typeTag(row.type)"
              >
                {{ row.type }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            prop="capabilities"
            label="Capabilities"
            width="220"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ row.capabilities || '-' }}
            </template>
          </el-table-column>
          <el-table-column
            prop="gtfobins"
            label="GTFOBins"
            width="90"
            align="center"
          >
            <template #default="{ row }">
              <el-tag
                v-if="row.gtfobins"
                type="danger"
                size="small"
              >
                可利用
              </el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column
            prop="dangerous"
            label="高危"
            width="70"
            align="center"
          >
            <template #default="{ row }">
              <el-icon
                v-if="row.dangerous"
                color="var(--el-color-danger)"
              >
                <Icon icon="mdi:alert" />
              </el-icon>
              <span v-else>-</span>
            </template>
          </el-table-column>
        </el-table>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { listAllSuidCapsApi, listSuidFilesApi, listSgidFilesApi, listCapabilitiesApi } from '@/services/api.js'
import { showError, showWarning } from '@/utils/messageUtils.js'
import { exportTsv } from '@/utils/exportUtils.js'

const props = defineProps({
  sessionId: { type: String, required: true }
})

const isLoading = ref(false)
const loaded = ref(false)
const loadType = ref('')
const flatList = ref([])

const exploitableCount = computed(() => flatList.value.filter(f => f.gtfobins || f.dangerous).length)

function unwrap(res) {
  let d = res.data
  if (d && typeof d === 'object' && 'code' in d && 'data' in d) {
    d = d.data
  }
  return d || {}
}

function flatten(rawData) {
  const items = []
  if (rawData.suid && rawData.suid.files) {
    for (const f of rawData.suid.files) {
      items.push({ ...f, type: 'SUID' })
    }
  }
  if (rawData.sgid && rawData.sgid.files) {
    for (const f of rawData.sgid.files) {
      items.push({ ...f, type: 'SGID' })
    }
  }
  if (rawData.capabilities && rawData.capabilities.files) {
    for (const f of rawData.capabilities.files) {
      items.push({ ...f, type: 'CAP' })
    }
  }
  // 可利用项排前面
  items.sort((a, b) => {
    const aScore = (a.gtfobins ? 2 : 0) + (a.dangerous ? 1 : 0)
    const bScore = (b.gtfobins ? 2 : 0) + (b.dangerous ? 1 : 0)
    return bScore - aScore
  })
  return items
}

async function handleLoadAll() {
  loadType.value = 'all'
  isLoading.value = true
  loaded.value = true
  try {
    const res = await listAllSuidCapsApi({ sessionId: props.sessionId })
    const data = unwrap(res)
    flatList.value = flatten(data)
    if (flatList.value.length === 0) showWarning('未发现 SUID/SGID/Capabilities 文件')
  } catch (err) {
    showError('枚举失败: ' + (err.message || err))
  } finally {
    isLoading.value = false
  }
}

async function handleLoad(type) {
  loadType.value = type
  isLoading.value = true
  loaded.value = true
  try {
    let res
    if (type === 'suid') res = await listSuidFilesApi({ sessionId: props.sessionId })
    else if (type === 'sgid') res = await listSgidFilesApi({ sessionId: props.sessionId })
    else res = await listCapabilitiesApi({ sessionId: props.sessionId })

    const data = unwrap(res)
    const wrapper = {}
    if (type === 'suid') wrapper.suid = data.suid || data
    else if (type === 'sgid') wrapper.sgid = data.sgid || data
    else wrapper.capabilities = data.capabilities || data

    flatList.value = flatten(wrapper)
    if (flatList.value.length === 0) showWarning('未发现 ' + type.toUpperCase() + ' 文件')
  } catch (err) {
    showError('枚举失败: ' + (err.message || err))
  } finally {
    isLoading.value = false
  }
}

function typeTag(type) {
  if (type === 'SUID') return 'danger'
  if (type === 'SGID') return 'warning'
  return ''
}

function rowClassName({ row }) {
  if (row.gtfobins) return 'row-exploitable'
  return ''
}

function handleExport() {
  if (flatList.value.length === 0) return
  exportTsv(flatList.value, 'suid-caps.tsv', ['path', 'type', 'capabilities', 'gtfobins', 'dangerous'])
}
</script>

<style scoped>
.suid-workbench {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
}

.suid-shell {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.suid-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  gap: 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color-page);
}

.toolbar-left { display: flex; align-items: center; gap: 8px; }
.toolbar-right { display: flex; align-items: center; gap: 8px; }

.result-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.danger-text { color: var(--el-color-danger); font-weight: 600; }

.suid-table-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

:deep(.row-exploitable) {
  background-color: var(--el-color-danger-light-9) !important;
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

.empty-state p { font-size: 13px; }
</style>
