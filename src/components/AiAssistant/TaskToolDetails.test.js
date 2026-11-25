import { expect, it, vi } from 'vitest'
import { h, nextTick, shallowRef } from 'vue'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { compileClientComponent, createSlotStub, findNode } from '@/test-support/vueComponent.js'
import { deferred } from '@/test-support/deferred.js'
import { createLatestRequestGuard } from '@/utils/latestRequestGuard.js'
import * as taskNodeModel from './taskNodeModel.js'

it('cancels the old attachment download when the task result changes', async () => {
  const older = deferred()
  const newer = deferred()
  const downloadTaskOutputApi = vi.fn().mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
  const downloadBlob = vi.fn()
  const Details = compileClientComponent(new URL('./TaskToolDetails.vue', import.meta.url), {
    '@iconify/vue': { Icon: createSlotStub('Icon') },
    '@/services/api/shell-generator.js': { getShellResultApi: vi.fn() },
    '@/services/api/task-output.js': { downloadTaskOutputApi },
    '@/utils/downloadBlob.js': { downloadBlob },
    '@/utils/latestRequestGuard.js': { createLatestRequestGuard },
    './taskNodeModel.js': taskNodeModel
  })
  const result = name => ({ result: JSON.stringify({ userWorkspacePath: `ai-tasks/job/files/${name}` }) })
  const node = shallowRef(result('old.txt'))
  const renderer = createTestRenderer()
  const app = renderer.createApp({ render: () => h(Details, { node: node.value }) })
  app.mount(renderer.root)
  const button = () => findNode(renderer.root, 'button').props

  try {
    const first = button().onClick()
    const { signal } = downloadTaskOutputApi.mock.lastCall[1]
    node.value = result('new.txt')
    await nextTick()
    expect(signal.aborted).toBe(true)
    const second = button().onClick()

    older.resolve({ data: new Blob(['old']) })
    await first
    await nextTick()
    expect(downloadBlob).not.toHaveBeenCalled()
    expect(button().disabled).toBe(true)

    const file = new Blob(['new'])
    newer.resolve({ data: file })
    await second
    await nextTick()
    expect(downloadBlob).toHaveBeenCalledExactlyOnceWith(file, 'new.txt')
    expect(button().disabled).toBe(false)
  } finally {
    app.unmount()
  }
})
