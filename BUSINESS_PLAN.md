# Plan de afaceri și cerințe de produs — Camioane App

- **Data documentului:** 4 noiembrie 2026
- **Versiune:** 1.0 — baza analizei inițiale
- **Produs:** Campanii publicitare pe camioane cu ecrane LED, operate de companie
- **Stare:** Modelul de afaceri de bază este confirmat; politicile operaționale și detaliile integrării rămân de clarificat.

## 1. Scopul documentului și modul de utilizare

Acest document reunește analiza de afaceri, funcționalitățile produsului, fluxurile de lucru, cerințele, planul de implementare, criteriile de acceptare și întrebările discutate cu responsabilul de produs.

Cerințele sunt clasificate astfel:

- **Confirmat:** selectat sau precizat explicit de responsabilul de produs în etapa de analiză.
- **Propus:** regulă de implementare sau regulă de afaceri recomandată, care susține modelul confirmat, dar nu a fost aprobată separat.
- **De clarificat:** decizie sau dependență externă pentru care este necesar un răspuns.

Această distincție este importantă: recomandările din document nu trebuie considerate răspunsuri la întrebările privind afacerea încă nerezolvate. Istoricul complet al întrebărilor și răspunsurilor se află în secțiunea 19.

Documentul reprezintă baza planificării produsului și a implementării. Nu au fost furnizate sau cercetate date privind dimensiunea pieței, previziunile de vânzări, costurile operaționale, profitabilitatea, bugetele sau datele de lansare; nu sunt presupuse valori pentru acestea.

## 2. Rezumat executiv

Compania operează o flotă de camioane echipate cu ecrane LED pentru publicitate. Camioanele circulă pe trasee predefinite, cu plecări programate la ore fixe sau intervale orare rezervabile. Mai multe trasee pot funcționa în paralel.

Clienții de publicitate folosesc aplicația pentru a cumpăra credite, a încărca materiale publicitare și a solicita campanii. O campanie poate include date calendaristice specifice, programări recurente, mai multe trasee în același interval și un număr distinct de camioane pentru fiecare traseu.

Publicitatea este exclusivă pe fiecare camion rezervat, pe durata intervalului rezervat. O campanie poate fi confirmată numai dacă întregul program solicitat este disponibil. Confirmarea parțială nu este permisă.

Creditele au un preț standard de achiziție. Campaniile consumă credite conform unor tarife exprimate pe camion-oră, cu valori diferite în funcție de traseu și de intervalul tarifar. Utilizatorii cumpără credite prin plăți online cu cardul, iar soldul lor crește după confirmarea plății.

Un administrator verifică solicitarea de campanie și confirmă manual rezervarea. La confirmare, aplicația trebuie să verifice din nou disponibilitatea flotei și soldul clientului, apoi să rezerve întreaga campanie și să scadă creditele în cadrul aceleiași operațiuni. Trimiterea unei solicitări nu blochează și nu scade credite.

Clienții încarcă imagini sau videoclipuri pentru aprobarea administratorului. Aplicația se integrează cu controlerul ecranelor pentru a transmite conținutul și a colecta înregistrările de redare. Clienții pot solicita anularea unor intervale viitoare selectate sau a tuturor intervalelor rămase ale campaniei; administratorul analizează solicitarea și aplică politica agreată de restituire a creditelor.

## 3. Obiective de afaceri și model comercial

### 3.1 Obiective

Obiectivele propuse pentru produs sunt:

1. Să ofere clienților o modalitate clară de a alege acoperirea, de a programa campanii, de a înțelege costul și de a solicita rezervări.
2. Să împiedice compania să aloce același camion unor rezervări incompatibile.
3. Să asigure trasabilitatea creditelor cumpărate, a costurilor campaniilor și a ajustărilor de credite.
4. Să coreleze materialele publicitare aprobate cu programul efectiv al camioanelor și al ecranelor.
5. Să ofere clienților și administratorilor o imagine asupra publicității programate și a redărilor raportate.
6. Să permită gestionarea controlată a anulărilor și a problemelor de difuzare.

### 3.2 Reguli comerciale confirmate

| Subiect | Regulă confirmată |
| --- | --- |
| Proprietatea și operarea flotei | Compania operează camioanele. |
| Produs vândut | Publicitate exclusivă pe un camion, pentru o perioadă rezervată. |
| Model de plată | Clienții cumpără credite preplătite prin plăți online cu cardul. |
| Prețul de achiziție al creditelor | Preț standard de conversie a banilor în credite. |
| Costul campaniei | Credite pe camion-oră, cu tarife variabile în funcție de traseu și de intervalul tarifar. |
| Autoritatea de confirmare | Administratorul confirmă manual rezervarea. |
| Angajarea creditelor | Creditele se scad la confirmare, după verificarea soldului curent; nu se blochează la trimiterea solicitării. |
| Cerință de disponibilitate | Fiecare instanță programată și întregul număr de camioane solicitat trebuie să fie disponibile. |
| Anulare | Clientul solicită anularea; administratorul analizează cererea și aplică politica de restituire a creditelor. |
| Întinderea anulării | Intervale viitoare selectate sau toate intervalele rămase ale campaniei. |

### 3.3 Informații comerciale încă necesare

- Orașul sau orașele de lansare, zona deservită și dimensiunea inițială a flotei.
- Segmentele de clienți vizate și dimensiunile estimate ale campaniilor.
- Moneda, rata de conversie bani–credite și valorile disponibile pentru alimentarea contului.
- Tarifele pe trasee și intervale tarifare, condițiile minime de rezervare și precizia creditelor.
- Regulile exacte de anulare și restituire a creditelor.
- Tratarea publicității nedifuzate și a înregistrărilor de redare contestate.
- Expirarea creditelor, rambursarea creditelor cumpărate și neutilizate și reversarea plăților.
- Bugetul operațional, obiectivele de venituri, canalele de marketing și calendarul lansării.

## 4. Utilizatori, responsabilități și situația actuală a proiectului

### 4.1 Utilizatori și sisteme externe

| Actor | Responsabilități |
| --- | --- |
| Client de publicitate | Cumpără credite, creează campanii, selectează intervalele traseelor și numărul de camioane, încarcă materiale, trimite solicitări, urmărește starea și difuzarea, solicită anulări. |
| Administrator | Gestionează flota și traseele, configurează prețurile, verifică materialele și solicitările de campanie, confirmă rezervările, analizează anulările, gestionează ajustările autorizate de credite și investighează problemele de difuzare. |
| Personal operațional | Monitorizează camioanele alocate, distribuirea conținutului către controlere și excepțiile de difuzare. Un rol de cont sau o interfață separată reprezintă o propunere, încă neconfirmată. |
| Procesator de plăți cu cardul | Procesează achizițiile de credite și raportează rezultatul plăților. Alegerea furnizorului rămâne de clarificat. |
| Controlerul ecranelor sau platforma de administrare | Primește conținutul și programele aprobate, raportează starea distribuirii, permite retragerea programărilor și furnizează înregistrările de redare. Capacitățile platformei trebuie verificate. |

Procesul de înregistrare a clienților rămâne de clarificat. Analiza nu a stabilit dacă utilizatorii își creează singuri conturile, sunt invitați sau primesc conturi create de administratori.

### 4.2 Contextul existent al depozitului de cod

Documentația proiectului consultată în timpul analizei descrie:

- O interfață de administrare realizată cu React, TypeScript și Vite.
- Un API bazat pe Express și TypeScript, care folosește Prisma și PostgreSQL.
- Autentificare, roluri User/Admin și conturi de utilizator gestionate de administratori.
- Funcționalități existente pentru validarea sesiunilor și administrarea utilizatorilor.

Referințe relevante din proiect:

