export function createMonacoEditorOptions(config = {}) {
  const {
    value = '',
    language = 'plaintext',
    theme = 'vs',
    readOnly = false,
    automaticLayout = true,
    scrollBeyondLastLine = false,
    minimapEnabled = false,
    fontSize = 14,
    lineNumbers = 'on',
    wordWrap = 'off',
    ...overrides
  } = config

  return {
    value,
    language,
    theme,
    readOnly,
    automaticLayout,
    scrollBeyondLastLine,
    minimap: {
      enabled: minimapEnabled
    },
    fontSize,
    lineNumbers,
    wordWrap,
    ...overrides
  }
}
