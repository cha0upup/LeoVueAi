<template>
  <section class="detail-card empty-state">
    <EmptyState
      workbench
      :title="emptyTitle"
      :description="emptyDescription"
      :icon="iconMap.server"
    >
      <template v-if="!hasHosts && canCreate">
        <el-button
          type="primary"
          @click="emit('add')"
        >
          <el-icon><Icon :icon="iconMap.add" /></el-icon>
          新增节点
        </el-button>
        <el-button @click="emit('import')">
          <el-icon><Icon :icon="iconMap.upload" /></el-icon>
          导入节点配置
        </el-button>
      </template>
    </EmptyState>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { icons as iconMap } from '@/utils/icons.js'

const props = defineProps({
  hasHosts: {
    type: Boolean,
    default: false
  },
  canCreate: {
    type: Boolean,
    default: true
  },
  title: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['add', 'import'])

const emptyTitle = computed(() =>
  props.hasHosts ? '选择一个接入节点' : props.title || '还没有接入节点'
)
const emptyDescription = computed(() =>
  props.hasHosts
    ? '从左侧选择一个接入节点，查看详情并进入控制台。'
    : props.description ||
      (props.canCreate
        ? '新增或导入一个接入节点后，就可以在这里查看配置、测试连接并进入控制台。'
        : '当前工作区保留节点与会话信息。')
)
</script>

<style scoped>
.detail-card {
  min-height: 0;
  height: 100%;
  overflow: auto;
  border: 1px solid var(--pm-soft-border);
  border-radius: 8px;
  background: var(--pm-panel);
  box-shadow: var(--pm-shadow);
  backdrop-filter: blur(10px);
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 1320px) {
  .detail-card {
    min-height: 720px;
  }
}
</style>