- [Documentația frontendului](frontend/README.md)
- [Documentația backendului](backend/README.md)
- [Instrucțiuni pentru contribuții la frontend](frontend/AGENTS.md)
- [Instrucțiuni pentru contribuții la backend](backend/AGENTS.md)

Aceste afirmații se bazează pe documentația proiectului, nu pe un nou audit al implementării sau pe o verificare în execuție. Verificarea apartenenței datelor la fiecare client, gestionarea campaniilor, programarea, creditele, plățile, integrarea cu controlerele și raportarea trebuie evaluate ca funcționalități noi.

Directorul hardware_docs a fost verificat în etapa de planificare și nu conținea documentație. Existența directorului mobile nu confirmă o cerință pentru o aplicație mobilă sau o funcționalitate mobilă deja implementată.

## 5. Funcționalități confirmate pentru versiunea minimă viabilă (MVP)

| ID | Funcționalitate | Comportament cerut |
| --- | --- | --- |
| C-01 | Flotă operată de companie | Gestionarea camioanelor de publicitate ale companiei. |
| C-02 | Publicitate exclusivă | Un camion rezervat deservește o singură campanie în intervalul rezervat. |
| C-03 | Program publicat al traseelor | Clienții selectează plecări fixe sau intervale rezervabile ale traseelor. |
| C-04 | Campanie cu mai multe intervale | O campanie poate conține mai multe intervale solicitate. |
| C-05 | Campanii recurente | Sunt acceptate date specifice, programări recurente sau o combinație a acestora. |
| C-06 | Mai multe camioane | Se poate solicita un număr de camioane pentru fiecare traseu dintr-un interval. |
| C-07 | Trasee paralele | O campanie poate rezerva mai multe trasee predefinite în același interval. |
| C-08 | Disponibilitate integrală | Toate instanțele programate și toate cantitățile trebuie să fie disponibile înainte de confirmare. |
| C-09 | Achiziție de credite | Utilizatorii cumpără credite cu cardul, la un preț standard de achiziție. |
| C-10 | Tarifare variabilă a campaniei | Costul se calculează în credite pe camion-oră, folosind tarifele pe traseu și interval tarifar. |
| C-11 | Confirmare manuală a rezervării | Administratorul decide când confirmă. |
| C-12 | Debitare la confirmare | Soldul este verificat, iar creditele sunt scăzute la confirmare; nu se blochează credite la trimiterea solicitării. |
| C-13 | Încărcarea și aprobarea conținutului | Clienții încarcă imagini sau videoclipuri pentru aprobarea administratorului. |
| C-14 | Integrare cu controlerul | Conținutul este transmis prin integrarea cu controlerul, iar înregistrările de redare sunt colectate. |
| C-15 | Anulare analizată de administrator | Clienții solicită anularea; administratorii analizează cererea și aplică politica de restituire a creditelor. |
| C-16 | Anulare selectivă a intervalelor viitoare | Pot fi anulate intervale viitoare selectate sau toate intervalele rămase. |

Analiza inițială a explorat publicitatea partajată prin rotație, proprietari externi de flote, confirmarea instantanee de către client și încărcarea manuală a materialelor pe ecrane. Aceste alternative nu au fost selectate și nu fac parte din baza actuală de cerințe. Extinderea funcționalităților trebuie introdusă printr-o decizie explicită de produs.

## 6. Programarea, traseele și disponibilitatea flotei

### 6.1 Concepte de programare

| Termen | Semnificație |
| --- | --- |
| Traseu | Traseu operațional predefinit, oferit de companie. |
| Interval rezervabil al traseului | Plecare sau perioadă de circulație concretă, publicată, cu început și sfârșit. |
| Intrare de programare | Alegerea de către client a unui interval/unei date specifice sau a unei selecții recurente. |
| Instanță programată | Un rezultat concret, asociat unei date, al unei intrări de programare. |
| Solicitare pentru un interval al traseului | Numărul de camioane solicitat de o campanie pentru un anumit interval al unui traseu. |
| Rezervare de camion | Alocarea unui camion fizic concret unei solicitări confirmate pentru un interval al traseului. |

Modelul propus separă solicitarea clientului de resursele rezervate ulterior. Clienții aleg trasee și cantități; posibilitatea de a alege un anumit camion rămâne de clarificat.

### 6.2 Reguli de programare propuse

1. O campanie trebuie să conțină cel puțin o solicitare validă pentru un interval al unui traseu înainte de trimitere.
2. Numărul de camioane trebuie să fie un număr întreg pozitiv.
3. Intervalele publicate au momente explicite de început și sfârșit și un fus orar de operare.
4. Programările recurente necesită o dată de încheiere sau un număr maxim de instanțe, astfel încât întreaga solicitare să poată fi evaluată.
5. Interfața trebuie să transforme recurența în instanțe asociate unor date concrete și să le afișeze înainte de trimitere.
6. Selecțiile recurente trebuie să corespundă unor intervale publicate ale traseelor. Instanțele lipsă trebuie afișate, nu omise fără informare.
7. Intrările suprapuse trebuie să fie vizibile clientului, astfel încât cererile duplicate accidental să poată fi corectate.
8. Disponibilitatea trebuie să țină cont de cererea cumulată a tuturor intrărilor campaniei, inclusiv de instanțele suprapuse.
9. După rezervare, o instanță concretă trebuie să își păstreze identitatea. Modificarea unei reguli de recurență nu trebuie să regenereze sau să mute rezervările confirmate fără informare și acord.
10. Anularea unei instanțe nu trebuie să elimine celelalte instanțe ale aceleiași programări recurente.

Tipurile de recurență acceptate, orizontul de rezervare, termenul minim de solicitare în avans și tratarea schimbărilor între ora de vară și ora de iarnă rămân de clarificat. Programările săptămânale cu zile selectate reprezintă un posibil punct de pornire, nu o limitare confirmată.

### 6.3 Disponibilitate integrală și fezabilitate fizică

**Confirmat:** întreaga campanie solicitată trebuie să fie disponibilă înainte de confirmare.

Verificările de disponibilitate propuse includ:

- Capacitatea publicată pentru fiecare interval al traseului.
- Camioanele fizice eligibile pentru fiecare traseu.
- Rezervările confirmate existente.
- Mentenanța camioanelor și alte perioade de indisponibilitate.
- Cererea simultană provenită din alte trasee și din campania însăși.
- Timpul necesar pentru deplasare, pregătire sau configurare între rezervări, după definirea acestor reguli.

Capacitățile traseelor nu pot fi tratate ca independente dacă depind de aceleași camioane. Un camion alocat Traseului A nu poate onora și o rezervare suprapusă pe Traseul B.

De exemplu, o campanie care solicită trei camioane pentru fiecare dintre opt instanțe nu poate fi confirmată dacă, pentru una dintre instanțe, sunt disponibile doar două camioane eligibile. Sistemul trebuie să identifice conflictul și să lase întreaga campanie neconfirmată.

**De clarificat:** dacă se blochează temporar capacitate înainte de confirmare. Nu este permisă blocarea creditelor la trimiterea solicitării. Politica inițială propusă este rezervarea camioanelor doar la confirmare, cu o nouă verificare a disponibilității în acel moment.

### 6.4 Modificarea unei campanii confirmate

Măsuri de protecție propuse:

- Modificarea datelor, traseelor, cantităților sau orelor necesită o nouă evaluare a disponibilității și a prețului.
- Clientul trebuie să accepte modificarea programului sau a prețului.
- O încercare nereușită de reprogramare trebuie să păstreze rezervarea confirmată existentă.
- Modificarea orarului unui traseu nu trebuie să mute o campanie confirmată fără informare și acord.
- Confirmarea inițială integrală nu împiedică funcționalitatea de anulare selectivă a intervalelor viitoare, confirmată separat.

## 7. Tarifarea și acceptarea prețului

### 7.1 Model de tarifare confirmat

