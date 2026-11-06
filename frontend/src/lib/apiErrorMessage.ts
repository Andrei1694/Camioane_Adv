import { formatCount, plural } from './format'

// The API supplies English messages without error codes. Translate known messages at the
// shared fetch/XHR boundary; new server messages use a Romanian fallback for their status.
const messages: Record<string, string> = {
  'Unauthorized': 'Autentifică-te din nou pentru a continua.',
  'Invalid email or password': 'Adresa de e-mail sau parola este incorectă.',
  'Administrator access is required': 'Este necesar accesul de administrator.',
  'Too many authentication requests. Try again later.': 'Prea multe încercări de autentificare. Încearcă din nou mai târziu.',
  'Email is already registered': 'Această adresă de e-mail este deja înregistrată.',
  'User not found': 'Utilizatorul nu a fost găsit.',
  'Accounts changed during this request. Refresh and try again.': 'Conturile s-au modificat în timpul cererii. Actualizează pagina și încearcă din nou.',
  'The requested role is missing. Check role configuration.': 'Rolul solicitat lipsește. Verifică configurarea rolurilor.',
  'The last administrator cannot be removed or demoted': 'Ultimul administrator nu poate fi șters și nu poate pierde rolul de administrator.',
  'You cannot remove your own administrator access': 'Nu îți poți elimina propriul acces de administrator.',
  'You cannot delete your own account': 'Nu îți poți șterge propriul cont.',
  'The ADMIN role is inactive, not yet started, or expired. Check role configuration.': 'Rolul de administrator este inactiv, încă neactivat sau expirat. Verifică configurarea rolurilor.',
  'A valid email address is required': 'Este necesară o adresă de e-mail validă.',
  'Password must contain between 12 and 128 characters': 'Parola trebuie să conțină între 12 și 128 de caractere.',
  'Role must be ADMIN, OPERATOR, DRIVER, or USER': 'Alege rolul Administrator, Operator, Șofer sau Utilizator.',
  'A JSON object is required': 'Cererea trebuie să conțină un obiect JSON.',
  'Only email, password, and role can be changed': 'Pot fi modificate doar adresa de e-mail, parola și rolul.',
  'Provide at least one field to update': 'Completează cel puțin un câmp pentru actualizare.',
  'A valid user ID is required': 'Este necesar un identificator de utilizator valid.',
  'The profile picture changed during this request. Try again.': 'Fotografia de profil s-a modificat în timpul cererii. Încearcă din nou.',
  'Profile picture not found': 'Fotografia de profil nu a fost găsită.',
  'The image could not be read': 'Imaginea nu a putut fi citită.',
  'Upload interrupted': 'Încărcarea a fost întreruptă.',
  'Expected multipart/form-data': 'Fișierul trebuie trimis ca formular multipart.',
  'Malformed multipart upload': 'Datele formularului de încărcare nu sunt valide.',
  'Provide one file in the file field': 'Selectează un singur fișier pentru încărcare.',
  'File exceeds the upload size limit': 'Fișierul depășește limita de dimensiune pentru încărcare.',
  'Upload exactly one file in the file field, without additional fields': 'Încarcă exact un fișier, fără câmpuri suplimentare.',
  'Invalid JSON body': 'Datele JSON ale cererii nu sunt valide.',
  'Request body is too large': 'Datele cererii depășesc dimensiunea permisă.',
  'Unsupported request encoding': 'Codificarea cererii nu este acceptată.',
  'Internal server error': 'A apărut o eroare pe server. Încearcă din nou.',
  'Only JPEG, PNG, WebP, and MP4 files are allowed': 'Sunt acceptate doar fișiere JPEG, PNG, WebP și MP4.',
  'Only JPEG, PNG, and WebP images are allowed': 'Sunt acceptate doar imagini JPEG, PNG și WebP.',
  'A valid file ID is required': 'Este necesar un identificator de fișier valid.',
  'Only limit and offset query parameters are supported': 'Sunt acceptați doar parametrii de paginare.',
  'Invalid pagination': 'Parametrii de paginare nu sunt valizi.',
  'Empty files are not allowed': 'Fișierele goale nu sunt acceptate.',
  'Unsupported or unrecognized file content': 'Conținutul fișierului nu este acceptat sau recunoscut.',
  'Files changed during this request. Try again.': 'Fișierele s-au modificat în timpul cererii. Încearcă din nou.',
  'File not found': 'Fișierul nu a fost găsit.',
  'The MP4 file has no video stream.': 'Fișierul MP4 nu conține o pistă video.',
  'The video stream has an unreadable codec or dimensions.': 'Codecul sau dimensiunile pistei video nu pot fi citite.',
  'The video has no readable duration.': 'Durata videoclipului nu poate fi citită.',
  'The video could not be read. Upload a playable MP4 file.': 'Videoclipul nu a putut fi citit. Încarcă un fișier MP4 care poate fi redat.',
  'Credits changed during this request. Refresh and try again.': 'Creditele s-au modificat în timpul cererii. Actualizează pagina și încearcă din nou.',
  'Insufficient credits': 'Credite insuficiente.',
  'The credit balance would exceed its maximum': 'Soldul creditelor ar depăși limita maximă.',
  'Purchase not found': 'Achiziția nu a fost găsită.',
  'Only pending purchases can be canceled': 'Pot fi anulate doar achizițiile în așteptare.',
  'Only pending purchases can be confirmed': 'Pot fi confirmate doar achizițiile în așteptare.',
  'The purchase owner no longer exists': 'Titularul achiziției nu mai există.',
  'This payment reference is already used': 'Această referință de plată este deja folosită.',
  'This payment reference is already used, or the purchase was already confirmed': 'Această referință de plată este deja folosită sau achiziția a fost deja confirmată.',
  'Only pending purchases can be marked as failed': 'Pot fi marcate ca eșuate doar achizițiile în așteptare.',
  'A valid purchase ID is required': 'Este necesar un identificator de achiziție valid.',
  'Amount must not be zero': 'Suma trebuie să fie diferită de zero.',
  'Status must be PENDING, PAID, FAILED, CANCELED': 'Alege o stare validă: în așteptarea plății, plătită, plată eșuată sau anulată.',
  'A valid car ID is required': 'Este necesar un identificator de mașină valid.',
  'Car endpoints do not accept query parameters': 'Cererile pentru mașini nu acceptă parametri suplimentari.',
  'Unsupported car fields': 'Cererea conține câmpuri neacceptate pentru mașină.',
  'Enter a license plate': 'Introdu un număr de înmatriculare.',
  'Route must be centru, nord, vest, est, sud, or null': 'Alege traseul Centru, Nord, Vest, Est, Sud sau lasă-l neatribuit.',
  'Status must be active, maintenance, or inactive': 'Alege starea Activă, În mentenanță sau Inactivă.',
  'A valid car version is required': 'Este necesară o versiune validă a mașinii.',
  'A car with this license plate already exists.': 'Există deja o mașină cu acest număr de înmatriculare.',
  'Car not found': 'Mașina nu a fost găsită.',
  'This car changed during editing. Reload the latest car and try again.': 'Mașina a fost modificată în timpul editării. Reîncarcă ultima versiune și încearcă din nou.',
  'Unsupported campaign fields': 'Cererea conține câmpuri neacceptate pentru campanie.',
  'A valid campaign ID is required': 'Este necesar un identificator de campanie valid.',
  'Select at least one campaign date': 'Selectează cel puțin o zi pentru campanie.',
  'Invalid campaign date': 'Ziua campaniei nu este validă.',
  'Use valid YYYY-MM-DD campaign dates': 'Folosește date valide în formatul AAAA-LL-ZZ pentru campanie.',
  'Campaign dates must be valid and unique': 'Zilele campaniei trebuie să fie valide și unice.',
  'Each campaign day needs 1–96 working intervals': 'Fiecare zi a campaniei trebuie să aibă 1–96 de intervale de funcționare.',
  'Invalid working interval': 'Intervalul de funcționare nu este valid.',
  'Working interval IDs must be valid and unique': 'Identificatorii intervalelor trebuie să fie valizi și unici.',
  'Working hours must be same-day, increasing 15-minute intervals between 00:00 and 24:00': 'Orele trebuie să fie în aceeași zi, în intervale crescătoare de 15 minute, între 00:00 și 24:00.',
  'Working intervals must not overlap': 'Intervalele de funcționare nu trebuie să se suprapună.',
  'A campaign body is required': 'Sunt necesare datele campaniei.',
  'Campaign names must be at most 200 characters': 'Numele campaniei poate avea cel mult 200 de caractere.',
  'A valid campaign version is required': 'Este necesară o versiune validă a campaniei.',
  'Past campaign dates and hours cannot change. Restore the saved past schedule before saving.': 'Zilele și orele trecute ale campaniei nu pot fi modificate. Restabilește programul trecut salvat înainte de a salva.',
  'Campaign not found': 'Campania nu a fost găsită.',
  'New campaigns cannot contain past dates': 'Campaniile noi nu pot include zile din trecut.',
  'This campaign changed during editing. Reload the latest campaign and try again.': 'Campania a fost modificată în timpul editării. Reîncarcă ultima versiune și încearcă din nou.',
  'Unsupported route fields': 'Cererea conține câmpuri neacceptate pentru traseu.',
  'A valid route ID is required': 'Este necesar un identificator de traseu valid.',
  'Invalid route pagination': 'Parametrii de paginare a traseelor nu sunt valizi.',
  'A route must have 2–100 stops': 'Un traseu trebuie să aibă 2–100 de opriri.',
  'Stops must be [longitude, latitude] pairs within ±180 longitude and ±85.051129 latitude': 'Opririle trebuie să fie perechi [longitudine, latitudine], cu longitudinea între ±180 și latitudinea între ±85.051129.',
  'Route names must contain 1–200 characters and no null characters': 'Numele traseului trebuie să conțină 1–200 de caractere, fără caractere nule.',
  'A valid route version is required': 'Este necesară o versiune validă a traseului.',
  'Route not found': 'Traseul nu a fost găsit.',
  'This route changed during editing. Reload the latest route and try again.': 'Traseul a fost modificat în timpul editării. Reîncarcă ultima versiune și încearcă din nou.',
}

