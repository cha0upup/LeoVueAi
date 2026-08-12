<template>
  <!-- 流量伪装策略卡片 -->
  <div class="strategy-cards-grid">
    <div
      class="strategy-card"
      :class="{ active: urlStrategyEnabled }"
    >
      <div
        class="strategy-card-header"
        @click="urlStrategyEnabled = !urlStrategyEnabled"
      >
        <div class="strategy-card-icon">
          <el-icon><Icon icon="mdi:shuffle-variant" /></el-icon>
        </div>
        <div class="strategy-card-body">
          <div class="strategy-card-title">
            URL 随机化
          </div>
        </div>
        <div
          class="strategy-card-switch"
          @click.stop
        >
          <el-switch
            v-model="urlStrategyEnabled"
            inline-prompt
          />
        </div>
      </div>
      <div
        v-if="urlStrategyEnabled"
        class="strategy-card-detail"
      >
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="随机化模式">
              <el-select
                v-model="urlStrategyForm.mode"
                placeholder="请选择随机化模式"
                style="width: 100%"
              >
                <el-option
                  label="路径池（从真实路径中随机）"
                  value="POOL"
                />
                <el-option
                  label="模板生成（动态生成路径）"
                  value="TEMPLATE"
                />
                <el-option
                  label="静态资源模拟"
                  value="STATIC_ASSET"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="路径前缀">
              <el-input
                v-model="urlStrategyForm.prefix"
                placeholder="如 /assets、/api/v2"
                clearable
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item
          v-if="urlStrategyForm.mode === 'POOL'"
          label="路径池"
        >
          <el-input
            v-model="urlStrategyForm.urlPoolText"
            type="textarea"
            :autosize="{ minRows: 3, maxRows: 6 }"
            placeholder="每行一个 URL 路径，如：&#10;/api/config/sync&#10;/static/js/vendor.js&#10;/health/check"
          />
          <div class="form-tip">
            <span>每行一个目标站点真实存在的路径</span>
            <el-button
              type="primary"
              link
              :loading="probing"
              style="margin-left: 12px"
              @click="emitProbe"
            >
              {{ probing ? '探测中...' : '自动探测' }}
            </el-button>
          </div>
        </el-form-item>

        <el-form-item
          v-if="urlStrategyForm.mode === 'TEMPLATE'"
          label="路径模板"
        >
          <el-input
            v-model="urlStrategyForm.urlTemplate"
            placeholder="如 /static/{dir}/{rand}.{ext}"
            clearable
          />
          <div class="form-tip">
            <span>支持占位符：{rand} {uuid} {ts} {ext} {word} {dir} {hex}</span>
          </div>
        </el-form-item>

        <el-form-item label="扩展名池">
          <el-input
            v-model="urlStrategyForm.extensionsText"
            placeholder="逗号分隔，如 .js,.css,.png,.json"
            clearable
          />
        </el-form-item>
      </div>
    </div>

    <div
      class="strategy-card"
      :class="{ active: paddingEnabled }"
    >
      <div
        class="strategy-card-header"
        @click="paddingEnabled = !paddingEnabled"
      >
        <div class="strategy-card-icon">
          <el-icon><Icon icon="mdi:resize" /></el-icon>
        </div>
        <div class="strategy-card-body">
          <div class="strategy-card-title">
            请求体 Padding
          </div>
        </div>
        <div
          class="strategy-card-switch"
          @click.stop
        >
          <el-switch
            v-model="paddingEnabled"
            inline-prompt
          />
        </div>
      </div>
      <div
        v-if="paddingEnabled"
        class="strategy-card-detail"
      >
        <div style="margin-bottom: 12px; display: flex; gap: 8px">
          <el-button
            size="small"
            :type="paddingPreset === 'stealth' ? 'primary' : ''"
            @click="emitPaddingPreset('stealth')"
          >
            高隐蔽
          </el-button>
          <el-button
            size="small"
            :type="paddingPreset === 'normal' ? 'primary' : ''"
            @click="emitPaddingPreset('normal')"
          >
            常规
          </el-button>
          <el-button
            size="small"
            :type="paddingPreset === 'light' ? 'primary' : ''"
            @click="emitPaddingPreset('light')"
          >
            轻量
          </el-button>
        </div>
        <el-row :gutter="20">
          <el-col :span="24">
            <el-form-item label="长度分布">
              <el-select
                v-model="paddingForm.lengthDistribution"
                placeholder="请选择分布策略"
                style="width: 100%"
                @change="paddingPreset = ''"
              >
                <el-option
                  label="均匀分布"
                  value="UNIFORM"
                />
                <el-option
                  label="高斯分布(推荐)"
                  value="GAUSSIAN"
                />
                <el-option
                  label="指数分布"
                  value="EXPONENTIAL"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="填充范围(字节)">
              <div style="display: flex; gap: 8px; align-items: center">
                <el-input-number
                  v-model="paddingForm.minBytes"
                  :min="0"
                  :max="paddingForm.maxBytes"
                  :controls="false"
                  style="flex: 1"
                  placeholder="最小"
                  @change="paddingPreset = ''"
                />
                <span style="color: var(--el-text-color-secondary)">~</span>
                <el-input-number
                  v-model="paddingForm.maxBytes"
                  :min="paddingForm.minBytes"
                  :max="4096"
                  :controls="false"
                  style="flex: 1"
                  placeholder="最大"
                  @change="paddingPreset = ''"
                />
              </div>
            </el-form-item>
          </el-col>
        </el-row>
        <div class="form-tip">
          <span>每次请求追加随机长度填充，使 body
            大小不固定，对抗流量指纹分析。编码格式设为"自动检测"时会根据伪装输出自动选择二进制或文本兼容格式</span>
        </div>
      </div>
    </div>

    <div
      class="strategy-card"
      :class="{ active: headerNoiseEnabled }"
    >
      <div
        class="strategy-card-header"
        @click="headerNoiseEnabled = !headerNoiseEnabled"
      >
        <div class="strategy-card-icon">
          <el-icon><Icon icon="mdi:signal-variant" /></el-icon>
        </div>
        <div class="strategy-card-body">
          <div class="strategy-card-title">
            Header 噪声
          </div>
        </div>
        <div
          class="strategy-card-switch"
          @click.stop
        >
          <el-switch
            v-model="headerNoiseEnabled"
            inline-prompt
          />
        </div>
      </div>
      <div
        v-if="headerNoiseEnabled"
        class="strategy-card-detail"
      >
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="值生成模式">
              <el-select
                v-model="headerNoiseForm.valueMode"
                placeholder="请选择值模式"
                style="width: 100%"
              >
                <el-option
                  label="随机字母数字"
                  value="RANDOM_ALPHANUM"
                />
                <el-option
                  label="模拟 UUID"
                  value="UUID_LIKE"
                />
                <el-option
                  label="模拟时间戳"
                  value="NUMERIC"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="注入数量">
              <div style="display: flex; gap: 8px; align-items: center">
                <el-input-number
                  v-model="headerNoiseForm.minHeaders"
                  :min="0"
                  :max="headerNoiseForm.maxHeaders"
                  style="flex: 1"
                  placeholder="最少"
                />
                <span style="color: var(--el-text-color-secondary)">~</span>
                <el-input-number
                  v-model="headerNoiseForm.maxHeaders"
                  :min="headerNoiseForm.minHeaders"
                  :max="15"
                  style="flex: 1"
                  placeholder="最多"
                />
              </div>
            </el-form-item>
          </el-col>
        </el-row>
        <div class="form-tip">
          <span>每次请求随机附加 X-Request-Id、X-Trace-Id 等无意义 Header</span>
        </div>
      </div>
    </div>

    <div
      class="strategy-card"
      :class="{ active: tlsFingerprintEnabled }"
    >
      <div
        class="strategy-card-header"
        @click="tlsFingerprintEnabled = !tlsFingerprintEnabled"
      >
        <div class="strategy-card-icon">
          <el-icon><Icon icon="mdi:fingerprint" /></el-icon>
        </div>
        <div class="strategy-card-body">
          <div class="strategy-card-title">
            TLS 指纹
          </div>
        </div>
        <div
          class="strategy-card-switch"
          @click.stop
        >
          <el-switch
            v-model="tlsFingerprintEnabled"
            inline-prompt
          />
        </div>
      </div>
      <div
        v-if="tlsFingerprintEnabled"
        class="strategy-card-detail"
      >
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="浏览器指纹">
              <el-select
                v-model="tlsFingerprintForm.profile"
                placeholder="请选择浏览器指纹"
                style="width: 100%"
              >
                <el-option
                  label="Chrome (现代)"
                  value="CHROME_MODERN"
                />
                <el-option
                  label="Firefox (现代)"
                  value="FIREFOX_MODERN"
                />
                <el-option
                  label="Safari (现代)"
                  value="SAFARI_MODERN"
                />
                <el-option
                  label="Edge (现代)"
                  value="EDGE_MODERN"
                />
                <el-option
                  label="随机（创建时选定）"
                  value="RANDOM"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="每次连接轮换">
              <el-switch
                v-model="tlsFingerprintForm.rotate"
                active-text="启用"
                inactive-text="禁用"
                inline-prompt
              />
            </el-form-item>
          </el-col>
        </el-row>
        <div class="form-tip">
          <span>自定义 TLS ClientHello 中的 Cipher Suites，模拟真实浏览器指纹；可按连接轮换配置。</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  probing: { type: Boolean, default: false }
})
const emit = defineEmits(['probe', 'apply-padding-preset'])

const urlStrategyEnabled = defineModel('urlStrategyEnabled', { type: Boolean, default: false })
const urlStrategyForm = defineModel('urlStrategyForm', { type: Object, required: true })
const paddingEnabled = defineModel('paddingEnabled', { type: Boolean, default: false })
const paddingPreset = defineModel('paddingPreset', { type: String, default: '' })
const paddingForm = defineModel('paddingForm', { type: Object, required: true })
const headerNoiseEnabled = defineModel('headerNoiseEnabled', { type: Boolean, default: false })
const headerNoiseForm = defineModel('headerNoiseForm', { type: Object, required: true })
const tlsFingerprintEnabled = defineModel('tlsFingerprintEnabled', {
  type: Boolean,
  default: false
})
const tlsFingerprintForm = defineModel('tlsFingerprintForm', { type: Object, required: true })

const emitProbe = () => {
  if (!props.probing) emit('probe')
}
const emitPaddingPreset = (preset) => emit('apply-padding-preset', preset)
</script>

<style scoped>
@import '@/styles/puppet-strategy-fields.css';
</style>