Creditele au un preț standard de achiziție în bani. Numărul de credite consumate de o campanie variază în funcție de traseu și de intervalul tarifar.

Unitatea de tarifare este creditul pe camion-oră: un camion rezervat timp de o oră. Pentru calcul, fiecare interval selectat este împărțit la fiecare moment în care se schimbă tariful aplicabil:

**Costul unui interval al traseului = numărul de camioane solicitat × suma(durata segmentului în ore × tariful segmentului în credite pe camion-oră)**

**Costul campaniei = suma(costurilor tuturor intervalelor traseelor, pentru toate instanțele programate)**

### 7.2 Exemplu ilustrativ

Tarifele de mai jos ilustrează doar formula; nu sunt tarife comerciale aprobate.

O campanie solicită două camioane pe un traseu, între 16:30 și 18:00. Tariful traseului este de 20 de credite pe camion-oră înainte de 17:00 și de 30 de credite pe camion-oră după 17:00.

| Segment | Durată | Tarif pe camion-oră | Camioane | Cost |
| --- | ---: | ---: | ---: | ---: |
| 16:30–17:00 | 0,5 ore | 20 de credite | 2 | 20 de credite |
| 17:00–18:00 | 1 oră | 30 de credite | 2 | 60 de credite |
| Total | 1,5 ore | | 2 | 80 de credite |

Un al doilea traseu care funcționează în paralel este tarifat separat, iar costul lui se adaugă la totalul campaniei. Fiecare instanță recurentă adaugă costul propriului interval datat.

### 7.3 Măsuri propuse pentru corectitudinea tarifării

- Afișarea defalcării pe traseu, dată, interval tarifar, durată, număr de camioane și total.
- Păstrarea versiunilor tarifelor și a calculului folosit când clientul trimite campania.
- Solicitarea acceptării clientului dacă analiza conduce la un alt preț sau program.
- Păstrarea prețurilor istorice atunci când se modifică configurația tarifelor.
- Stabilirea unei politici explicite de valabilitate a prețului; un tarif nou nu trebuie substituit fără informare la confirmare.
- Definirea unui calcul determinist și a regulilor de rotunjire înainte de implementare. Precizia creditelor și etapa în care se face rotunjirea rămân de clarificat.
- Definirea priorității tarifelor pentru reguli suprapuse, date speciale, intervale care trec peste miezul nopții și alte intervale aplicabile.

Modelul confirmat nu necesită un flux separat pentru oferte negociate. O versiune salvată a calculului de preț și acceptarea clientului pot susține fluxul normal de trimitere a solicitării; derogările negociate rămân o posibilă extindere, încă neclarificată.

## 8. Credite și plăți cu cardul

### 8.1 Fluxul de alimentare a contului

1. Clientul selectează un număr sau un pachet de credite și vede prețul în bani.
2. Aplicația creează o înregistrare a achiziției, asociată clientului.
3. Procesatorul de plăți cu cardul procesează plata.
4. Aplicația verifică confirmarea plății reușite în raport cu achiziția înregistrată.
5. O singură tranzacție de creditare adaugă în cont creditele cumpărate.
6. Clientul vede soldul actualizat și istoricul achizițiilor.

**Confirmat:** creditele sunt adăugate după confirmarea plății. Procesatorul de plăți, moneda, pachetele de achiziție și rata de conversie rămân de clarificat.

### 8.2 Reguli propuse pentru integritatea financiară

- Folosirea unei confirmări verificabile din partea procesatorului, asociată achiziției, sumei și monedei corecte.
- Plățile în așteptare sau eșuate nu măresc soldul disponibil de credite.
- Notificările de plată duplicate sau retrimise nu trebuie să adauge creditele de două ori.
- Păstrarea unui registru verificabil pentru fiecare alimentare, debitare de campanie, restituire de credite și ajustare autorizată.
- Corectarea erorilor prin ajustări trasabile, nu prin rescrierea neanunțată a tranzacțiilor istorice.
- Confirmările concurente ale rezervărilor nu trebuie să cheltuiască același sold de două ori sau să producă un sold negativ neintenționat.
- O alimentare reușită nu confirmă automat o campanie în așteptare.
- Restituirea creditelor unei campanii în portofel este o operațiune diferită de rambursarea în bani a unei achiziții plătite cu cardul; politica de rambursare în bani rămâne de clarificat.

### 8.3 Soldul la trimiterea solicitării și la confirmare

**Confirmat:** trimiterea solicitării nu scade și nu blochează credite. La confirmare se verifică soldul curent și se scade costul campaniei.

**De clarificat:** dacă un client trebuie să aibă deja suficiente credite pentru a trimite o solicitare. Indiferent de această alegere, soldul se poate modifica în perioada de așteptare și trebuie verificat din nou la confirmare.

## 9. Fluxul campaniei și al conținutului

### 9.1 Fluxul clientului de publicitate

1. Creează o campanie în stadiul de ciornă, cu numele și descrierea cerințelor publicitare.
2. Selectează intervalele publicate ale traseelor, numărul de camioane și eventualele recurențe.
3. Încarcă imaginile sau videoclipurile necesare.
4. Verifică programul detaliat și defalcarea costului în credite.
5. Trimite campania pentru analiză.
6. Răspunde solicitărilor de modificare sau de acceptare a condițiilor revizuite.
7. Urmărește confirmarea, distribuirea conținutului și difuzarea raportată.
8. Solicită anularea unor intervale viitoare selectate sau a tuturor intervalelor rămase, dacă este necesar.

Cumpărarea creditelor este o activitate separată a contului și poate avea loc înaintea etapei relevante a campaniei, în funcție de politica finală privind soldul necesar la trimitere.

### 9.2 Fluxul administratorului

1. Verifică detaliile campaniei și conținutul încărcat.
2. Verifică dacă materialele sunt adecvate și compatibile cu controlerele/ecranele vizate.
3. Evaluează întregul program și fezabilitatea operațională.
4. Solicită revizuiri sau respinge solicitarea, cu un motiv, când este cazul.
5. Confirmă o solicitare aprobată prin operațiunea de confirmare descrisă mai jos.
6. Monitorizează distribuirea conținutului către controlere și redarea raportată.
7. Analizează cererile de anulare și excepțiile de difuzare.

### 9.3 Reguli propuse pentru conținut

- Aprobarea se aplică unei versiuni identificabile a imaginii sau a videoclipului încărcat.
- Înlocuirea conținutului aprobat creează o versiune care necesită o nouă verificare.
- Conținutul încărcat trebuie să fie accesibil doar utilizatorilor și sistemelor autorizate.
- Formatele de fișiere, dimensiunile imaginii, codecurile, mărimile fișierelor, duratele și celelalte constrângeri tehnice trebuie stabilite pe baza capacităților reale ale ecranului/controlerului.
- Conținutul trebuie aprobat înainte de transmiterea sa către dispozitive.
- Condiția propusă pentru rezervare este aprobarea conținutului înainte de confirmare; posibilitatea confirmării înainte de aprobarea finală a materialelor rămâne o decizie explicită de produs.

**De clarificat:** dacă un singur material publicitar se aplică întregii campanii sau dacă se pot aloca materiale diferite pe trasee, intervale, camioane ori ecrane. Trebuie definite și regulile pentru conținutul publicitar, precum și motivele pentru care un administrator poate respinge o reclamă.

## 10. Confirmarea manuală și integritatea rezervării

Acțiunea Confirmă a administratorului reprezintă operațiunea comercială centrală.

### 10.1 Succesiunea propusă pentru confirmare

1. Verificarea permisiunii administratorului și a versiunii curente a campaniei.
2. Verificarea eligibilității solicitării pentru confirmare, inclusiv a condiției agreate privind aprobarea conținutului.
3. Verificarea programului acceptat de client și a valabilității calculului de preț salvat.
4. Identificarea unei alocări fezabile de camioane fizice pentru fiecare interval de traseu și fiecare instanță solicitată.
5. Verificarea soldului curent al clientului în raport cu costul integral.
6. Înregistrarea tuturor rezervărilor de camioane, a debitării pentru campanie și a stării confirmate în cadrul aceleiași operațiuni.
7. Inițierea procesului de distribuire către controlere, folosind programul confirmat și conținutul aprobat.

