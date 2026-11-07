<template>
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
          @click="emit('edit-config')"
        >
          编辑配置
        </el-button>
      </div>
      <p class="skill-brief-description">
        {{ skill.description || '暂无说明，请编辑 SKILL.md 补充适用场景和执行边界。' }}
      </p>
      <div class="skill-brief-meta">
        <span><small>分类</small>{{ skill.category || '未分类' }}</span>
        <span><small>平台</small>{{ (skill.platforms || []).join('、') || '未声明' }}</span>
        <span><small>风险</small>{{ skill.risk || 'unknown' }}</span>
        <span><small>访问</small>{{ skill.accessMode || '未声明' }}</span>
      </div>
    </section>

    <section
      v-if="mode === 'governance'"
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
          {{ skill.id }}
        </el-descriptions-item>
        <el-descriptions-item label="负责人">
          {{ skill.owner }}
        </el-descriptions-item>
        <el-descriptions-item label="来源">
          {{ skill.source }}
        </el-descriptions-item>
        <el-descriptions-item label="能力域">
          {{ skill.domain }}
        </el-descriptions-item>
        <el-descriptions-item label="主分类">
          {{ skill.category }}
        </el-descriptions-item>
        <el-descriptions-item label="能力包">
          {{ skill.pack || '—' }}
        </el-descriptions-item>
        <el-descriptions-item label="执行模式">
          {{ skill.mode }}
        </el-descriptions-item>
        <el-descriptions-item label="风险">
          {{ skill.risk }}
        </el-descriptions-item>
        <el-descriptions-item label="访问模式">
          {{ skill.accessMode }}
        </el-descriptions-item>
      </el-descriptions>
    </section>

    <div
      v-if="mode === 'governance'"
      class="overview-grid"
    >
      <section
        v-for="card in cards"
        :key="card.title"
        class="overview-card overview-list-card"
      >
        <div class="section-heading">
          <div><span>{{ card.kicker }}</span><h2>{{ card.title }}</h2></div>
        </div>
        <div
          v-for="group in card.groups"
          :key="group.label"
          class="overview-list-group"
        >
          <strong>{{ group.label }}</strong>
          <div class="overview-tag-list">
            <template v-if="group.values?.length">
              <el-tag
                v-for="value in group.values"
                :key="value"
                size="small"
                effect="plain"
                type="info"
              >
                {{ value }}
              </el-tag>
            </template>
            <span
              v-else
              class="empty-value"
            >未声明</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  skill: { type: Object, default: () => ({}) },
  mode: { type: String, default: 'simple' },
  isAdmin: { type: Boolean, default: false }
})
const emit = defineEmits(['edit-config'])
const cards = computed(() => [
  { title: '平台与目标', kicker: 'TARGETING', groups: [
    { label: 'Platforms', values: props.skill.platforms }, { label: 'Targets', values: props.skill.targets }
  ] },
  { title: 'ATT&CK 映射', kicker: 'ATT&CK', groups: [
    { label: 'Tactics', values: props.skill.tactics }, { label: 'Techniques', values: props.skill.techniques }
  ] },
  { title: '运行依赖', kicker: 'REQUIRES', groups: [
    { label: 'Tools', values: props.skill.requiredTools }, { label: 'Skills', values: props.skill.requiredSkills },
    { label: 'Facts', values: props.skill.requiredFacts }
  ] },
  { title: '产出与后续', kicker: 'OUTPUTS', groups: [
    { label: 'Produces', values: props.skill.produces }, { label: 'Next', values: props.skill.next }
  ] }
])
</script>

<style scoped>
.section-heading span {
  display: block;
  margin-bottom: 3px;
  color: var(--el-text-color-secondary);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.overview-scroll {
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

.overview-list-card .overview-list-group + .overview-list-group {
  margin-top: 12px;
}

.overview-list-card .overview-list-group > strong {
  display: block;
  margin-bottom: 6px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.overview-list-card .overview-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.overview-list-card .empty-value {
  color: var(--el-text-color-placeholder);
  font-size: 11px;
}

@media (max-width: 900px) {
  .overview-grid {
    grid-template-columns: 1fr;
  }
  .skill-brief-meta {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
