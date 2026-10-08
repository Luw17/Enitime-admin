export function parseCompatibleModels(value: unknown): string[] {
  const entries = (Array.isArray(value) ? value : typeof value === 'string' ? [value] : [])
    .flatMap((entry) => typeof entry === 'string' ? entry.split(/[,;\n]+/) : [])
  const seen = new Set<string>()

  return entries.flatMap((entry) => {
    const model = entry.trim()
    const normalized = model.toLocaleLowerCase('pt-BR')
    if (!model || seen.has(normalized)) return []
    seen.add(normalized)
    return [model]
  })
}

export function serializeCompatibleModels(models: string[]) {
  return parseCompatibleModels(models).join(', ')
}