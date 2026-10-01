<template>
  <div class="dialog-header">
    <div class="header-row header-row--meta">
      <div class="header-main">
        <div class="file-info">
          <el-icon
            :class="fileIconClass"
            class="file-icon"
          >
            <Icon :icon="fileIcon" />
          </el-icon>
          <div class="file-details">
            <h4
              :id="titleId"
              :class="titleClass"
              class="dialog-title"
            >
              {{ displayFileName }}
            </h4>
            <div class="file-subtitle">
              <el-tag
                size="small"
                effect="plain"
              >
                {{ fileTypeLabel }}
              </el-tag>
              <el-tag
                v-if="fileType !== 'image' && fileType !== 'pdf'"
                size="small"
                type="info"
                effect="plain"
              >
                {{ codeLanguage }}
              </el-tag>
              <el-tag
                :type="modified ? 'warning' : 'success'"
                size="small"
                effect="plain"
              >
                {{ modified ? '已修改' : '已同步' }}
              </el-tag>
              <el-tooltip
                :content="filePath"
                :show-after="500"
                placement="top"
              >
                <span class="file-path">{{ shortenedFilePath }}</span>
              </el-tooltip>
              <el-tooltip
                content="复制完整路径"
                placement="top"
              >
                <el-button
                  class="path-copy-button"
                  size="small"
                  text
                  aria-label="复制文件路径"
                  @click.stop="emit('action', 'copy-path')"
                >
                  <el-icon>
                    <Icon :icon="iconMap.copyPath" />
                  </el-icon>
                </el-button>
              </el-tooltip>
            </div>
            <div
              v-if="textPreview"
              class="file-meta-row"
            >
              <span class="meta-item">{{ formatFileSize(fileSize) }}</span>
              <span class="meta-item">{{ currentEncoding.toUpperCase() }}</span>
              <span class="meta-item">{{ lineEndingLabel }}</span>
              <span class="meta-item">{{ lineCount }} 行</span>
              <span class="meta-item">{{ charCount }} 字符</span>
              <span
                v-if="largeFileMode"
                class="meta-item meta-item--warning"
              >
                只读预览
              </span>
            </div>
          </div>
        </div>
      </div>
      <div class="window-actions">
        <el-select
          v-if="textPreview"
          v-model="fontSize"
          placeholder="字号"
          size="small"
          style="width: 80px"
        >
          <el-option
            v-for="size in [12, 13, 14, 15, 16, 18, 20, 24]"
            :key="size"
            :label="`${size}px`"
            :value="size"
          />
        </el-select>
        <el-button
          v-if="fileType === 'image'"
          :loading="refreshing"
          size="small"
          aria-label="刷新图片预览"
          @click="emit('action', 'refresh')"
        >
          <el-icon>
            <Icon :icon="iconMap.refresh" />
          </el-icon>
        </el-button>
        <el-button
          :title="fullscreen ? '退出全屏' : '全屏显示'"
          size="small"
          @click="emit('action', 'fullscreen')"
        >
          <el-icon>
            <Icon :icon="fullscreen ? iconMap.aim : iconMap.fullScreen" />
          </el-icon>
        </el-button>
        <el-button
          class="close-btn"
          size="small"
          type="text"
          aria-label="关闭文件预览"
          @click="emit('action', 'close')"
        >
          <el-icon>
            <Icon :icon="iconMap.close" />
          </el-icon>
        </el-button>
      </div>
    </div>

    <div
      v-if="textPreview"
      class="header-row header-row--tools"
    >
      <div class="header-actions">
        <el-button-group>
          <el-tooltip
            content="撤销"
            placement="top"
          >
            <el-button
              :disabled="!canUndo"
              size="small"
              aria-label="撤销编辑"
              @click="emit('action', 'undo')"
            >
              <el-icon>
                <Icon :icon="iconMap.arrowLeft" />
              </el-icon>
            </el-button>
          </el-tooltip>
          <el-tooltip
            content="重做"
            placement="top"
          >
            <el-button
              :disabled="!canRedo"
              size="small"
              aria-label="重做编辑"
              @click="emit('action', 'redo')"
            >
              <el-icon>
                <Icon :icon="iconMap.arrowRight" />
              </el-icon>
            </el-button>
          </el-tooltip>
        </el-button-group>
        <el-button-group>
          <el-button
            size="small"
            aria-label="查找"
            @click="emit('action', 'search')"
          >
            <el-icon>
              <Icon :icon="iconMap.search" />
            </el-icon>
            查找
          </el-button>
          <el-button
            size="small"
            aria-label="替换"
            @click="emit('action', 'replace')"
          >
            <el-icon>
              <Icon :icon="iconMap.edit" />
            </el-icon>
            替换
          </el-button>
        </el-button-group>
        <el-button
          size="small"
          @click="emit('action', 'format')"
        >
          <el-icon>
            <Icon :icon="iconMap.magicStick" />
          </el-icon>
          格式化
        </el-button>
        <el-select
          v-model="currentEncoding"
          :disabled="saving || encoding"
          placeholder="编码"
          size="small"
          style="width: 110px"
          @change="emit('encoding-change')"
        >
          <el-option
            v-for="option in encodingOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
        <el-select
          v-model="lineEnding"
          placeholder="换行"
          size="small"
          style="width: 86px"
          @change="emit('line-ending-change')"
        >
          <el-option
            v-for="option in lineEndingOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
        <el-tooltip
          content="检测编码"
          placement="top"
        >
          <el-button
            size="small"
            aria-label="检测文件编码"
            @click="emit('action', 'detect-encoding')"
          >
            <el-icon>
              <Icon :icon="iconMap.connection" />
            </el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip
          :content="wordWrap ? '关闭自动换行' : '开启自动换行'"
          placement="top"
        >
          <el-button
            size="small"
            :aria-label="wordWrap ? '关闭自动换行' : '开启自动换行'"
            @click="emit('action', 'word-wrap')"
          >
            <el-icon>
              <Icon :icon="iconMap.codeView" />
            </el-icon>
          </el-button>
        </el-tooltip>
        <el-button
          size="small"
          @click="emit('action', 'download')"
        >
          <el-icon>
            <Icon :icon="iconMap.download" />
          </el-icon>
          下载
        </el-button>
        <el-button
          :disabled="!canSave"
          :loading="saving"
          size="small"
          :type="modified ? 'primary' : 'info'"
          @click="emit('action', 'save')"
        >
          <el-icon>
            <Icon :icon="iconMap.save" />
          </el-icon>
          {{ modified ? '保存' : '已保存' }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'
import { formatFileSize } from '@/utils/format.js'

defineProps({
  titleId: { type: String, default: '' },
  titleClass: { type: String, default: '' },
  displayFileName: { type: String, default: '' },
  fileType: { type: String, default: 'text' },
  fileTypeLabel: { type: String, default: '' },
  codeLanguage: { type: String, default: 'plaintext' },
  modified: Boolean,
  filePath: { type: String, default: '' },
  shortenedFilePath: { type: String, default: '' },
  textPreview: Boolean,
  fileSize: { type: Number, default: 0 },
  lineEndingLabel: { type: String, default: '' },
  lineCount: { type: Number, default: 0 },
  charCount: { type: Number, default: 0 },
  largeFileMode: Boolean,
  fileIcon: { type: String, default: '' },
  fileIconClass: { type: String, default: '' },
  refreshing: Boolean,
  fullscreen: Boolean,
  canUndo: Boolean,
  canRedo: Boolean,
  encodingOptions: { type: Array, default: () => [] },
  lineEndingOptions: { type: Array, default: () => [] },
  saving: Boolean,
  encoding: Boolean,
  canSave: Boolean,
  wordWrap: Boolean
})
const emit = defineEmits(['action', 'encoding-change', 'line-ending-change'])
const fontSize = defineModel('fontSize', { type: Number, default: 14 })
const currentEncoding = defineModel('currentEncoding', { type: String, default: 'utf-8' })
const lineEnding = defineModel('lineEnding', { type: String, default: 'LF' })
const iconMap = icons
</script>

<style scoped>
.dialog-header {
  display: flex;
  flex-direction: column;
  gap: 0;
  background: var(--preview-toolbar-surface);
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 10px;
}

.header-row--meta {
  border-bottom: 1px solid var(--preview-soft-border);
}

.header-row--tools {
  padding-top: 5px;
  padding-bottom: 5px;
}

.header-main {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.file-icon {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
  border-radius: var(--radius-control);
  background: var(--preview-muted-surface);
  color: var(--el-text-color-primary);
  border: 1px solid var(--preview-soft-border);
}

.file-details {
  flex: 1;
  min-width: 0;
}

.dialog-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  margin: 0;
  line-height: 1.3;
}

.file-subtitle {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 3px;
  min-width: 0;
  flex-wrap: wrap;
}

.file-path {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--preview-muted-surface);
  border: 1px solid var(--preview-soft-border);
  font-size: 11px;
  color: var(--el-text-color-secondary);
  flex: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.path-copy-button {
  flex: 0 0 auto;
  width: 24px;
  height: 22px;
  min-height: 22px;
  padding: 0;
  border-radius: 7px;
  color: var(--el-text-color-secondary);
}

.path-copy-button:hover {
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 10%, transparent);
}