Etapele care modifică rezervările interne, soldul și starea rezervării trebuie să aibă un rezultat integral: fie reușesc toate, fie niciuna nu produce efecte. Nu se poate presupune că sistemele externe de plată și controlerele participă la aceeași tranzacție a bazei de date; operațiunile lor necesită fluxuri urmărite separat, care permit reîncercarea.

### 10.2 Comportamentul în caz de eșec

- Dacă oricare dintre instanțe nu are capacitate suficientă, nu se confirmă nimic și nu se scad credite.
- Dacă soldul este insuficient, nu se confirmă nimic și nu se scad credite.
- Dacă lipsește aprobarea necesară a conținutului sau acceptarea prețului, problema este explicată, iar rezervarea rămâne neconfirmată.
- Dacă o solicitare concurentă consumă mai întâi capacitatea sau soldul, operațiunea trebuie să eșueze fără a lăsa rezervări parțiale.
- Acțiunile Confirmă repetate trebuie să returneze sau să identifice rezultatul existent, fără a crea o a doua debitare.
- O alimentare a contului sau disponibilizarea unui camion nu confirmă automat o solicitare care a eșuat anterior; confirmarea rămâne o acțiune a administratorului.

## 11. Integrarea cu controlerul, distribuirea conținutului și dovezile de difuzare

### 11.1 Funcționalități de integrare confirmate

Aplicația trebuie să se integreze cu controlerul ecranelor pentru a transmite materialele publicitare și a colecta înregistrările de redare. Încărcarea manuală a materialelor pe ecrane nu este modelul de operare selectat pentru prima versiune.

### 11.2 Verificarea necesară a fezabilității

Producătorul controlerului, modelul, platforma de administrare și documentația API nu sunt încă cunoscute. Înainte de estimarea integrării, trebuie clarificate:

- Cerințele de autentificare și înregistrare a dispozitivelor.
- Asocierea dintre camioane, controlere și ecranele individuale.
- Tipurile de conținut acceptate și limitele tehnice pentru materiale.
- Încărcarea conținutului și starea transferului.
- Suportul pentru redare programată, comportamentul privind fusurile orare și gestionarea ceasului dispozitivului.
- Capacitățile de înlocuire și retragere/anulare a programărilor.
- Modul de obținere a confirmărilor de primire și a înregistrărilor de redare.
- Comportamentul atunci când un camion pierde conexiunea sau un dispozitiv păstrează local programe vechi.
- Dacă reîncercarea unei comenzi poate crea programări duplicate.
- Accesul la API, licențierea, echipamentele de test și disponibilitatea unui mediu de testare.

Aceste capacități nu trebuie presupuse până când nu sunt susținute de documentație și demonstrate printr-o verificare funcțională a integrării.

### 11.3 Cerințe propuse pentru distribuirea conținutului și raportare

- Asocierea fiecărui element transmis cu campania, instanța programată, camionul/dispozitivul rezervat și versiunea aprobată a conținutului.
- Urmărirea distribuirii în așteptare, a transferului, a confirmării de primire, a erorilor și a reîncercărilor separat de starea rezervării campaniei.
- Diferențierea conținutului acceptat de controler de conținutul raportat ca redat.
- Păstrarea identificatorilor furnizorului/dispozitivului și a marcajelor temporale necesare pentru eliminarea duplicatelor și corelarea înregistrărilor de redare.
- Gestionarea înregistrărilor întârziate sau sosite în altă ordine, fără a număra aceeași redare de două ori.
- Afișarea separată a publicității programate și a redării raportate.
- Tratarea lipsei telemetriei ca situație în curs de investigare până când politica de reconciliere stabilește rezultatul.
- Urmărirea retragerii programului de pe controler după o anulare, până la confirmarea acesteia sau până la o rezolvare operațională documentată.

Înregistrările de redare sunt sursa selectată pentru dovezile de difuzare. Urmărirea GPS, măsurarea respectării traseului, estimarea audienței și dovada că un ecran fizic a fost efectiv aprins și vizibil nu au fost specificate drept cerințe. Orice cerință suplimentară privind dovezile necesită o decizie explicită și suport din partea echipamentelor.

## 12. Anulări, restituiri de credite și excepții de difuzare

### 12.1 Comportament confirmat pentru anulare

- Clientul solicită anularea.
- Solicitarea poate viza intervale viitoare selectate sau toate intervalele rămase ale campaniei.
- Administratorul analizează solicitarea.
- Administratorul aplică politica agreată de restituire a creditelor.

Politica efectivă nu a fost încă definită. Acest document nu presupune o restituire integrală, un procent, un termen-limită sau un drept la rambursare în bani.

### 12.2 Flux de anulare propus

1. Clientul selectează intervale viitoare rezervate și identificabile, inclusiv instanțe individuale ale unei programări recurente, unde este cazul.
2. Sistemul înregistrează solicitarea și o afișează în așteptarea analizei.
3. Administratorul o aprobă sau o respinge, precizând motivul.
4. La aprobare, se calculează creditele de restituit pe baza costului rezervării inițiale și a politicii aplicabile.
5. Se înregistrează o singură dată anularea aprobată și orice tranzacție de credite.
6. Se retrag programele afectate de pe controlere și se urmărește rezultatul.
7. Se eliberează capacitatea afectată conform regulilor agreate privind retragerea programului și siguranța operațională.
8. Se actualizează vizualizarea campaniei pentru client, păstrând intervalele finalizate și pe cele neafectate.

### 12.3 Măsuri de protecție propuse

- O solicitare de anulare în așteptare nu anulează prin ea însăși rezervările, nu oprește redarea și nu restituie credite.
- Restituirea creditelor trebuie să facă referire la debitarea inițială a campaniei și la intervalele afectate.
- Procesarea repetată nu trebuie să producă restituiri duplicate.
- Restituirile cumulate trebuie să respecte politica și restituirile anterioare raportate la debitarea inițială; o compensație suplimentară, dacă este permisă, trebuie să constituie o ajustare autorizată distinctă.
- Publicitatea deja difuzată rămâne în istoric.
- Anularea unei instanțe recurente nu trebuie să o recreeze la recalcularea programului.
- Anularea parțială a intervalelor viitoare nu trebuie să modifice fără informare prețul rezervărilor neafectate.
- Retragerea programului de pe controler trebuie urmărită separat de decizia comercială internă.

**De clarificat:** momentul exact în care capacitatea anulată poate fi revândută, în special atunci când un controler este deconectat sau păstrează încă un program în memoria locală. Nu trebuie presupus că un clic al administratorului înseamnă că dispozitivul a oprit sau a retras conținutul.

**De clarificat:** dacă o anulare poate reduce doar numărul de camioane dintr-un interval sau trebuie să anuleze întreaga rezervare selectată pentru acel interval al traseului. Alegerea confirmată stabilește anularea la nivel de interval, nu reducerea cantității.

### 12.4 Publicitate nedifuzată

Rezervarea inițială se confirmă integral sau deloc, însă execuția operațională poate avea excepții după confirmare. O defecțiune, o eroare de distribuire a conținutului sau o redare incompletă trebuie înregistrată pentru instanța afectată, fără a șterge publicitatea deja difuzată.

Rămân de clarificat:

- Ce volum de redare este suficient pentru a considera obligația de difuzare îndeplinită.
- Cum se reconciliază dovezile de redare întârziate sau contradictorii.
- Dacă un deficit de difuzare conduce la restituirea de credite, un interval înlocuitor, o altă soluție sau o decizie a administratorului.
- În cât timp poate clientul semnala o problemă de difuzare.
- Dacă acordarea unei compensații poate fi automată sau necesită întotdeauna intervenția unui administrator.

