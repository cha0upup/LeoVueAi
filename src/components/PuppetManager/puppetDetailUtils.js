import { icons } from '@/utils/icons.js'

export const isChildHost = (row) => row?.parentPuppetId && row.parentPuppetId !== 'root'

export const getHostIcon = (row) => (isChildHost(row) ? icons.connection : icons.server)

export const isPuppetQuickSaving = (puppet, quickSavingKey, field) =>
  Boolean(puppet?.puppetId && quickSavingKey === `${puppet.puppetId}:${field}`)
