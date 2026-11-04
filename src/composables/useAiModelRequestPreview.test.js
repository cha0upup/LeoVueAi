import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, reactive, ref } from 'vue'
import { deferred } from '@/test-support/deferred.js'

const { request } = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('@/services/api/admin.js', () => ({ previewAiModelRequestApi: request }))
import { useAiModelRequestPreview } from './useAiModelRequestPreview.js'

const scopes = []
const result = model => ({ valid: true, model, contract: {}, requestParameters: { model }, parameters: [], errors: [] })

function fixture(overrides = {}) {
  const scope = effectScope()
  scopes.push(scope)
  const visible = ref(false)
  const form = reactive({ providerId: 1, model: 'deepseek-flash', thinkingEnabled: null,
    reasoningEffort: 'auto', temperature: null, maxOutputTokens: null, contextWindowTokens: null, ...overrides })
  return { scope, visible, form, ...scope.run(() => useAiModelRequestPreview({ visible, form })) }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.resetAllMocks()
  request.mockImplementation(async body => ({ data: result(body.model) }))
})
afterEach(() => {
  scopes.splice(0).forEach(scope => scope.stop())
  vi.useRealTimers()
})

describe('local model request preview lifecycle', () => {
  it('waits for a visible complete draft and debounces edits into one credential-free request', async () => {
    const state = fixture({ apiKey: 'private-key', headersJson: 'private-headers', baseUrl: 'https://private.test' })
    await vi.advanceTimersByTimeAsync(300)
    expect(request).not.toHaveBeenCalled()
    state.visible.value = true
    state.form.temperature = 0.5
    state.form.maxOutputTokens = 8192
    await vi.advanceTimersByTimeAsync(249)
    expect(request).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(request).toHaveBeenCalledExactlyOnceWith({
      providerId: 1, model: 'deepseek-flash', thinkingEnabled: null, reasoningEffort: 'auto',
      temperature: 0.5, maxOutputTokens: 8192, contextWindowTokens: null
    }, { signal: expect.any(globalThis.AbortSignal) })
    expect(state.preview.value.model).toBe('deepseek-flash')
    expect(state.loading.value).toBe(false)
  })

  it('ignores a late response after the model changes even if the transport completes after abort', async () => {
    const old = deferred()
    request.mockReturnValueOnce(old.promise)
    const state = fixture()
    state.visible.value = true
    await vi.advanceTimersByTimeAsync(250)
    expect(request).toHaveBeenCalledOnce()
    const oldSignal = request.mock.calls[0][1].signal
    state.form.model = 'kimi-k3.1-pro'
    expect(state.preview.value).toBeNull()
    expect(oldSignal.aborted).toBe(true)
    await vi.advanceTimersByTimeAsync(250)
    expect(state.preview.value.model).toBe('kimi-k3.1-pro')
    old.resolve({ data: result('old-model') })
    await old.promise
    await Promise.resolve()
    expect(state.preview.value.model).toBe('kimi-k3.1-pro')
  })

  it.each(['close', 'unmount'])('cancels pending work on %s and drops its late result', async action => {
    const pending = deferred()
    request.mockReturnValueOnce(pending.promise)
    const state = fixture()
    state.visible.value = true
    await vi.advanceTimersByTimeAsync(250)
    expect(request).toHaveBeenCalledOnce()
    const signal = request.mock.calls[0][1].signal
    if (action === 'close') state.visible.value = false
    else state.scope.stop()
    expect(signal.aborted).toBe(true)
    pending.resolve({ data: result('stale') })
    await pending.promise
    await Promise.resolve()
    expect(state.preview.value).toBeNull()
    expect(state.loading.value).toBe(false)
    expect(state.error.value).toBe('')
    await expect(state.refresh(true)).resolves.toBeNull()
    expect(request).toHaveBeenCalledOnce()
  })

  it('evaluates immediately on save without leaving a duplicate debounce request', async () => {
    const state = fixture()
    state.visible.value = true
    const preview = await state.refresh()
    expect(preview.valid).toBe(true)
    await vi.advanceTimersByTimeAsync(500)
    expect(request).toHaveBeenCalledOnce()
    expect(await state.refresh()).toBe(preview)
  })

  it('retains field-level validation errors and handles transport errors without rejected UI promises', async () => {
    const state = fixture()
    state.visible.value = true
    const invalid = { valid: false, errors: [{ field: 'temperature', message: '采样值超出范围' }], contract: {} }
    request.mockResolvedValueOnce({ data: invalid })
    expect(await state.refresh()).toBe(invalid)
    expect(state.preview.value.errors).toEqual(invalid.errors)
    request.mockRejectedValueOnce(new Error('请求暂时失败'))
    await expect(state.refresh(true)).resolves.toBeNull()
    expect(state.preview.value).toBeNull()
    expect(state.error.value).toBe('请求暂时失败')
    expect(state.loading.value).toBe(false)
  })
})