const fieldLabels: Record<string, string> = {
  'License plate': 'Numărul de înmatriculare', 'Make/model': 'Marca/modelul',
  'Driver name': 'Numele șoferului', Reference: 'Referința', Note: 'Nota',
  Email: 'Adresa de e-mail', Password: 'Parola',
}

const requestFields: Record<string, string> = {
  credits: 'credite', reference: 'referință', userId: 'identificator de utilizator',
  amount: 'sumă', note: 'notă', limit: 'limită', offset: 'poziție', status: 'stare',
}

function validationMessage(message: string): string | undefined {
  const field = /^(License plate|Make\/model|Driver name|Reference|Note|Email|Password) (.+)$/.exec(message)
  if (field) {
    const label = fieldLabels[field[1]]
    const rule = field[2]
    if (rule === 'must be a string') return `${label} trebuie să fie text.`
    if (rule === 'is required') return `Completează câmpul „${label}”.`
    const range = /^must contain between 1 and (\d+) characters$/.exec(rule)
    if (range) return `${label} trebuie să conțină între 1 și ${plural(Number(range[1]), 'caracter', 'caractere')}.`
    const maximum = /^must contain at most (\d+) characters and no null characters$/.exec(rule)
    if (maximum) return `${label} poate avea cel mult ${plural(Number(maximum[1]), 'caracter', 'caractere')}, fără caractere nule.`
  }
  const number = /^(Credits|Amount) must be a whole number between (-?\d+) and (\d+)$/.exec(message)
  if (number) return `${number[1] === 'Credits' ? 'Numărul de credite' : 'Suma'} trebuie să fie un număr întreg între ${formatCount(Number(number[2]))} și ${formatCount(Number(number[3]))}.`
  const fields = /^Only ([a-zA-Z, ]+) can be provided$/.exec(message)
  if (fields) {
    const names = fields[1].split(', ')
    if (names.every((name) => Object.hasOwn(requestFields, name))) {
      return `Sunt acceptate doar câmpurile: ${names.map((name) => requestFields[name]).join(', ')}.`
    }
  }
}

