export function useHostSelection(dialogRef, projectId) {
  const open = (row, mode = 'live') => {
    if (!row?.puppetId) return Promise.resolve(null)
    return dialogRef.value?.open({
      ...row,
      puppetId: row.puppetId,
      sessionId: '',
      projectId: projectId.value,
      puppetName: row.puppetName,
      ...(mode === 'cache' ? { mode: 'cache' } : {})
    }) || Promise.resolve(null)
  }

  return {
    open
  }
}
