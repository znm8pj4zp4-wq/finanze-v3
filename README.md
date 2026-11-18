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

La migrazione dei backup v2, la gestione delle categorie personali e il collaudo su iPhone fisico sono in sviluppo. Conservare il backup originale della v2.
