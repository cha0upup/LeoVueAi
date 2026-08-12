<template>
  <div class="request-list-wrap">
    <div
      v-for="(request, index) in model"
      :key="index"
      class="request-item"
    >
      <div class="request-item-header">
        <span class="request-item-title">请求 {{ index + 1 }}</span>
        <el-button
          type="danger"
          link
          size="small"
          @click="model.splice(index, 1)"
        >
          删除
        </el-button>
      </div>
      <div class="request-item-body">
        <template v-if="protocol === 'http'">
          <el-form-item
            label="方法"
            class="inline-item"
          >
            <el-select
              v-model="request.method"
              placeholder="方法"
              size="small"
              style="width: 110px"
            >
              <el-option
                v-for="method in httpMethods"
                :key="method"
                :label="method"
                :value="method"
              />
            </el-select>
          </el-form-item>
          <el-form-item
            label="路径"
            class="inline-item"
          >
            <el-input
              v-model="request.path"
              placeholder="/path 或 uri"
              size="small"
              clearable
            />
          </el-form-item>
          <el-form-item
            label="超时(ms)"
            class="inline-item"
          >
            <el-input-number
              v-model="request.timeout"
              :min="0"
              :max="60000"
              size="small"
              style="width: 120px"
            />
          </el-form-item>
          <div class="headers-row">
            <span class="headers-label">Headers</span>
            <div class="headers-list">
              <div
                v-for="(header, headerIndex) in request.headers"
                :key="headerIndex"
                class="header-row"
              >
                <el-input
                  v-model="header.key"
                  placeholder="Header 名"
                  size="small"
                  clearable
                  class="header-key"
                />
                <el-input
                  v-model="header.value"
                  placeholder="值"
                  size="small"
                  clearable
                  class="header-value"
                />
                <el-button
                  type="danger"
                  link
                  size="small"
                  @click="request.headers.splice(headerIndex, 1)"
                >
                  删
                </el-button>
              </div>
              <el-button
                type="primary"
                link
                size="small"
                @click="request.headers.push({ key: '', value: '' })"
              >
                + 添加 Header
              </el-button>
            </div>
          </div>
          <el-form-item
            v-if="!['GET', 'HEAD'].includes(request.method)"
            label="Body"
            class="full-width"
          >
            <el-input
              v-model="request.body"
              type="textarea"
              :rows="2"
              placeholder="POST 请求体"
              size="small"
              clearable
            />
          </el-form-item>
        </template>
        <template v-else>
          <el-form-item
            label="发送内容"
            class="full-width"
          >
            <el-input
              v-model="request.body"
              type="textarea"
              :rows="2"
              placeholder="如：stats\r\n"
              size="small"
              clearable
            />
          </el-form-item>
          <el-form-item
            label="超时(ms)"
            class="inline-item"
          >
            <el-input-number
              v-model="request.timeout"
              :min="0"
              :max="60000"
              size="small"
              style="width: 120px"
            />
          </el-form-item>
        </template>
      </div>
    </div>
    <el-button
      type="primary"
      plain
      size="small"
      @click="model.push(createEmptyRequest(protocol))"
    >
      + 添加请求
    </el-button>
  </div>
</template>

<script setup>
import { createEmptyRequest } from './saveFingerprintModel.js'

defineProps({ protocol: { type: String, default: 'http' } })
const model = defineModel({ type: Array, required: true })
const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
</script>

<style scoped>
.request-list-wrap { width: 100%; }
.request-item {
  margin-bottom: 10px;
  overflow: hidden;
  border: 1px solid var(--fp-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--app-control-background) 94%, transparent);
}
.request-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-bottom: 1px solid var(--fp-border);
  background: color-mix(in srgb, var(--app-control-background-soft) 82%, transparent);
}
.request-item-title { color: var(--el-text-color-primary); font-size: 13px; font-weight: 600; }
.request-item-body { padding: 10px; }
.request-item-body :deep(.el-form-item) { margin-bottom: var(--el-spacing-small); }
.request-item-body :deep(.inline-item) { display: inline-block; margin-right: var(--el-spacing-base); vertical-align: top; }
.request-item-body :deep(.inline-item .el-form-item__content) { display: inline-block; }
.full-width { width: 100%; }
.headers-row { margin: var(--el-spacing-small) 0; }
.headers-label { display: block; margin-bottom: 4px; color: var(--el-text-color-secondary); font-size: 12px; }
.headers-list { display: flex; flex-direction: column; gap: 4px; }
.header-row { display: flex; align-items: center; gap: var(--el-spacing-small); }
.header-key { width: 160px; flex-shrink: 0; }
.header-value { flex: 1; min-width: 0; }
</style>
