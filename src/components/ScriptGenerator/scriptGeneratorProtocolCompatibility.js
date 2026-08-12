export const normalizeTransportProtocol = protocol => String(protocol || 'http').trim().toLowerCase()

const getPackerSupportedProtocols = metadata => {
  const protocols = Array.isArray(metadata?.supportedProtocols)
    ? metadata.supportedProtocols.map(normalizeTransportProtocol).filter(Boolean)
    : []
  return protocols
}

export const isPackerProtocolCompatible = (metadata, protocol) =>
  getPackerSupportedProtocols(metadata).includes(normalizeTransportProtocol(protocol))

export const filterPackerTypesStructure = (packerTypes, packerCompatibility, protocol) => {
  const source = packerTypes || {}
  const isCompatible = packer => isPackerProtocolCompatible(packerCompatibility?.[packer], protocol)
  const groups = (Array.isArray(source.groups) ? source.groups : [])
    .map(group => ({
      ...group,
      packers: (Array.isArray(group.packers) ? group.packers : []).filter(isCompatible)
    }))
    .filter(group => group.packers.length)
  const ungrouped = (Array.isArray(source.ungrouped) ? source.ungrouped : []).filter(isCompatible)
  const sourceFlat = Array.isArray(source.flat) && source.flat.length
    ? source.flat
    : [...groups.flatMap(group => group.packers), ...ungrouped]
  const flat = sourceFlat.filter(isCompatible)

  return { groups, ungrouped, flat }
}

export const reconcileMemoryProtocolSelection = ({
  form,
  serverInjectorTypes,
  compatiblePackerNames
}) => {
  const serverTypes = Object.keys(serverInjectorTypes || {})
  if (form.serverType && !serverTypes.includes(form.serverType)) {
    form.serverType = serverTypes[0] || ''
  }

  const injectorNames = form.serverType
    ? serverInjectorTypes?.[form.serverType] || []
    : []
  if (form.shellType && !injectorNames.includes(form.shellType)) {
    form.shellType = injectorNames.length === 1 ? injectorNames[0] : ''
  } else if (!form.shellType && form.serverType && injectorNames.length === 1) {
    form.shellType = injectorNames[0]
  }

  if (form.packerType && !compatiblePackerNames.includes(form.packerType)) {
    form.packerType = ''
  }
}
