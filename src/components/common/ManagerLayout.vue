<template>
  <div
    class="home-content module-shell"
    :class="moduleClass"
  >
    <div class="manager-stage">
      <!-- 工作区 -->
      <section class="workspace-shell">
        <aside
          class="list-panel"
          :style="{ width: listWidth + 'px', flex: '0 0 auto' }"
        >
          <slot name="list" />
        </aside>

        <SplitterBar
          v-model="listWidth"
          :min="listMin"
          :max="listMax"
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
import SplitterBar from './SplitterBar.vue'

const props = defineProps({
  /** 模块根类名，便于 scope 内自定义样式 */
  moduleClass: { type: String, default: '' },
  /** 列表面板初始宽度 */
  initialListWidth: { type: Number, default: 280 },
  listMin: { type: Number, default: 220 },
  listMax: { type: Number, default: 480 }
})

const listWidth = ref(props.initialListWidth)

watch(
  () => props.initialListWidth,
  (v) => {
    listWidth.value = v
  }
)
</script>

<style scoped>
/* 让 ManagerLayout 根节点成为 flex 列容器，内部 .manager-stage 的
   flex: 1 / min-height: 0 才能生效，从而把高度收敛到列表/详情面板，
   使 .list-scroll 等内部滚动区按预期滚动。 */
.home-content {
  container: manager-workspace / inline-size;
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

@container manager-workspace (max-width: 760px) {
  .workspace-shell {
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
  }

  .workspace-shell :deep(.splitter) {
    display: none;
  }

  .list-panel {
    width: 100% !important;
    flex: 0 0 clamp(260px, 40%, 320px) !important;
    max-height: none;
  }

  .detail-panel {
    width: 100%;
    flex: 1 0 260px;
  }
}
</style>
