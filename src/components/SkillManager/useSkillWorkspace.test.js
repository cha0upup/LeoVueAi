import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, isReadonly, ref } from 'vue'
import { deferred } from '@/test-support/deferred.js'

const api = vi.hoisted(() => ({ list: vi.fn(), file: vi.fn(), confirm: vi.fn(), error: vi.fn() }))
vi.mock('@/services/api/skills.js', () => ({ listSkillFilesApi: api.list, getSkillFileApi: api.file }))
vi.mock('@/utils/confirmUtils.js', () => ({ confirmAction: api.confirm }))
vi.mock('@/utils/messageUtils.js', () => ({ showError: api.error }))
import { useSkillWorkspace } from './useSkillWorkspace.js'

const fixtures = []
function mount() {
  const scope = effectScope()
  const activeScope = ref('agent-node')
  const uiState = ref({ lastFilePath: '', treePanelWidth: 240 })
  const onMetadataChanged = vi.fn()
  const workspace = scope.run(() => useSkillWorkspace({ activeScope, uiState, onMetadataChanged }))
  fixtures.push(scope)
  return { ...workspace, activeScope, uiState, onMetadataChanged, dispose: () => scope.stop() }
}
beforeEach(() => {
  vi.resetAllMocks()
  api.list.mockResolvedValue({ data: [{ path: 'SKILL.md' }, { path: 'manifest.yaml' }] })
  api.file.mockResolvedValue({ data: { content: 'fixture', encoding: 'text', size: 7 } })
  api.confirm.mockResolvedValue(true)
})
afterEach(() => { for (const scope of fixtures.splice(0)) scope.stop() })

