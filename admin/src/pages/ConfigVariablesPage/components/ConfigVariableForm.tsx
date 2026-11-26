import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { maxConfigVariableNameLength, normalizeConfigVariable } from '../../../lib/configVariable'
import type { ConfigVariable, ConfigVariableInput } from '../../../lib/configVariable'
import { configVariableErrors } from '../configVariable'
import type { ConfigVariableErrors } from '../configVariable'

export default function ConfigVariableForm({ variable, variables, pending, reloading, error, missing, canReload, onReload, onSave, onCancel }: {
  variable?: ConfigVariable, variables: readonly ConfigVariable[], onSave: (input: ConfigVariableInput) => void, onCancel: () => void,
  pending: boolean, reloading: boolean, error: string, missing: boolean, canReload: boolean, onReload: () => void,
}) {
  const [input, setInput] = useState<ConfigVariableInput>(() => ({
    name: variable?.name ?? '', value: variable?.value ?? '', description: variable?.description ?? '',
  }))
  const [errors, setErrors] = useState<ConfigVariableErrors>({})
  const nameInput = useRef<HTMLInputElement>(null)
  const valueInput = useRef<HTMLTextAreaElement>(null)
  const descriptionInput = useRef<HTMLTextAreaElement>(null)
  const failure = useRef<HTMLParagraphElement>(null)
  const id = useId()
  const busy = pending || reloading

  useEffect(() => { nameInput.current?.focus() }, [])
  useEffect(() => { if (error) failure.current?.focus() }, [error])

  function change(field: keyof ConfigVariableInput, value: string) {
    setInput((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || missing) return
    const normalized = normalizeConfigVariable(input)
    const nextErrors = configVariableErrors(normalized, variables, variable?.id)
    setErrors(nextErrors)
    if (nextErrors.name) nameInput.current?.focus()
    else if (nextErrors.value) valueInput.current?.focus()
    else if (nextErrors.description) descriptionInput.current?.focus()
    else onSave(normalized)
  }

  return (
    <form className="user-form config-variable-form" aria-labelledby={`${id}-title`} aria-busy={busy} onSubmit={submit} noValidate>
      <h2 id={`${id}-title`}>{variable ? 'Editează variabila' : 'Adaugă o variabilă'}</h2>
      {error && <p ref={failure} className="request-error" role="alert" tabIndex={-1}>{error}</p>}
      <div className="form-fields">
        <div className="form-field config-variable-name-field">
          <label htmlFor={`${id}-name`}>Nume</label>
          <input ref={nameInput} id={`${id}-name`} name="name" required autoComplete="off" autoCapitalize="none" spellCheck={false}
            maxLength={maxConfigVariableNameLength} disabled={busy || missing} value={input.name}
            aria-invalid={Boolean(errors.name)} aria-describedby={`${id}-name-hint${errors.name ? ` ${id}-name-error` : ''}`}
            onChange={(event) => change('name', event.target.value)} />
          <p className="field-hint" id={`${id}-name-hint`}>Nume unic, de cel mult 200 de caractere. Literele mari și mici sunt diferite.</p>
          {errors.name && <p className="field-error" id={`${id}-name-error`} role="alert">{errors.name}</p>}
        </div>
        <div className="form-field">
          <label htmlFor={`${id}-value`}>Valoare<span className="optional-label"> (opțional)</span></label>
          <textarea ref={valueInput} id={`${id}-value`} name="value" rows={5} autoComplete="off" autoCapitalize="none" spellCheck={false}
            disabled={busy || missing} value={input.value} aria-invalid={Boolean(errors.value)}
            aria-describedby={`${id}-value-hint${errors.value ? ` ${id}-value-error` : ''}`}
            onChange={(event) => change('value', event.target.value)} />
          <p className="field-hint" id={`${id}-value-hint`}>Valoarea se salvează ca text. Spațiile și liniile noi se păstrează.</p>
          {errors.value && <p className="field-error" id={`${id}-value-error`} role="alert">{errors.value}</p>}
        </div>
        <div className="form-field">
          <label htmlFor={`${id}-description`}>Descriere<span className="optional-label"> (opțional)</span></label>
          <textarea ref={descriptionInput} id={`${id}-description`} name="description" rows={5} disabled={busy || missing}
            value={input.description} aria-invalid={Boolean(errors.description)}
            aria-describedby={errors.description ? `${id}-description-error` : undefined}
            onChange={(event) => change('description', event.target.value)} />
          {errors.description && <p className="field-error" id={`${id}-description-error`} role="alert">{errors.description}</p>}
        </div>
      </div>
      <div className="form-actions">
        <button className="primary-button" type="submit" disabled={busy || missing}>{pending ? 'Se salvează…' : 'Salvează variabila'}</button>
        {canReload && !missing && <button type="button" disabled={busy} onClick={onReload}>{reloading ? 'Se reîncarcă…' : 'Reîncarcă variabila'}</button>}
        <button type="button" disabled={busy} onClick={onCancel}>{missing ? 'Închide' : 'Anulează'}</button>
      </div>
      {canReload && !missing && <p className="field-hint">Reîncărcarea înlocuiește valorile introduse cu ultima versiune salvată.</p>}
    </form>
  )
}