## 13. Model propus pentru stări și date conceptuale

Această secțiune propune o structură pentru planificarea implementării. Nu reprezintă o schemă de bază de date aprobată sau o cerință de a crea câte un tabel pentru fiecare element.

### 13.1 Dimensiuni separate ale stării

| Dimensiune | Exemple de stări sau rezultate |
| --- | --- |
| Solicitare de campanie | Ciornă, Trimisă, În analiză, Modificări solicitate, Pregătită pentru confirmare, Respinsă |
| Ciclul de viață al campaniei confirmate | Confirmată, Activă, Finalizată, Anulată |
| Instanță individuală | Programată, Activă, Încheiată, Anulată |
| Aprobarea materialului publicitar | În așteptarea verificării, Aprobat, Respins |
| Distribuirea către controler | În așteptare, În transfer, Primire confirmată, Eșuată, Retragere în așteptare, Retrasă |
| Evaluarea difuzării | În așteptarea dovezilor, În analiză, Îndeplinită, Deficit de difuzare |
| Achiziție de credite | În așteptare, Confirmată, Eșuată; stările de reversare/rambursare depind de politică și de procesator |
| Solicitare de anulare | Depusă, Aprobată, Respinsă; progresul retragerii programului și al restituirii creditelor este urmărit separat |

Campaniile anulate parțial pot rămâne confirmate sau active pentru intervalele rămase. Încheierea programului nu înseamnă, în sine, că toate obligațiile de difuzare au fost îndeplinite. Se vor afișa rezumate agregate, calculate din instanțele individuale, în locul încercării de a exprima toate aceste sensuri într-un singur câmp de stare.

### 13.2 Înregistrări conceptuale

| Înregistrare | Scop |
| --- | --- |
| Client/cont | Identitate, datele organizației unde sunt necesare, permisiuni și apartenența campaniilor la client. |
| Camion și asocierea controlerelor/ecranelor | Resursele fizice și dispozitivele care primesc conținutul. |
| Traseu și interval publicat al traseului | Acoperire predefinită și perioade concrete de circulație. |
| Perioadă de indisponibilitate | Mentenanță sau alte perioade în care camionul nu poate fi rezervat. |
| Campanie | Cerințele publicitare ale clientului, apartenența la client, versiunea solicitării și ciclul de viață. |
| Intrare de programare și instanță | Selecția inițială, datată sau recurentă, și rezultatele ei concrete asociate unor date. |
| Solicitare de campanie pentru un interval al traseului | Intervalul selectat al traseului și numărul de camioane solicitat. |
| Rezervare de camion | Camion fizic alocat unei solicitări confirmate pentru un interval al traseului. |
| Regulă de tarifare și versiune salvată a calculului de preț | Configurația tarifelor și calculul istoric acceptat. |
| Cont de credite și tranzacție | Reprezentarea soldului disponibil și mișcări financiare trasabile. |
| Achiziție de credite | Referința plății cu cardul, valorile așteptate în bani și credite și rezultatul plății. |
| Material publicitar și aprobare | Versiunile conținutului încărcat și deciziile de verificare ale administratorului. |
| Sarcină de distribuire | Comenzi către controler, încercări, confirmări de primire și progresul retragerii programului. |
| Înregistrare de redare | Redare raportată de controler, asociată materialului și instanței relevante. |
| Solicitare de anulare | Intervale viitoare solicitate pentru anulare, decizia administratorului și legături către ajustările de credite. |

Câmpurile specifice furnizorilor și delimitarea finală a tabelelor trebuie stabilite după analiza controlerului și a procesatorului de plăți.

## 14. Scenarii de utilizare și criterii de acceptare

### 14.1 Scenarii principale de utilizare

| ID | Scenariu de utilizare | Condiție principală de acceptare |
| --- | --- | --- |
| US-01 | Ca client de publicitate, vreau să îmi accesez campaniile și contul de credite. | Alți clienți nu pot accesa sau modifica înregistrările mele. |
| US-02 | Ca client de publicitate, vreau să cumpăr credite cu cardul. | O plată reușită și verificată adaugă numărul corect de credite o singură dată. |
| US-03 | Ca client de publicitate, vreau să selectez mai multe intervale de traseu și numere de camioane într-o singură campanie. | Solicitarea păstrează fiecare traseu și cantitate selectată, inclusiv traseele paralele. |
| US-04 | Ca client de publicitate, vreau să fac selecții recurente. | Pot verifica lista completă a instanțelor datate și pot vedea instanțele lipsă sau indisponibile. |
| US-05 | Ca client de publicitate, vreau să înțeleg costul înainte de trimitere. | Defalcarea corespunde totalului calculat cu tarifele aplicabile traseului și intervalului. |
| US-06 | Ca client de publicitate, vreau să încarc imagini sau videoclipuri. | Conținutul are versiuni și este trimis spre aprobare, respectând limitele tehnice acceptate. |
| US-07 | Ca administrator, vreau să analizez întreaga campanie. | Pot verifica materialele, prețul, programul, soldul și conflictele înainte de confirmare. |
| US-08 | Ca administrator, vreau să confirm o campanie fezabilă. | Rezervarea integrală și o singură debitare de credite sunt înregistrate împreună sau nu se înregistrează niciuna. |
| US-09 | Ca operator, vreau ca programele aprobate să ajungă la controlere. | Progresul distribuirii și erorile sunt asociate camionului și instanței corecte. |
| US-10 | Ca client de publicitate, vreau să văd difuzarea raportată pentru campanie. | Intervalele programate, dovezile de redare primite și evaluările de difuzare încă nerezolvate pot fi diferențiate. |
| US-11 | Ca client de publicitate, vreau să solicit anularea intervalelor viitoare. | Pot selecta anumite intervale sau toate intervalele rămase, fără a modifica înregistrările finalizate. |
| US-12 | Ca administrator, vreau să procesez solicitările de anulare. | Modificările aprobate și restituirile de credite sunt trasabile, nu produc efecte duplicate la reîncercare și sunt asociate retragerii programului de pe controler. |

### 14.2 Scenarii importante de acceptare

