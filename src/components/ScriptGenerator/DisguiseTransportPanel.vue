<template>
  <section class="form-group transport-panel">
    <div class="group-heading">
      <strong>传输封装</strong>
    </div>
    <div class="form-grid">
      <el-form-item
        label="请求伪装"
        required
      >
        <el-select
          v-model="form.reqDisguiseId"
          placeholder="选择请求伪装"
          clearable
          filterable
        >
          <el-option
            v-for="item in disguises"
            :key="item.disguiseId"
            :label="`${item.disguiseName}(${item.version})`"
            :value="item.disguiseId"
          />
        </el-select>
      </el-form-item>
      <el-form-item
        label="响应伪装"
        required
      >
        <el-select
          v-model="form.respDisguiseId"
          placeholder="选择响应伪装"
          clearable
          filterable
        >
          <el-option
            v-for="item in disguises"
            :key="item.disguiseId"
            :label="`${item.disguiseName}(${item.version})`"
            :value="item.disguiseId"
          />
        </el-select>
      </el-form-item>
      <el-form-item
        label="HTTP 响应码"
        required
      >
        <el-input-number
          v-model="form.respCode"
          :min="100"
          :max="599"
        />
      </el-form-item>
    </div>
  </section>
</template>

<script setup>
const form = defineModel('form', { type: Object, required: true })
defineProps({ disguises: { type: Array, default: () => [] } })
</script>

<style scoped>
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px 10px; }
.group-heading { margin-bottom: 9px; }
.group-heading strong { color: var(--sg-ink); font-size: 12px; }
@media (max-width: 760px) { .form-grid { grid-template-columns: 1fr; } }
</style>
