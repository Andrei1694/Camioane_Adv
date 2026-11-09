import { expect, it } from 'vitest'
import { apiErrorMessage } from '../src/lib/apiErrorMessage'

it.each([
  ['Invalid email or password', 'Adresa de e-mail sau parola este incorectă.'],
  ['Insufficient credits', 'Credite insuficiente.'],
  ['Working intervals must not overlap', 'Intervalele de funcționare nu trebuie să se suprapună.'],
  ['File exceeds the upload size limit', 'Fișierul depășește limita de dimensiune pentru încărcare.'],
  ['This route changed during editing. Reload the latest route and try again.', 'Traseul a fost modificat în timpul editării. Reîncarcă ultima versiune și încearcă din nou.'],
  ['Email must be a string', 'Adresa de e-mail trebuie să fie text.'],
  ['Make/model is required', 'Completează câmpul „Marca/modelul”.'],
  ['License plate must contain between 1 and 32 characters', 'Numărul de înmatriculare trebuie să conțină între 1 și 32 de caractere.'],
  ['Note must contain at most 200 characters and no null characters', 'Nota poate avea cel mult 200 de caractere, fără caractere nule.'],
  ['Credits must be a whole number between 1 and 1000', 'Numărul de credite trebuie să fie un număr întreg între 1 și 1.000.'],
  ['Amount must be a whole number between -1000 and 1000', 'Suma trebuie să fie un număr întreg între -1.000 și 1.000.'],
  ['Only userId, amount, note can be provided', 'Sunt acceptate doar câmpurile: identificator de utilizator, sumă, notă.'],
])('translates server validation: %s', (message, translated) => {
  expect(apiErrorMessage(400, message)).toBe(translated)
})

it('uses safe status fallbacks for unfamiliar messages and fields', () => {
  for (const message of ['Only secret can be provided', 'Password has an unknown rule', 'constructor', '<script>secret</script>']) {
    expect(apiErrorMessage(400, message)).toBe('Datele trimise nu sunt valide. Verifică formularul și încearcă din nou.')
  }
  expect(apiErrorMessage(503, 'Internal details')).toBe('Serverul nu este disponibil momentan. Încearcă din nou mai târziu.')
  expect(apiErrorMessage(418)).toBe('Cererea a eșuat. Încearcă din nou.')
})
