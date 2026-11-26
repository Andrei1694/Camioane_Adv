import { maxConfigVariableNameLength } from '../../lib/configVariable'
import type { ConfigVariable, ConfigVariableInput } from '../../lib/configVariable'

export type ConfigVariableErrors = Partial<Record<keyof ConfigVariableInput, string>>

export function configVariableErrors(input: ConfigVariableInput, variables: readonly ConfigVariable[], id?: string): ConfigVariableErrors {
  const errors: ConfigVariableErrors = {}
  if (!input.name || input.name.length > maxConfigVariableNameLength || input.name.includes('\0')) {
    errors.name = 'Introdu un nume de 1–200 de caractere, fără caractere nule.'
  } else if (variables.some((variable) => variable.id !== id && variable.name === input.name)) {
    errors.name = 'Există deja o variabilă cu acest nume. Alege un nume diferit.'
  }
  if (input.value.includes('\0')) errors.value = 'Valoarea nu poate conține caractere nule.'
  if (input.description.includes('\0')) errors.description = 'Descrierea nu poate conține caractere nule.'
  return errors
}

export function matchesConfigVariableSearch(variable: ConfigVariable, search: string) {
  const query = search.trim().toLocaleLowerCase('ro')
  return [variable.name, variable.value, variable.description].some((text) => text.toLocaleLowerCase('ro').includes(query))
}
