export function useHostSelection(dialogRef, projectId) {
  const open = (row, mode = 'live') => {
    if (!row?.agentId) return Promise.resolve(null)
    return dialogRef.value?.open({
      ...row,
      agentId: row.agentId,
      sessionId: '',
      projectId: projectId.value,
      agentName: row.agentName,
      ...(mode === 'cache' ? { mode: 'cache' } : {})
    }) || Promise.resolve(null)
  }

  return {
    open
  }
}
