import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick, ref } from 'vue'
import { compileClientComponent, findNode } from '@/test-support/vueComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { resolveAuthNavigation } from '@/routerGuards.js'
import { ROUTE_PATHS } from '@/constants/app.js'

describe('startup status check', () => {
  const apps = []
  afterEach(() => { for (const app of apps.splice(0)) app.unmount() })

  const mount = () => {
    const auth = {
      currentUser: ref(null), authLoading: ref(false), authFetched: ref(false),
      authCheckState: ref('error'), authError: ref('服务正在准备'), initializationRequired: ref(false)
    }
    const fetchAuth = vi.fn().mockResolvedValue(null)
    const replace = vi.fn().mockResolvedValue(undefined)
    const View = compileClientComponent(new URL('./StartupCheckView.vue', import.meta.url), {
      'vue-router': { useRoute: () => ({ path: ROUTE_PATHS.startup }), useRouter: () => ({ replace }) },
      '@/composables/useAuth.js': { useAuth: () => ({ ...auth, fetchAuth }) },
      '@/routerGuards.js': { resolveAuthNavigation }
    })
    const renderer = createTestRenderer()
    const app = renderer.createApp(View)
    app.component('ElButton', { render() { return h('button', this.$attrs, this.$slots.default?.()) } })
    app.mount(renderer.root)
    apps.push(app)
    return { auth, fetchAuth, replace, renderer, retry: () => findNode(renderer.root, 'button').props.onClick() }
  }

  it('leaves failed checks retryable without navigating to login', async () => {
    const view = mount()
    await view.retry()
    expect(view.fetchAuth).toHaveBeenCalledWith({ force: true })
    expect(view.replace).not.toHaveBeenCalled()
  })

  it.each([true, false])('continues after retry when initializationRequired=%s', async required => {
    const view = mount()
    view.fetchAuth.mockImplementation(async () => {
      view.auth.authFetched.value = true
      view.auth.initializationRequired.value = required
      view.auth.authCheckState.value = required ? 'required' : 'ready'
    })
    await view.retry()
    expect(view.replace).toHaveBeenCalledWith({ path: required ? ROUTE_PATHS.setup : ROUTE_PATHS.login })
  })

  it('does not start another check while one is pending', async () => {
    const view = mount()
    view.auth.authLoading.value = true
    await nextTick()
    await view.retry()
    expect(view.fetchAuth).not.toHaveBeenCalled()
  })
})
