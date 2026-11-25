import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick, reactive, ref } from 'vue'
import { compileClientComponent, findNode } from '@/test-support/vueComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { resolveAuthNavigation } from '@/routerGuards.js'
import { ROUTE_PATHS } from '@/constants/app.js'
import { deferred } from '@/test-support/deferred.js'

describe('startup status check', () => {
  const apps = []
  afterEach(() => {
    for (const app of apps.splice(0)) app.unmount()
    vi.useRealTimers()
  })

  const mount = ({ delay = null, path = ROUTE_PATHS.startup, redirect } = {}) => {
    const auth = {
      currentUser: ref(null), authLoading: ref(false), authFetched: ref(false),
      authCheckState: ref('error'), authError: ref('服务正在准备'), initializationRequired: ref(false),
      startupRetryDelay: ref(delay)
    }
    const route = reactive({ path, query: { redirect } })
    const fetchAuth = vi.fn().mockResolvedValue(null)
    const replace = vi.fn().mockResolvedValue(undefined)
    const View = compileClientComponent(new URL('./StartupCheckView.vue', import.meta.url), {
      'vue-router': { useRoute: () => route, useRouter: () => ({ replace }) },
      '@/constants/app.js': { ROUTE_PATHS },
      '@/composables/useAuth.js': { useAuth: () => ({ ...auth, fetchAuth }) },
      '@/routerGuards.js': { resolveAuthNavigation }
    })
    const renderer = createTestRenderer()
    const app = renderer.createApp(View)
    app.component('ElButton', { render() { return h('button', this.$attrs, this.$slots.default?.()) } })
    app.mount(renderer.root)
    apps.push(app)
    const retry = () => findNode(renderer.root, 'button').props.onClick()
    const unmount = () => { app.unmount(); apps.splice(apps.indexOf(app), 1) }
    return { auth, route, fetchAuth, replace, retry, unmount }
  }

  it('opens setup when a retry detects a fresh installation', async () => {
    const view = mount()
    view.fetchAuth.mockImplementation(async () => {
      view.auth.authFetched.value = true
      view.auth.initializationRequired.value = true
      view.auth.authCheckState.value = 'required'
    })
    await view.retry()
    expect(view.replace).toHaveBeenCalledExactlyOnceWith({ path: ROUTE_PATHS.setup })
  })

  it('does not start another check while one is pending', async () => {
    const view = mount()
    view.auth.authLoading.value = true
    await nextTick()
    await view.retry()
    expect(view.fetchAuth).not.toHaveBeenCalled()
  })

  it('waits for the hint, retries at most three times and leaves the manual button available', async () => {
    vi.useFakeTimers()
    const view = mount({ delay: 2000 })
    await vi.advanceTimersByTimeAsync(1999)
    expect(view.fetchAuth).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(view.fetchAuth).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(18000)
    expect(view.fetchAuth).toHaveBeenCalledTimes(3)
    expect(view.replace).not.toHaveBeenCalled()
    await view.retry()
    expect(view.fetchAuth).toHaveBeenCalledTimes(4)
    expect(view.fetchAuth).toHaveBeenLastCalledWith({ force: true })
    expect(view.replace).not.toHaveBeenCalled()
  })

  it('stops polling and preserves the redirect when a manual check succeeds', async () => {
    vi.useFakeTimers()
    const redirect = '/admin?tab=statistics'
    const view = mount({ delay: 2000, redirect })
    view.fetchAuth.mockImplementation(async () => {
      view.auth.authFetched.value = true
      view.auth.authCheckState.value = 'ready'
      view.auth.startupRetryDelay.value = null
    })
    await view.retry()
    await vi.advanceTimersByTimeAsync(10000)
    expect(view.fetchAuth).toHaveBeenCalledOnce()
    expect(view.replace).toHaveBeenCalledExactlyOnceWith({ path: ROUTE_PATHS.login, query: { redirect } })
  })

  it('does not poll in the embedded loading state or after leaving the page', async () => {
    vi.useFakeTimers()
    const embedded = mount({ delay: 2000, path: ROUTE_PATHS.admin })
    const routed = mount({ delay: 2000 })
    routed.route.path = ROUTE_PATHS.login
    await vi.advanceTimersByTimeAsync(3000)
    expect(embedded.fetchAuth).not.toHaveBeenCalled()
    expect(routed.fetchAuth).not.toHaveBeenCalled()
  })

  it('does not navigate if an in-flight retry finishes after unmount', async () => {
    const view = mount()
    const completion = deferred()
    view.fetchAuth.mockReturnValue(completion.promise)
    const request = view.retry()
    view.unmount()
    view.auth.authFetched.value = true
    view.auth.authCheckState.value = 'ready'
    completion.resolve()
    await request
    expect(view.replace).not.toHaveBeenCalled()
  })
})