describe('Skill file workspace', () => {
  it('derives its read-only selection name from the current Skill instead of storing a second mutable identity', async () => {
    const view = mount()
    expect(isReadonly(view.selectedSkillName)).toBe(true)
    await view.openSkill({ name: 'alpha' })
    view.selectedSkill.value = { name: 'alpha', description: 'refreshed' }
    expect(view.selectedSkillName.value).toBe('alpha')
    view.clearWorkspace()
    expect(view.selectedSkill.value).toBeNull()
    expect(view.selectedSkillName.value).toBe('')
  })

  it('opens SKILL.md by default with scoped API arguments and persists the selected path', async () => {
    const view = mount()
    expect(await view.openSkill({ name: 'alpha' })).toBe(true)
    expect(api.list).toHaveBeenCalledWith('agent-node', 'alpha')
    expect(api.file).toHaveBeenCalledWith('agent-node', 'alpha', 'SKILL.md')
    expect(view.currentFileContent.value).toBe('fixture')
    expect(view.currentFileEncoding.value).toBe('text')
    expect(view.currentFileSize.value).toBe(7)
    expect(view.uiState.value).toEqual({ lastFilePath: 'SKILL.md', treePanelWidth: 240 })
    expect(view.filesLoading.value || view.fileLoading.value).toBe(false)
  })

  it('remembers a file only when reopening the same skill', async () => {
    const view = mount()
    await view.openSkill({ name: 'alpha' })
    await view.openFile('manifest.yaml')
    await view.openSkill({ name: 'alpha' })
    expect(api.file).toHaveBeenLastCalledWith('agent-node', 'alpha', 'manifest.yaml')
    await view.openSkill({ name: 'beta' })
    expect(api.file).toHaveBeenLastCalledWith('agent-node', 'beta', 'SKILL.md')
  })

  it('falls back to the first file and accepts an empty workspace', async () => {
    const view = mount()
    api.list.mockResolvedValueOnce({ data: [{ path: 'README.txt' }] })
    await view.openSkill({ name: 'alpha' })
    expect(view.currentFilePath.value).toBe('README.txt')
    api.list.mockResolvedValueOnce({ data: null })
    expect(await view.openSkill({ name: 'empty' })).toBe(true)
    expect(view.skillFiles.value).toEqual([])
    expect(view.currentFilePath.value).toBe('')
    expect(view.currentFileSize.value).toBe(0)
  })

  it('never lets a previous skill list reopen a file in the newly selected skill', async () => {
    const old = deferred()
    api.list.mockReturnValueOnce(old.promise)
    const view = mount()
    const opening = view.openSkill({ name: 'alpha' })
    await view.openSkill({ name: 'beta' })
    old.resolve({ data: [{ path: 'old.txt' }] })
    expect(await opening).toBe(false)
    expect(view.selectedSkillName.value).toBe('beta')
    expect(view.currentFilePath.value).toBe('SKILL.md')
    expect(api.file).toHaveBeenCalledTimes(1)
  })

  it('uses the latest file intent without letting older responses clear its spinner', async () => {
    const view = mount()
    await view.openSkill({ name: 'alpha' })
    const old = deferred(), latest = deferred()
    api.file.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise)
    const first = view.openFile('old.txt'), second = view.openFile('new.txt')
    old.resolve({ data: { content: 'old' } })
    await first
    expect(view.fileLoading.value).toBe(true)
    expect(view.currentFilePath.value).toBe('SKILL.md')
    latest.resolve({ data: { content: 'new', encoding: 'base64', size: 10 } })
    await second
    expect(view.currentFilePath.value).toBe('new.txt')
    expect(view.currentFileEncoding.value).toBe('base64')
    expect(view.fileLoading.value).toBe(false)
  })

  it('ignores stale failures and preserves the latest file and remembered path', async () => {
    const view = mount()
    await view.openSkill({ name: 'alpha' })
    const old = deferred()
    api.file.mockReturnValueOnce(old.promise)
    const first = view.openFile('old.txt')
    await view.openFile('new.txt')
    old.reject(new Error('old failure'))
    await first
    expect(api.error).not.toHaveBeenCalled()
    expect(view.currentFilePath.value).toBe('new.txt')
    expect(view.uiState.value.lastFilePath).toBe('new.txt')
  })

  it('fences an A-to-B-to-A scope switch even for identically named skills', async () => {
    const view = mount()
    await view.openSkill({ name: 'alpha' })
    const old = deferred()
    api.file.mockReturnValueOnce(old.promise)
    const first = view.openFile('old.txt')
    view.activeScope.value = 'platform'
    expect(view.selectedSkill.value).toBeNull()
    view.activeScope.value = 'agent-node'
    await view.openSkill({ name: 'alpha' })
    old.resolve({ data: { content: 'stale' } })
    await first
    expect(view.currentFileContent.value).toBe('fixture')
  })

  it('rejects a delayed discard confirmation after the workspace has changed', async () => {
    const view = mount()
    await view.openSkill({ name: 'alpha' })
    const confirmation = deferred()
    view.fileEditorRef.value = { hasUnsavedChanges: () => true }
    api.confirm.mockReturnValueOnce(confirmation.promise)
    const switching = view.openFile('manifest.yaml')
    view.clearWorkspace()
    confirmation.resolve(true)
    expect(await switching).toBe(false)
    expect(api.file).toHaveBeenCalledTimes(1)
  })

  it('keeps dirty edits when a discard is declined and deduplicates dirty paths', async () => {
    const view = mount()
    await view.openSkill({ name: 'alpha' })
    view.onDirtyChange(true); view.onDirtyChange(true)
    expect(view.dirtyFilePaths.value).toEqual(['SKILL.md'])
    api.confirm.mockResolvedValue(false)
    expect(await view.confirmLeaveEdit()).toBe(false)
    view.fileEditorRef.value = { hasUnsavedChanges: () => true }
    expect(await view.openFile('manifest.yaml')).toBe(false)
    expect(view.currentFilePath.value).toBe('SKILL.md')
    view.onDirtyChange(false)
    expect(await view.confirmLeaveEdit()).toBe(true)
  })

  it('reloads written files forcibly and refreshes metadata only for manifest files', async () => {
    const view = mount()
    await view.openSkill({ name: 'alpha' })
    view.onDirtyChange(true)
    await view.onFileSaved({ path: 'SKILL.md' })
    expect(view.dirtyFilePaths.value).toEqual([])
    expect(view.onMetadataChanged).toHaveBeenCalledTimes(1)
    await view.onFileSaved({ path: 'readme.txt' })
    expect(view.onMetadataChanged).toHaveBeenCalledTimes(1)
    await view.onOpenAfterWrite('SKILL.md')
    expect(api.file).toHaveBeenCalledTimes(2)
  })

  it('clears removed files and resets encoding/size without accepting an in-flight file read', async () => {
    const view = mount()
    await view.openSkill({ name: 'alpha' })
    const pending = deferred()
    api.file.mockReturnValueOnce(pending.promise)
    const opening = view.openFile('removed.txt')
    api.list.mockResolvedValueOnce({ data: [] })
    await view.reloadFiles()
    pending.resolve({ data: { content: 'removed' } })
    await opening
    expect(view.currentFilePath.value).toBe('')
    expect(view.currentFileSize.value).toBe(0)
  })

  it('shows current failures and remains usable for a retry', async () => {
    const view = mount()
    api.list.mockRejectedValueOnce(new Error('failed'))
    expect(await view.openSkill({ name: 'alpha' })).toBe(true)
    expect(view.filesLoading.value).toBe(false)
    expect(api.error).toHaveBeenCalledWith('加载文件列表失败')
    await view.openSkill({ name: 'alpha' })
    api.file.mockRejectedValueOnce({ response: { data: { msg: 'fixture error' } } })
    expect(await view.openFile('missing')).toBe(false)
    expect(api.error).toHaveBeenLastCalledWith('fixture error')
    expect(view.fileLoading.value).toBe(false)
  })

  it('disposes outstanding reads without errors, UI updates or later API calls', async () => {
    const view = mount()
    await view.openSkill({ name: 'alpha' })
    const pending = deferred()
    api.file.mockReturnValueOnce(pending.promise)
    const opening = view.openFile('late.txt')
    view.dispose()
    pending.reject(new Error('late failure'))
    await opening
    await view.openFile('after.txt')
    expect(api.error).not.toHaveBeenCalled()
    expect(view.currentFilePath.value).toBe('')
    expect(view.fileLoading.value).toBe(false)
    expect(api.file).toHaveBeenCalledTimes(2)
  })
})
