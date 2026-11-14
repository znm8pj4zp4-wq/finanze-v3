# Le mie finanze — Web app per iPhone

Questo pacchetto contiene una piccola app per registrare manualmente entrate e spese e tenere una fotografia del patrimonio.

## Come metterla su iPhone (senza sviluppare in Swift)

1. Crea un account GitHub (se non lo hai) e un repository pubblico con un nome come `finanze-iphone`.
2. Carica nella cartella principale del repository **tutti i file estratti da questo ZIP** (non caricare solo lo ZIP).
3. Vai nel repository > Settings > Pages > Build and deployment: `Deploy from a branch`, branch `main`, cartella `/(root)` > Save.
4. Quando la pubblicazione è pronta, apri da Safari iPhone l'indirizzo `https://TUO-UTENTE.github.io/finanze-iphone/`.
5. In Safari usa Condividi > Aggiungi alla schermata Home > **Apri come app web** > Aggiungi.
6. **Solo a questo punto** inserisci i dati veri: Safari e app installata possono avere memorie distinte.

## Come funziona

- In **Riepilogo** visualizzi i totali del mese, il tasso di risparmio, il budget, il trend di 6 mesi e le categorie.
- Il pulsante verde **+** aggiunge entrate e uscite. Tocca un movimento per modificarlo o eliminarlo.
- In **Patrimonio** inserisci manualmente liquidità, depositi, investimenti e debiti. Il patrimonio non viene modificato automaticamente dai movimenti.
- In **Dati** trovi budget mensile, backup JSON, import e CSV per Excel o Numbers.
- In **Dati > Aggiungi esempi** puoi provare il funzionamento con operazioni dimostrative.

## Privacy e attenzione

Questa app **non ha un server di salvataggio** e non richiede un account bancario. I dati vengono memorizzati tramite `localStorage` del browser/app sul dispositivo. Il repository GitHub pubblico contiene solo **il codice**, non i movimenti che inserisci nell'app. Non caricare mai lì il tuo file di backup.

I dati **non vengono sincronizzati automaticamente** tra iPhone e altri dispositivi. Un cambio telefono, l'eliminazione dell'app o la pulizia dei dati dei siti può farli sparire. **Esporta regolarmente il backup JSON e salvalo su iCloud Drive**; verifica occasionalmente di saperlo importare.

Se la pagina è già stata aperta in Safari prima di aggiungerla alla Home, esporta da Safari un backup prima dell'installazione: le memorie potrebbero essere distinte.

Non introdurre PIN, password, IBAN completi o numeri di carte. Non si tratta di un software bancario certificato; i totali dipendono dalle registrazioni manuali. Per rendere i dati sincronizzati e più protetti occorrerà un backend autenticato, con cifratura e backup.

Una volta installata e caricata almeno una volta con internet, il service worker può consentire l'apertura offline. Per aggiornare il codice, sostituisci i file del repository e aumenta la versione `CACHE` in `sw.js`.
