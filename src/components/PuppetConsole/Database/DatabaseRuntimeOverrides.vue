<template>
  <el-collapse class="runtime-overrides">
    <el-collapse-item name="runtime-overrides">
      <template #title>
        <div class="runtime-overrides__title">
          <el-icon><Icon icon="mdi:tune-variant" /></el-icon>
          <span>高级运行时覆盖</span>
          <el-tag
            size="small"
            :type="runtimeStatusType"
            effect="plain"
          >
            {{ runtimeStatusLabel }}
          </el-tag>
          <el-button
            text
            size="small"
            :loading="loading"
            @click.stop="$emit('refresh')"
          >
            重新探测
          </el-button>
        </div>
      </template>

      <div class="runtime-overrides__tip">
        标准连接模式下这些字段是可选覆盖；自定义连接模式至少要完整配置一种当前 Puppet
        可用的运行时连接。平台不会远程安装驱动：JDBC 驱动须已在 Java Puppet
        的类路径中，PDO 驱动须已安装在 PHP Puppet 的运行环境中。
      </div>

      <el-alert
        v-if="capabilities?.requestedDriver?.available === false"
        :title="capabilities.requestedDriver.message || '当前驱动不可用'"
        type="error"
        :closable="false"
        show-icon
        class="runtime-overrides__alert"
      />
      <el-alert
        v-else-if="capabilities && capabilities.available === false"
        :title="capabilities.msg || '当前 Puppet 不支持数据库运行时'"
        type="error"
        :closable="false"
        show-icon
        class="runtime-overrides__alert"
      />

      <section
        v-if="showJava"
        class="runtime-overrides__group"
      >
        <div class="runtime-overrides__group-title">
          Java / JDBC
        </div>
        <el-form-item label="JDBC URL">
          <el-input
            v-model="model.java.jdbcUrl"
            placeholder="留空时自动生成"
            clearable
          />
        </el-form-item>
        <el-form-item label="驱动类">
          <el-select
            v-model="model.java.driverClass"
            filterable
            allow-create
            default-first-option
            placeholder="例如 com.mysql.cj.jdbc.Driver"
            style="width: 100%"
            @change="$emit('refresh')"
          >
            <el-option
              v-for="driver in availableDrivers"
              :key="driver.id"
              :label="driver.className || driver.name || driver.id"
              :value="driver.className || driver.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="连接属性">
          <el-input
            v-model="model.java.propertiesText"
            type="textarea"
            :rows="3"
            placeholder="JSON 对象，例如 {&quot;sslMode&quot;:&quot;verify-full&quot;}"
          />
        </el-form-item>
      </section>

      <section
        v-if="showPhp"
        class="runtime-overrides__group"
      >
        <div class="runtime-overrides__group-title">
          PHP / PDO
        </div>
        <el-form-item label="PDO DSN">
          <el-input
            v-model="model.php.dsn"
            placeholder="留空时自动生成"
            clearable
          />
        </el-form-item>
        <el-form-item label="PDO 驱动">
          <el-select
            v-model="model.php.pdoDriver"
            filterable
            allow-create
            default-first-option
            placeholder="例如 mysql、pgsql、sqlsrv、oci、sqlite"
            style="width: 100%"
            @change="$emit('refresh')"
          >
            <el-option
              v-for="driver in availableDrivers"
              :key="driver.id"
              :label="driver.name || driver.id"
              :value="driver.id"
            />
          </el-select>
        </el-form-item>
      </section>
    </el-collapse-item>
  </el-collapse>
</template>

<script setup>
import { Icon } from '@iconify/vue'
import { computed } from 'vue'

const model = defineModel({ type: Object, required: true })

const props = defineProps({
  capabilities: { type: Object, default: null },
  loading: { type: Boolean, default: false }
})

defineEmits(['refresh'])

const runtime = computed(() => props.capabilities?.runtime || '')
const showJava = computed(() => !runtime.value || runtime.value === 'java')
const showPhp = computed(() => !runtime.value || runtime.value === 'php')
const availableDrivers = computed(() =>
  Array.isArray(props.capabilities?.drivers)
    ? props.capabilities.drivers.filter((driver) => driver?.available !== false)
    : []
)
const runtimeStatusType = computed(() => {
  if (props.loading) return 'info'
  if (!props.capabilities || Number(props.capabilities.code) !== 200) return 'warning'
  if (
    props.capabilities.available === false ||
    props.capabilities.requestedDriver?.available === false
  ) {
    return 'danger'
  }
  return 'success'
})
const runtimeStatusLabel = computed(() => {
  if (props.loading) return '探测中'
  if (!props.capabilities) return '未探测'
  if (Number(props.capabilities.code) !== 200) return '探测失败'
  if (props.capabilities.available === false) return '运行时不可用'
  if (props.capabilities.requestedDriver?.available === false) return '驱动不可用'
  const provider = String(props.capabilities.provider || '').toUpperCase()
  return provider ? `${provider} 可用` : '运行时可用'
})
</script>

<style scoped>
.runtime-overrides {
  margin-top: 14px;
  border-top: 1px solid var(--el-border-color-lighter);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.runtime-overrides__title {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 600;
}

.runtime-overrides__title .el-icon {
  color: var(--el-color-primary);
}

.runtime-overrides__tip {
  margin-bottom: 14px;
  padding: 9px 11px;
  border-radius: 6px;
  background: var(--database-config-muted-surface);
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.55;
}

.runtime-overrides__alert {
  margin-bottom: 14px;
}

.runtime-overrides__group + .runtime-overrides__group {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px dashed var(--el-border-color-lighter);
}

.runtime-overrides__group-title {
  margin: 0 0 10px 104px;
  color: var(--el-text-color-regular);
  font-size: 12px;
  font-weight: 650;
}
</style>
