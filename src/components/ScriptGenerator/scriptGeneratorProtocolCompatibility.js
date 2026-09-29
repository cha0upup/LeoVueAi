export const normalizeTransportProtocol = protocol => String(protocol || 'http').trim().toLowerCase()

const DEFAULT_MEMORY_SELECTION = Object.freeze({
  serverType: 'Tomcat',
  shellType: 'FilterInjector',
  packerType: 'DefaultBase64'
})

export const isPackerProtocolCompatible = (metadata, protocol) =>
  metadata.supportedProtocols.some(supported =>
    normalizeTransportProtocol(supported) === normalizeTransportProtocol(protocol))

export const filterPackerTypesStructure = (packerTypes, packerCompatibility, protocol) => {
  const isCompatible = packer => isPackerProtocolCompatible(packerCompatibility[packer], protocol)
  const groups = packerTypes.groups
    .map(group => ({
      ...group,
      packers: group.packers.filter(isCompatible)
    }))
    .filter(group => group.packers.length)
  const ungrouped = packerTypes.ungrouped.filter(isCompatible)
  const flat = [...groups.flatMap(group => group.packers), ...ungrouped]

  return { groups, ungrouped, flat }
}

export const reconcileMemoryProtocolSelection = ({
  form,
  serverInjectorTypes,
  compatiblePackerNames
}) => {
  const serverTypes = Object.keys(serverInjectorTypes || {})
  if (!form.serverType && serverTypes.includes(DEFAULT_MEMORY_SELECTION.serverType)) {
    form.serverType = DEFAULT_MEMORY_SELECTION.serverType
  }
  if (form.serverType && !serverTypes.includes(form.serverType)) {
    form.serverType = serverTypes[0] || ''
  }

  const injectorNames = form.serverType
    ? serverInjectorTypes?.[form.serverType] || []
    : []
  if (form.shellType && !injectorNames.includes(form.shellType)) {
    form.shellType = ''
  }
  if (!form.shellType && form.serverType) {
    form.shellType = injectorNames.includes(DEFAULT_MEMORY_SELECTION.shellType)
      ? DEFAULT_MEMORY_SELECTION.shellType
      : injectorNames.length === 1
        ? injectorNames[0]
        : ''
  }

  if (form.packerType && !compatiblePackerNames.includes(form.packerType)) {
    form.packerType = ''
  }
  if (!form.packerType && compatiblePackerNames.includes(DEFAULT_MEMORY_SELECTION.packerType)) {
    form.packerType = DEFAULT_MEMORY_SELECTION.packerType
  }
}
