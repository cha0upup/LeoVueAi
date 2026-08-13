import editorWorkerUrl from 'monaco-editor/esm/vs/editor/editor.worker?worker&url'
import jsonWorkerUrl from 'monaco-editor/esm/vs/language/json/json.worker?worker&url'
import cssWorkerUrl from 'monaco-editor/esm/vs/language/css/css.worker?worker&url'
import htmlWorkerUrl from 'monaco-editor/esm/vs/language/html/html.worker?worker&url'
import tsWorkerUrl from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker&url'

let configured = false

const workerUrlByLabel = {
  json: jsonWorkerUrl,
  css: cssWorkerUrl,
  scss: cssWorkerUrl,
  less: cssWorkerUrl,
  html: htmlWorkerUrl,
  handlebars: htmlWorkerUrl,
  razor: htmlWorkerUrl,
  typescript: tsWorkerUrl,
  javascript: tsWorkerUrl
}

export function setupMonacoEnvironment() {
  if (configured) {
    return
  }

  globalThis.MonacoEnvironment = {
    getWorker(_, label) {
      return new globalThis.Worker(workerUrlByLabel[label] || editorWorkerUrl, {
        name: `monaco-${label || 'editor'}`,
        type: 'module'
      })
    }
  }

  configured = true
}