| ID | Scenariu | Rezultat așteptat |
| --- | --- | --- |
| AC-01 | Fiecare instanță solicitată are capacitate disponibilă, iar soldul acoperă prețul acceptat. | Confirmarea manuală rezervă întreaga campanie și scade totalul o singură dată. |
| AC-02 | Unei instanțe îi lipsește un camion din numărul solicitat. | Nu este confirmată nicio parte a campaniei și nu sunt scăzute credite. |
| AC-03 | Clientul a cheltuit credite după trimiterea solicitării. | Confirmarea verifică din nou soldul și eșuează fără efecte parțiale dacă fondurile sunt insuficiente. |
| AC-04 | Două campanii concurează pentru aceeași capacitate de camioane. | Pot fi confirmate numai rezervări fezabile fizic. |
| AC-05 | Două confirmări simultane folosesc soldul aceluiași client. | Debitările cumulate nu pot cheltui credite indisponibile. |
| AC-06 | Administratorul apasă Confirmă de două ori sau solicitarea este reîncercată. | Există un singur rezultat confirmat, un singur set de rezervări și o singură debitare pentru campanie. |
| AC-07 | O notificare de plată este primită de mai multe ori. | Achiziția creditează portofelul o singură dată. |
| AC-08 | O plată eșuează sau rămâne în așteptare. | Portofelul nu primește creditele aferente achiziției. |
| AC-09 | Un interval rezervat traversează două intervale tarifare. | Fiecare segment folosește tariful corespunzător, iar totalul este corect conform regulii agreate de rotunjire. |
| AC-10 | O selecție recurentă include o instanță nepublicată sau indisponibilă. | Problema este afișată explicit, iar confirmarea integrală este împiedicată. |
| AC-11 | Același camion fizic este luat în calcul pe două trasee suprapuse. | Validarea disponibilității respinge alocarea respectivă. |
| AC-12 | Un tarif publicat se modifică după acceptarea prețului. | Sistemul respectă politica explicită de valabilitate a prețului și nu debitează fără informare un preț nou, neacceptat. |
| AC-13 | Un material publicitar aprobat este înlocuit. | Versiunea nouă necesită verificare și nu înlocuiește fără aprobare conținutul aprobat deja distribuit. |
| AC-14 | Controlerul acceptă conținutul, dar nu a sosit nicio înregistrare de redare. | Confirmarea primirii conținutului este afișată separat de evaluarea difuzării. |
| AC-15 | Înregistrările de redare sosesc târziu sau sunt duplicate. | Înregistrările sunt corelate cu instanța corectă fără dublarea totalurilor de difuzare. |
| AC-16 | Clientul solicită anularea. | Rezervările și creditele rămân neschimbate până la procesarea deciziei relevante a administratorului. |
| AC-17 | Administratorul aprobă anularea unor intervale viitoare selectate. | Se modifică doar intervalele vizate; cele finalizate și cele neafectate își păstrează înregistrările și prețurile rezervate. |
| AC-18 | O operațiune de anulare sau restituire a creditelor este reîncercată. | Nu apar efecte duplicate ale anulării sau restituiri duplicate. |
| AC-19 | Controlerul este deconectat în timpul retragerii programului. | Retragerea nerezolvată este vizibilă și respectă politica agreată de eliberare a capacității. |
| AC-20 | Reprogramarea nu trece verificarea disponibilității sau a acceptării prețului. | Rezervarea confirmată anterior este păstrată. |
| AC-21 | Un client încearcă să acceseze campania sau materialele altui client. | Accesul este refuzat. |

Acestea sunt criterii de acceptare pentru planificare. Documentul nu adaugă și nu execută teste automate. Implementarea trebuie să respecte instrucțiunile proiectului privind testarea și verificarea.

## 15. Plan de implementare și dependențe

Ordinea de mai jos este propusă. Estimările calendaristice necesită detaliile controlerului, deciziile privind politicile, dimensiunea flotei vizate și capacitatea de dezvoltare.

| Etapă | Rezultate livrabile | Condiție de finalizare / dependență |
| --- | --- | --- |
| M0 — Analiza integrării și a politicilor | Verificarea capacităților controlerului/API-ului; alegerea procesatorului de plăți; decizii privind tarifele, anulările și materialele. | Demonstrarea operațiunilor esențiale ale controlerului și rezolvarea politicilor care blochează implementarea. |
| M1 — Conturi, flotă și inventar | Apartenența datelor la clienți, evidența camioanelor/dispozitivelor, trasee predefinite, intervale publicate și perioade de indisponibilitate. | Administratorii pot configura programul real al flotei, iar clienții pot accesa doar propriile înregistrări. |
| M2 — Credite și plăți | Achiziție de credite cu cardul, rezultate ale plăților, portofel/registru de tranzacții și creditare fără dublări la reîncercare. | O plată verificată produce o singură creditare corectă; eșecurile și reîncercările sunt tratate corect. |
| M3 — Crearea și tarifarea campaniilor | Intervale specifice, generarea instanțelor recurente, cantități pe traseu, încărcarea materialelor, defalcarea prețului și salvarea versiunilor trimise. | O solicitare completă poate fi analizată împreună cu programul și costul exacte. |
| M4 — Analiză și confirmare | Verificarea materialelor, evaluarea disponibilității, confirmare manuală, rezervare și debitare atomice, explicarea conflictelor. | Solicitările concurente nu pot vinde aceeași capacitate de două ori și nu pot cheltui mai multe credite decât sunt disponibile. |
| M5 — Execuție prin controlere și raportare | Distribuirea conținutului, programe, confirmări de primire, colectarea înregistrărilor de redare și vizualizări ale difuzării. | Conținutul aprobat ajunge la dispozitivele vizate, iar redarea raportată este corelată cu instanțele rezervate. |
| M6 — Anulări și excepții operaționale | Anulare selectivă a intervalelor viitoare, restituiri conform politicii, retragerea programelor de pe controlere și rezolvarea problemelor de difuzare. | Excepțiile păstrează integritatea tranzacțiilor și nu modifică fără informare rezervări neafectate. |
| M7 — Pregătirea lansării pilot | Verificarea completă a criteriilor de acceptare, cu camioane, trasee, plăți și condiții de conectivitate reprezentative. | Fluxurile necesare și cazurile de eșec sunt demonstrate; blocajele de lansare rămase au responsabili desemnați. |

Verificarea timpurie a fezabilității integrării cu controlerul este necesară chiar dacă implementarea completă are loc ulterior. Gestionarea anulărilor și a excepțiilor de difuzare trebuie finalizată înaintea pilotului operațional, nu după ce clienții încep să depindă de serviciu.

## 16. Cerințe de calitate și indicatori de succes

### 16.1 Cerințe de calitate propuse

- Verificarea pe server a apartenenței datelor la client și a permisiunilor administratorului.
- Păstrarea secretelor de autentificare pentru controlere și plăți în afara configurației trimise către browser.
- Păstrarea unui istoric de audit pentru acceptarea prețurilor, deciziile de rezervare, aprobările materialelor, modificările de credite și deciziile de anulare.
- Folosirea unor reguli consecvente pentru fusuri orare și durate în recurențe, tarifare, controlere și raportare.
- Reîncercări sigure pentru plăți, confirmare, distribuirea conținutului, colectarea redărilor și restituirea creditelor.
- Explicarea erorilor într-un mod care permite clientului sau administratorului să acționeze.
- Păstrarea ciornelor și a referințelor la materialele încărcate, unde este cazul, după erori recuperabile.
- Navigare utilizabilă din tastatură și interfețe adaptate utilizării prevăzute în browsere desktop/mobile; o aplicație mobilă nativă nu este o cerință confirmată.
- Definirea înainte de lansare a obiectivelor privind recuperarea operațională, păstrarea datelor, copiile de siguranță și nivelul serviciului, fără inventarea unor ținte numerice în acest document.

### 16.2 Indicatori de succes propuși

| Indicator | Definiție de stabilit |
| --- | --- |
| Rata de conversie a rezervărilor | Numărul campaniilor confirmate împărțit la numărul campaniilor trimise, într-o perioadă definită. |
| Durata analizei administrative | Timpul de la trimitere până la prima analiză și până la decizia finală. |
| Gradul de utilizare a flotei | Camioane-oră rezervate raportate la camioane-oră eligibile oferite, cu tratarea consecventă a perioadelor blocate. |
| Gradul de îndeplinire a difuzării | Publicitate contractată și difuzată conform regulii agreate privind dovezile de redare. |
| Fiabilitatea distribuirii conținutului | Conținutul și programele necesare sunt confirmate de dispozitive înainte de începutul rezervării. |
| Rata anulărilor și a restituirilor de credite | Valoarea rezervărilor anulate și creditele restituite, grupate după motiv. |
| Rata clienților recurenți | Clienți care revin pentru campanii ulterioare într-o perioadă definită. |

Țintele și perioadele de raportare rămân de clarificat. Acoperirea audienței sau numărul de afișări către persoane nu trebuie deduse din deplasarea camioanelor sau din înregistrările dispozitivului de redare fără o metodă de măsurare agreată.

## 17. Dependențe și riscuri de rezolvat

