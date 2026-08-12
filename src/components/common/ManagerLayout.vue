<template>
  <div
    class="home-content module-shell"
    :class="moduleClass"
  >
    <div class="manager-stage">
      <!-- 顶栏 -->
      <section
        v-if="!hideToolbar"
        class="page-toolbar"
      >
        <div class="toolbar-title">
          <div class="title-row">
            <el-icon v-if="icon">
              <Icon :icon="icon" />
            </el-icon>
            <h1>{{ title }}</h1>
          </div>
        </div>

        <div
          v-if="stats && stats.length"
          class="toolbar-stats"
        >
          <el-tag
            v-for="(s, idx) in stats"
            :key="idx"
            effect="light"
            :type="s.type || 'info'"
            class="toolbar-tag"
            :class="`toolbar-tag-${s.type || 'info'}`"
          >
            {{ s.label }} {{ s.value }}
          </el-tag>
        </div>

        <slot name="toolbar-extra" />
      </section>

      <!-- 工作区 -->
      <section class="workspace-shell">
        <aside
          class="list-panel"
          :style="{ width: listWidth + 'px', flex: '0 0 auto' }"
        >
          <slot name="list" />
        </aside>

        <SplitterBar
          v-if="!hideSplitter"
          v-model="listWidth"
          :min="listMin"
          :max="listMax"
          @change="onListWidthChange"
        />

        <main class="detail-panel">
          <slot name="detail" />
        </main>
      </section>

      <!-- 默认槽：放对话框、teleport 内容等 -->
      <slot />
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import SplitterBar from './SplitterBar.vue'

const props = defineProps({
  title: { type: String, required: true },
  icon: { type: String, default: '' },
  stats: { type: Array, default: () => [] },
  /** 模块根类名，便于 scope 内自定义样式 */
  moduleClass: { type: String, default: '' },
  /** 列表面板初始宽度；可与 v-model:listWidth 联动持久化 */
  initialListWidth: { type: Number, default: 280 },
  listMin: { type: Number, default: 220 },
  listMax: { type: Number, default: 480 },
  hideToolbar: { type: Boolean, default: false },
  hideSplitter: { type: Boolean, default: false }
})

const emit = defineEmits(['update:listWidth', 'list-width-change'])

const listWidth = ref(props.initialListWidth)

watch(
  () => props.initialListWidth,
  (v) => {
    listWidth.value = v
  }
)

watch(listWidth, (v) => emit('update:listWidth', v))

const onListWidthChange = (v) => emit('list-width-change', v)
</script>

<style scoped>
@import '@/styles/workbench-toolbar-shared.css';

/* 让 ManagerLayout 根节点成为 flex 列容器，内部 .manager-stage 的
   flex: 1 / min-height: 0 才能生效，从而把高度收敛到列表/详情面板，
   使 .list-scroll 等内部滚动区按预期滚动。 */
.home-content {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}

.manager-stage {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--module-gap);
  overflow: hidden;
}

/* 紧凑 header */
.page-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-layout-gap);
  padding: 0;
  flex-shrink: 0;
}

.toolbar-title {
  min-width: 0;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-row .el-icon {
  font-size: 16px;
  color: var(--el-color-primary);
}

.title-row h1 {
  margin: 0;
  font-size: var(--font-size-section-title);
  font-weight: var(--font-weight-title);
  line-height: 1.2;
  color: var(--el-text-color-primary);
}

.toolbar-stats {
  gap: 6px;
}

.toolbar-stats :deep(.el-tag) {
  height: 22px;
  padding: 0 8px;
  font-size: 11px;
  font-weight: 500;
}

.workspace-shell {
  flex: 1;
  min-height: 0;
  display: flex;
}

.list-panel {
  display: flex;
  flex-direction: column;
  border-radius: var(--app-panel-radius);
  border: 1px solid var(--app-surface-border-strong);
  background: color-mix(in srgb, var(--app-card-background) 96%, var(--app-surface-background));
  box-shadow: none;
  overflow: hidden;
  min-height: 0;
}

.detail-panel {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

@media (max-width: 900px) {
  .workspace-shell {
    flex-direction: column;
    gap: 8px;
    overflow: hidden;
  }

  .workspace-shell :deep(.splitter) {
    display: none;
  }

  .list-panel {
    width: 100% !important;
    flex: 0 0 min(360px, 48%) !important;
    max-height: 48%;
  }

  .detail-panel {
    width: 100%;
    flex: 1 1 auto;
  }
}
</style>
