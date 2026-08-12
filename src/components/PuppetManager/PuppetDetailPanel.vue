<template>
  <main class="detail-panel">
    <section
      v-if="puppet"
      class="detail-card"
    >
      <PuppetDetailHero
        :puppet="puppet"
        :live-session-count="sessions.length"
        :test-conn-loading="testConnLoading"
        :is-current-puppet-testing="isCurrentPuppetTesting"
        :batch-test-loading="batchTestLoading"
        :test-conn-result="testConnResult"
        :cache-check-result="cacheCheckResult"
        :cache-check-loading="cacheCheckLoading"
        :cache-availability="cacheAvailability"
        :cache-availability-loading="cacheAvailabilityLoading"
        :can-create-session="canCreateSession"
        @enter-console="emit('enter-console', $event)"
        @new-session="emit('new-session', $event)"
        @enter-cache="emit('enter-cache', $event)"
        @refresh-cache-availability="emit('refresh-cache-availability', $event)"
        @test-conn="emit('test-conn', $event)"
        @edit="emit('edit', $event)"
        @share="emit('share', $event)"
        @parasite="emit('parasite', $event)"
        @delete="emit('delete', $event)"
        @enter-cache-mode="emit('enter-cache-mode')"
        @dismiss-test-result="emit('dismiss-test-result')"
        @dismiss-cache-result="emit('dismiss-cache-result')"
      />

      <PuppetSessionsPanel
        :sessions="sessions"
        :active-session-id="activeSessionId"
        :deleting-session-ids="deletingSessionIds"
        @select="emit('select-session', $event)"
        @open="emit('open-session', $event)"
        @delete="emit('delete-session', $event)"
      />

      <PuppetDetailInfoGrid
        :puppet="puppet"
        :quick-saving-key="quickSavingKey"
        @toggle-quick-config="emit('toggle-quick-config', $event)"
      />

      <PuppetDetailStrategyPanel :puppet="puppet" />

      <PuppetDetailHeaderPanel :puppet="puppet" />
    </section>

    <PuppetDetailEmpty
      v-else
      :has-hosts="totalCount > 0"
      :can-create="canCreateHosts"
      :title="emptyTitle"
      :description="emptyDescription"
      @add="emit('add')"
      @import="emit('import')"
    />
  </main>
</template>

<script setup>
import PuppetDetailEmpty from './PuppetDetailEmpty.vue'
import PuppetDetailHeaderPanel from './PuppetDetailHeaderPanel.vue'
import PuppetDetailHero from './PuppetDetailHero.vue'
import PuppetDetailInfoGrid from './PuppetDetailInfoGrid.vue'
import PuppetDetailStrategyPanel from './PuppetDetailStrategyPanel.vue'
import PuppetSessionsPanel from './PuppetSessionsPanel.vue'

defineProps({
  puppet: {
    type: Object,
    default: null
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
  testConnResult: {
    type: Object,
    default: null
  },
  cacheCheckResult: {
    type: Object,
    default: null
  },
  cacheCheckLoading: {
    type: Boolean,
    default: false
  },
  cacheAvailability: {
    type: Object,
    default: () => ({ checked: false, hasCache: false, saveTime: null })
  },
  cacheAvailabilityLoading: {
    type: Boolean,
    default: false
  },
  quickSavingKey: {
    type: String,
    default: ''
  },
  totalCount: {
    type: Number,
    default: 0
  },
  sessions: {
    type: Array,
    default: () => []
  },
  activeSessionId: {
    type: String,
    default: ''
  },
  deletingSessionIds: {
    type: Array,
    default: () => []
  },
  canCreateHosts: {
    type: Boolean,
    default: true
  },
  canCreateSession: {
    type: Boolean,
    default: true
  },
  emptyTitle: {
    type: String,
    default: ''
  },
  emptyDescription: {
    type: String,
    default: ''
  }
})

const emit = defineEmits([
  'enter-console',
  'new-session',
  'enter-cache',
  'refresh-cache-availability',
  'test-conn',
  'edit',
  'share',
  'parasite',
  'delete',
  'toggle-quick-config',
  'enter-cache-mode',
  'add',
  'import',
  'dismiss-test-result',
  'dismiss-cache-result',
  'select-session',
  'open-session',
  'delete-session'
])
</script>

<style scoped>
.detail-panel {
  min-width: 0;
  min-height: 0;
  height: 100%;
}

.detail-card {
  min-height: 0;
  height: 100%;
  overflow: auto;
  border: 0;
  border-radius: 0;
  background: var(--app-container-background);
  box-shadow: none;
}

@media (max-width: 1320px) {
  .detail-card {
    min-height: 720px;
  }
}
</style>