| Dependență sau risc | Consecință asupra planificării | Acțiune următoare |
| --- | --- | --- |
| Platforma controlerului este necunoscută | Integrarea pentru încărcare, programare, anulare și redare nu poate fi estimată fiabil. | Obținerea producătorului/modelului/platformei și a documentației; efectuarea verificării de capacități din M0. |
| Programe păstrate local / controlere deconectate | Decizia de anulare poate preceda retragerea efectivă a programului. | Definirea comportamentului fără conexiune, a tratării confirmărilor și a regulilor de eliberare a capacității. |
| Camioane comune traseelor paralele | Totalurile pe trasee pot supraestima capacitatea reală a flotei. | Modelarea eligibilității camioanelor fizice și a alocărilor simultane. |
| Soldul se schimbă în timpul așteptării solicitării | Confirmarea unei campanii altfel aprobate poate eșua. | Afișarea soldului curent și solicitarea unei noi încercări de confirmare de către administrator după alimentare. |
| Lipsesc detalii despre tarife și politici | Ofertele, restituirile și calculele pentru situații-limită rămân ambigue. | Stabilirea valabilității prețurilor, a rotunjirii, a termenelor de anulare și a formulelor de restituire. |
| Înregistrări de redare incomplete sau întârziate | Difuzarea poate fi incertă, nu neapărat eșuată. | Definirea perioadelor de reconciliere și a cerințelor privind dovezile. |
| Reversările plăților cu cardul și rambursările în bani nu sunt definite | Ajustările portofelului și creditele deja cheltuite necesită tratare explicită. | Definirea politicilor procesatorului și ale companiei înainte de lansare. |
| Limitele tehnice ale controlerului pentru materiale sunt necunoscute | Validarea încărcărilor și necesarul de conversie nu pot fi finalizate. | Obținerea specificațiilor dispozitivului și stabilirea eventualului flux de conversie. |

## 18. Întrebări deschise și registrul deciziilor

Toate întrebările de mai jos sunt nerezolvate, cu excepția aspectelor delimitate explicit de un răspuns confirmat în altă parte a documentului. Responsabilii sugerați indică tipul de contribuție necesară, nu o persoană desemnată nominal.

| ID | Întrebare deschisă | Cine trebuie să răspundă / consecință |
| --- | --- | --- |
| O-01 | Ce producător/model de controler și ce platformă de administrare vor folosi camioanele? Ce documentație API este disponibilă? | Responsabilul de produs / furnizorul echipamentelor; blochează proiectarea și estimarea integrării. Vezi întrebarea Q-20. |
| O-02 | Câte ecrane/controlere are fiecare camion și ce trebuie redat pe fiecare pentru ca publicitatea exclusivă să fie considerată difuzată? | Operațiuni / furnizorul echipamentelor; afectează asocierea dispozitivelor, distribuirea și dovezile. |
| O-03 | Care sunt orașele de lansare, definițiile traseelor, dimensiunea inițială a flotei și orarele de circulație? | Responsabilul de produs / operațiuni; definește inventarul real. |
| O-04 | Camioanele sunt alocate permanent traseelor sau sunt interschimbabile? Sunt necesare reguli de eligibilitate și timpi suplimentari pentru deplasare și pregătire? | Operațiuni; definește alocarea fezabilă. |
| O-05 | Clienții pot selecta un anumit camion și trebuie să fie același camion la fiecare instanță? | Responsabilul de produs; afectează selecția și constrângerile de alocare. |
| O-06 | Ce tipuri de recurență, orizont de rezervare, termen minim în avans și reguli de oră locală/schimbare sezonieră a orei sunt acceptate? | Responsabilul de produs / echipa tehnică; definește generarea programului. |
| O-07 | Care sunt moneda, rata de conversie a creditelor și valorile permise pentru alimentarea contului? | Responsabilul de produs; necesar pentru cumpărarea creditelor. |
| O-08 | Care sunt tarifele efective pe traseu/interval, regulile pentru date speciale, prioritatea regulilor, precizia creditelor și politica de rotunjire? | Responsabilul de produs; necesar pentru tarifarea deterministă. |
| O-09 | Cât timp este valabil un preț trimis și cum sunt acceptate prețurile expirate sau revizuite? | Responsabilul de produs; necesar înainte de confirmare. |
| O-10 | Ce procesator de plăți cu cardul va fi folosit și ce cerințe se aplică documentelor de achiziție? | Responsabilul de produs / echipa tehnică; necesar pentru integrarea plăților. |
| O-11 | Soldul trebuie să acopere campania înainte de trimiterea solicitării sau doar la confirmare? | Responsabilul de produs; soldul suficient la confirmare este deja obligatoriu. |
| O-12 | Este necesară blocarea temporară a capacității camioanelor înainte de confirmare? | Responsabilul de produs / operațiuni; blocarea creditelor la trimitere nu este permisă. |
| O-13 | Ce termen-limită de anulare și ce formulă de restituire a creditelor se aplică? Politica diferă în funcție de interval, timpul de notificare sau motiv? | Responsabilul de produs; analiza anulării de către administrator este deja confirmată. |
| O-14 | Anularea poate reduce numărul de camioane dintr-un interval sau poate doar anula integral rezervările selectate pentru intervalele traseelor? | Responsabilul de produs; selecția la nivel de interval este deja confirmată. |
| O-15 | Când se eliberează capacitatea anulată dacă dispozitivul nu a confirmat retragerea programului? | Operațiuni / echipa tehnică; previne programările incompatibile. |
| O-16 | Ce înseamnă redare îndeplinită și cât timp pot rămâne în așteptare dovezile întârziate? | Responsabilul de produs / furnizorul echipamentelor; necesar pentru rapoartele de difuzare și contestații. |
| O-17 | Cum se rezolvă intervalele nedifuzate sau difuzate parțial: credite, intervale înlocuitoare sau altă măsură analizată de administrator? | Responsabilul de produs; necesar pentru excepțiile operaționale. |
| O-18 | Creditele expiră? Cum sunt gestionate rambursările în bani pentru creditele neutilizate și reversările plăților cu cardul? | Responsabilul de produs; necesar pentru politicile contului. |
| O-19 | Clienții se înregistrează singuri, sunt invitați sau sunt creați de administratori? Ce date ale companiei sunt necesare? | Responsabilul de produs; necesar pentru înregistrare. |
| O-20 | Ce formate de imagine/video, dimensiuni, codecuri, mărimi de fișier și durate sunt acceptate și este necesară conversia? | Documentația controlerului / echipa tehnică; necesar pentru încărcări. |
| O-21 | Fiecare campanie are un singur material publicitar sau materialele pot varia în funcție de traseu, instanță, camion ori ecran? | Responsabilul de produs; afectează modelul de conținut. |
| O-22 | Conținutul trebuie aprobat înainte de confirmarea rezervării și ce politică de verificare se aplică? | Responsabilul de produs; propunerea este aprobarea înainte de confirmare. |
| O-23 | Operațiunile necesită un rol separat, o interfață pentru șoferi sau o aplicație mobilă nativă? | Responsabilul de produs / operațiuni; niciuna nu este încă confirmată. |
| O-24 | Ce notificări sunt necesare, prin ce canale și pentru ce evenimente? | Responsabilul de produs; afectează comunicarea cu clienții și administratorii. |
| O-25 | Sunt necesare GPS/verificarea respectării traseului sau alte dovezi în plus față de înregistrările de redare? | Responsabilul de produs / furnizorul echipamentelor; doar integrarea înregistrărilor de redare este confirmată. |
| O-26 | Ce obiective de lansare, buget, personal, niveluri de serviciu, perioade de păstrare a datelor și cerințe de recuperare se aplică? | Responsabilul de produs / echipa tehnică; necesar pentru estimări și planificarea lansării. |

## 19. Întrebările și răspunsurile din etapa de analiză

Înregistrarea de mai jos păstrează toate întrebările de fond adresate în conversație și răspunsurile primite. Răspunsurile au fost ușor corectate ortografic și redactate pentru lizibilitate, apoi traduse, păstrându-și sensul. Răspunsurile inițiale clarificate ulterior sunt marcate corespunzător. Variantele nealese din întrebările cu răspuns multiplu nu reprezintă cerințe.

