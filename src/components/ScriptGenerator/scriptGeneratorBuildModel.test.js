import { describe, expect, it } from 'vitest'
import {
  BUILD_CHANNEL,
  createBuildRequest,
  createScriptGeneratorForm,
  isBuildSnapshotStale,
  snapshotBuildForm
} from './scriptGeneratorBuildModel.js'

describe('script generator build model', () => {
  it('builds PHP runtime requests with optional header guards', () => {
    const form = { ...createScriptGeneratorForm(), runtime: 'php', shellType: 'PHP', phpOutputMode: 'packed' }
    form.reqDisguiseId = 'req'
    form.respDisguiseId = 'resp'
    form.headerName = ' X-Key '
    form.headerValue = ' token '

    const request = createBuildRequest(form)
    expect(request.channel).toBe(BUILD_CHANNEL.RUNTIME)
    expect(request.resultKey).toBe('content')
    expect(request.params).toMatchObject({
      runtime: 'php', artifactType: 'webshell', outputMode: 'packed',
      headerName: 'X-Key', headerValue: 'token'
    })
  })

  it('builds Java web and memory requests through separate adapters', () => {
    const web = createScriptGeneratorForm()
    web.reqDisguiseId = 'req'
    web.respDisguiseId = 'resp'
    web.jspObfuscationSteps = ['STEP_A']
    expect(createBuildRequest(web)).toMatchObject({
      channel: BUILD_CHANNEL.WEB,
      resultKey: 'shell',
      params: { protocol: 'http', jspObfuscationSteps: ['STEP_A'] }
    })

    const memory = {
      ...web,
      generateType: 'memoryshell',
      serverType: 'tomcat',
      serverVersion: '7',
      shellType: 'listener',
      packerType: 'JspPacker',
      headerName: 'X-Key',
      headerValue: 'token',
      lambdaSuffix: true,
      staticInitialize: true,
      shrink: false
    }
    const request = createBuildRequest(memory, { isJspGroupPacker: () => true })
    expect(request.channel).toBe(BUILD_CHANNEL.MEMORY)
    expect(request.resultKey).toBe('code')
    expect(request.params.jspObfuscationSteps).toEqual(['STEP_A'])
    expect(request.params).toMatchObject({
      serverVersion: '7',
      lambdaSuffix: true,
      staticInitialize: true,
      shrink: false
    })
  })

  it('tracks build-relevant form changes without serializing reactive state', () => {
    const form = createScriptGeneratorForm()
    const snapshot = snapshotBuildForm(form)
    expect(isBuildSnapshotStale(form, snapshot)).toBe(false)
    form.phpOutputMode = 'portable'
    expect(isBuildSnapshotStale(form, snapshot)).toBe(true)
  })

  it('tracks advanced injector build flags in snapshots', () => {
    const form = createScriptGeneratorForm()
    expect(form.shrink).toBe(true)
    const snapshot = snapshotBuildForm(form)
    form.lambdaSuffix = true
    expect(isBuildSnapshotStale(form, snapshot)).toBe(true)
  })
})