.file-meta-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 3px;
  min-width: 0;
  flex-wrap: wrap;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 6px;
  border-radius: 6px;
  border: 1px solid var(--preview-soft-border);
  color: var(--el-text-color-secondary);
  background: color-mix(in srgb, var(--preview-muted-surface) 78%, transparent);
  font-size: 11px;
  line-height: 1;
  white-space: nowrap;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.meta-item--warning {
  color: var(--el-color-warning);
  border-color: color-mix(in srgb, var(--el-color-warning) 34%, transparent);
  background: color-mix(in srgb, var(--el-color-warning) 10%, transparent);
}

.window-actions,
.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.header-actions :deep(.el-button) {
  border-radius: 9px;
  height: 30px;
  font-weight: 600;
}

.header-actions :deep(.el-button-group .el-button) {
  border-radius: 8px;
}

.header-actions :deep(.el-select .el-select__wrapper) {
  border-radius: 9px;
  box-shadow: none;
  background: var(--preview-muted-surface);
  min-height: 30px;
}

@media (max-width: 900px) {
  .header-row { flex-direction: column; align-items: stretch; }
  .window-actions, .header-actions { justify-content: flex-start; flex-wrap: wrap; width: 100%; }
  .file-subtitle { flex-wrap: wrap; }
}
</style>