### Q-01 — Produsul și scopul

**Întrebare:** Ce produs sau modificare ar trebui să planificăm, cine îl va folosi și ce problemă ar trebui să rezolve? Dacă este vorba despre spațiul de lucru Camioane_App, poți spune pur și simplu acest lucru, iar eu voi verifica proiectul.

**Răspuns:** Vreau să construiesc o aplicație în care utilizatorii pot cumpăra publicitate pe camioane cu ecrane LED care circulă prin oraș.

**Întrebare introductivă asociată:** Planificăm Camioane_App? Dacă da, descrie scopul aplicației, cine o va folosi și o activitate obișnuită pe care utilizatorii ar trebui să o poată realiza.

**Ce acoperă răspunsul:** Descrierea de mai sus a stabilit conceptul aplicației de publicitate. Nu au fost furnizate separat un profil detaliat al clientului de publicitate și un scenariu reprezentativ al unui client real.

### Q-02 — Operarea camioanelor

**Întrebare:** Cine va furniza camioanele cu ecrane LED?

**Răspuns:** Compania mea va opera camioanele.

### Q-03 — Produsul publicitar

**Întrebare:** Ce ar trebui să poată cumpăra un client de publicitate?

**Răspuns:** Publicitate exclusivă pe un camion, pentru o perioadă.

### Q-04 — Fluxul inițial de rezervare

**Întrebare:** Cum ar trebui să gestioneze prima versiune rezervările?

**Răspuns:** Clientul trimite o solicitare pentru o campanie care se poate desfășura în mai multe intervale de timp.

**Clarificare:** Acest răspuns a stabilit solicitări de campanie care conțin mai multe intervale. Confirmarea de către administrator a fost precizată ulterior la Q-09.

### Q-05 — Numărul de camioane

**Întrebare:** Câte camioane ar trebui să poată solicita o campanie într-un singur interval de timp?

**Răspuns:** Mai multe camioane, cu un număr specificat pentru fiecare interval.

**Clarificare:** Q-12 a stabilit un număr separat pentru fiecare traseu dintr-un interval.

### Q-06 — Date specifice și recurență

**Întrebare:** Cum ar trebui clienții să introducă intervalele campaniei?

**Răspuns:** Atât date specifice, cât și programări recurente.

### Q-07 — Disponibilitate parțială

**Întrebare:** Dacă unele intervale solicitate sunt indisponibile, cum ar trebui să continue rezervarea?

**Răspuns:** Toate intervalele solicitate trebuie să fie disponibile înainte ca o campanie să poată continua.

### Q-08 — Modelul de tarifare, răspuns inițial

**Întrebare:** Cum ar trebui stabilit prețul unei campanii?

**Răspuns:** Utilizatorii vor cumpăra credite, iar prețul creditelor va varia în funcție de traseu, interval orar etc.

**Clarificare:** Q-11 a rezolvat ambiguitatea inițială: prețul de achiziție al creditelor este standard, iar consumul campaniei variază. Q-15 a stabilit creditele pe camion-oră ca unitate de tarifare.

### Q-09 — Autoritatea de confirmare

**Întrebare:** Ce ar trebui să transforme o campanie aprobată într-o rezervare confirmată care alocă respectivele camioane?

**Răspuns:** Administratorul confirmă manual rezervarea.

### Q-10 — Acoperire și trasee

**Întrebare:** Cum ar trebui clienții să precizeze unde vor circula camioanele?

**Răspuns:** Camioanele au trasee predefinite care funcționează în paralel.

### Q-11 — Prețul de achiziție al creditelor și consumul

**Întrebare:** Când spui că prețurile creditelor variază în funcție de traseu și de oră, la ce model te referi?

**Răspuns:** Creditele au un preț standard de achiziție; campaniile consumă numere diferite de credite în funcție de traseu și de oră.

### Q-12 — Mai multe trasee într-un interval

**Întrebare:** O campanie poate rezerva mai multe trasee predefinite în același interval de timp?

**Răspuns:** Da, cu un număr separat de camioane pentru fiecare traseu.

### Q-13 — Momentul angajării creditelor

**Întrebare:** Când ar trebui angajate creditele pentru o solicitare de campanie?

**Răspuns:** Creditele se scad când administratorul confirmă; soldul clientului se verifică din nou în acel moment.

### Q-14 — Orarul traseelor

**Întrebare:** Cum funcționează traseele predefinite?

**Răspuns:** Fiecare traseu are plecări programate la ore fixe sau intervale orare rezervabile.

### Q-15 — Unitatea de tarifare

**Întrebare:** Care ar trebui să fie unitatea de bază pentru calcularea costului campaniei în credite?

**Răspuns:** Credite pe camion-oră, cu tarife variabile în funcție de traseu și de intervalul tarifar.

### Q-16 — Metoda de cumpărare a creditelor

**Întrebare:** Cum ar trebui clienții să cumpere credite în prima versiune?

**Răspuns:** Prin plată online cu cardul, cu adăugarea creditelor după confirmarea plății.

### Q-17 — Analiza anulării

**Întrebare:** Cum ar trebui să funcționeze anulările campaniilor confirmate în prima versiune?

**Răspuns:** Clientul solicită anularea; administratorul analizează cererea și aplică politica agreată de restituire a creditelor.

**Clarificare:** Fluxul este confirmat; formula efectivă de restituire a creditelor și politica privind termenul-limită rămân fără răspuns.

### Q-18 — Sursa materialelor publicitare

**Întrebare:** Cum ar trebui furnizate materialele publicitare?

**Răspuns:** Clienții încarcă imagini sau videoclipuri în aplicație pentru aprobarea administratorului.

### Q-19 — Difuzarea pe ecrane și raportarea

**Întrebare:** Cum ar trebui prima versiune să transmită conținutul către ecranele camioanelor și să înregistreze finalizarea difuzării?

**Răspuns:** Aplicația se integrează cu controlerul ecranelor pentru a transmite conținutul și a colecta înregistrările de redare.

### Q-20 — Identificarea controlerului

**Întrebare:** Ce producător/model de controler LED și ce platformă de administrare a ecranelor vor folosi camioanele? Include un link către documentația API dacă îl ai; și răspunsul „nu a fost ales încă” este util. Nu am găsit documentație în directorul hardware_docs al proiectului.

**Răspuns:** Nu a fost furnizat încă.

**Stare:** De clarificat. Nu trebuie presupus un furnizor, un model, un API sau faptul că echipamentul nu a fost ales. Aceasta este decizia O-01 și principala dependență a integrării.

### Q-21 — Nivelul de detaliu al anulării

**Întrebare:** Ce ar trebui să poată solicita un client să anuleze după confirmare?

**Răspuns:** Intervale viitoare selectate sau toate intervalele rămase ale campaniei.

## 20. Acțiuni de planificare recomandate în continuare

1. Obținerea detaliilor și a documentației controlerului solicitate la Q-20.
2. Stabilirea politicilor de tarifare, restituire a creditelor, materiale publicitare și dovezi de difuzare care blochează implementarea.
3. Validarea fluxurilor și a criteriilor de acceptare propuse pe o campanie reprezentativă care include trasee paralele, recurență, o schimbare de interval tarifar și o anulare selectivă.
4. Transformarea cerințelor aprobate în sarcini de implementare, folosind ordinea etapelor din secțiunea 15 și criteriile de acceptare din secțiunea 14.
5. Estimarea implementării numai după verificarea fezabilității controlerului și finalizarea deciziilor de politică de care depind funcționalitățile.

Răspunsurile viitoare trebuie să actualizeze împreună registrul deciziilor, cerințele și criteriile de acceptare afectate, păstrând istoricul analizei.