const statusMessages: Partial<Record<number, string>> = {
  0: 'Conectarea la server a eșuat. Verifică conexiunea și încearcă din nou.',
  400: 'Datele trimise nu sunt valide. Verifică formularul și încearcă din nou.',
  401: 'Autentifică-te din nou pentru a continua.',
  403: 'Nu ai permisiunea necesară pentru această acțiune.',
  404: 'Elementul solicitat nu a fost găsit.',
  408: 'Cererea nu a fost finalizată la timp. Încearcă din nou.',
  409: 'Datele s-au modificat. Reîncarcă ultima versiune și încearcă din nou.',
  413: 'Datele trimise depășesc dimensiunea permisă.',
  415: 'Formatul trimis nu este acceptat.',
  422: 'Datele trimise nu au putut fi procesate. Verifică-le și încearcă din nou.',
  429: 'Prea multe cereri. Așteaptă puțin și încearcă din nou.',
}

export function apiErrorMessage(status: number, message?: string): string {
  if (message) {
    if (Object.hasOwn(messages, message)) return messages[message]
    const validation = validationMessage(message)
    if (validation) return validation
  }
  return statusMessages[status] ?? (status >= 500
    ? 'Serverul nu este disponibil momentan. Încearcă din nou mai târziu.'
    : 'Cererea a eșuat. Încearcă din nou.')
}
