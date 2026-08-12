<template>
  <div class="detail-actions">
    <el-button
      type="primary"
      class="enter-btn"
      :disabled="!liveSessionCount && !canCreateSession"
      @click="emit('enter-console', puppet)"
    >
      <el-icon><Icon :icon="iconMap.arrowRight" /></el-icon>
      {{ liveSessionCount ? '进入会话' : canCreateSession ? '进入控制台' : '项目已归档' }}
    </el-button>

    <el-button
      :loading="testConnLoading || isCurrentPuppetTesting"
      :disabled="batchTestLoading"
      @click="emit('test-conn', puppet)"
    >
      <el-icon v-if="!testConnLoading && !isCurrentPuppetTesting">
        <Icon :icon="iconMap.connection" />
      </el-icon>
      测试连接
    </el-button>

    <el-button
      type="primary"
      plain
      @click="emit('edit', puppet)"
    >
      <el-icon><Icon :icon="iconMap.edit" /></el-icon>
      编辑
    </el-button>

    <el-dropdown
      trigger="click"
      @command="handleCommand"
    >
      <el-button
        class="more-btn"
        aria-label="更多主机操作"
      >
        <el-icon><Icon :icon="iconMap.more || 'ep:more-filled'" /></el-icon>
      </el-button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item
            v-if="liveSessionCount && canCreateSession"
            command="new-session"
          >
            <el-icon><Icon :icon="iconMap.add" /></el-icon>
            新建会话
          </el-dropdown-item>
          <el-dropdown-item command="share">
            <el-icon><Icon :icon="iconMap.share" /></el-icon>
            分享 / 导出配置
          </el-dropdown-item>
          <el-dropdown-item command="parasite">
            <el-icon><Icon :icon="iconMap.parasite" /></el-icon>
            添加子节点
          </el-dropdown-item>
          <el-dropdown-item
            command="delete"
            divided
            class="danger-item"
          >
            <el-icon><Icon :icon="iconMap.delete" /></el-icon>
            删除
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script setup>
import { icons } from '@/utils/icons.js'

const iconMap = icons

const props = defineProps({
  puppet: {
    type: Object,
    required: true
  },
  testConnLoading: {
    type: Boolean,
    default: false
  },
  isCurrentPuppetTesting: {
    type: Boolean,
    default: false
  },
  batchTestLoading: {
    type: Boolean,
    default: false
  },
  liveSessionCount: {
    type: Number,
    default: 0
  },
  canCreateSession: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits([
  'enter-console',
  'new-session',
  'test-conn',
  'edit',
  'share',
  'parasite',
  'delete'
])

const handleCommand = (command) => {
  emit(command, props.puppet)
}
</script>

<style scoped>
@import '@/styles/workbench-detail-actions-shared.css';

.detail-actions {
  flex-wrap: wrap;
  max-width: 620px;
}

.detail-actions :deep(.enter-btn) {
  min-width: 104px;
  box-shadow: none;
}

@media (max-width: 1100px) {
  .detail-actions {
    justify-content: flex-start;
    max-width: none;
  }
}

@media (max-width: 720px) {
  .detail-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 36px;
    width: 100%;
  }

  .detail-actions :deep(.el-button) {
    width: 100%;
  }

  .detail-actions :deep(.enter-btn) {
    grid-column: 1 / -1;
  }

  .detail-actions :deep(.el-dropdown) {
    width: 36px;
  }

  .more-btn {
    width: 36px;
  }
}
</style>
