# Finanze v3

Web app personale per iPhone e Mac. Ogni persona accede con il proprio account Supabase. L’amministratore può invitarla via email da **Authentication → Users → Add user → Send invitation**.

## Uso

- In **Riepilogo** puoi cambiare mese e consultare entrate, uscite e ripartizioni.
- In **Movimenti** premi **+** per registrare un’entrata o una spesa. Per dividere una spesa attiva la ripartizione e indica l’importo di ogni quota. Tocca un movimento per modificarlo.
- In **Patrimonio** inserisci e aggiorna manualmente attività e passività.
- In **Dati** puoi impostare budget e tema, aggiornare la lettura dal cloud ed esportare i dati in JSON o i movimenti in CSV.

Serve una connessione per accedere, caricare i dati e confermare le modifiche. Il service worker conserva i file dell’interfaccia. I dati finanziari caricati restano nella memoria della pagina durante la sessione.

## Sviluppo

Il sito è statico e usa percorsi relativi compatibili con GitHub Pages. La configurazione pubblica del progetto è inclusa. La libreria client Supabase JS 2.119.0 è distribuita in `vendor/` con la sua licenza.

`database/transaction-version.sql` aggiunge il controllo della versione del movimento alla funzione di salvataggio già installata nel progetto. Il ramo di sviluppo conserva questa migrazione per rendere riproducibile la modifica.

## Categorie, analisi e backup

In **Dati → Categorie e sottocategorie** scegli il tipo di movimento e il gruppo. Puoi cambiare nome e posizione oppure archiviare una voce. Le quote registrate mantengono il nome storico. In **Riepilogo → Analisi per periodo** puoi confrontare mese, anno o date personalizzate e toccare una categoria per aprire i movimenti associati.

In **Dati** scegli il JSON della v2 e verifica il numero di movimenti, i totali e il budget nell’anteprima. La conferma scarica una copia dei dati correnti e avvia una singola operazione sul database. Un secondo invio dello stesso contenuto restituisce la ricevuta precedente. Sovrapposizioni parziali o budget incompatibili interrompono l’operazione. Per rimuovere il caricamento più recente usa **Annulla l’ultima importazione**. Se le voci sono state modificate, l’app interrompe l’annullamento. Conserva il file della v2. Il JSON compatibile con la v2 comprende movimenti, quote, patrimonio e budget. Le preferenze grafiche e le categorie prive di movimenti restano nelle impostazioni cloud.

## Ripristino della versione pubblicata

Per ripristinare il sito, crea su GitHub un revert del commit di pubblicazione e attendi la conclusione del deployment Pages. Riapri la PWA con rete disponibile. Una regressione dell’interfaccia richiede il ripristino dei file statici. Le migrazioni SQL aggiuntive possono restare installate. Per un errore di importazione usa la ricevuta personale descritta sopra. Evita di ripristinare globalmente il database per annullare l’operazione di una sola persona.
