export const maxConfigVariableNameLength = 200

export interface ConfigVariableInput {
  name: string
  value: string
  description: string
}

export interface ConfigVariable extends ConfigVariableInput {
  id: string
  version: number
  createdAt: string
  updatedAt: string
}

export function configVariablesKey(revision: number) {
  return ['config-variables', revision] as const
}

export function normalizeConfigVariable(input: ConfigVariableInput): ConfigVariableInput {
  return { name: input.name.trim(), value: input.value, description: input.description.trim() }
}
