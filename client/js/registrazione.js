
/*
Questo è un "contenitore" di sicurezza. Dice al browser Non eseguire questo codice 
JavaScript finché l'intera pagina HTML non è stata caricata e analizzata. 
altrimenti document.getElementById('formRegistrazione') potrebbe fallire perché l'HTML del form non esiste ancora
*/
document.addEventListener('DOMContentLoaded', function() {
      const tipoUtenteSelect = document.getElementById('tipoUtente');
      const campiCliente = document.getElementById('campi-cliente');
      const campiRistorante = document.getElementById('campi-ristorante');
      const formRegistrazione = document.getElementById('formRegistrazione');
      
      // gestione cambio tipo utente, ascolta evento change sul menu a tendina tipoUtenteSelect
      tipoUtenteSelect.addEventListener('change', function() {
        const tipoUtente = this.value;
        
        // nascondi tutti i campi condizionali
        campiCliente.classList.add('d-none');
        campiRistorante.classList.add('d-none');
        
        // rimuovi attributi required dai campi nascosti, li mette required dopo in abse all utente
        const allConditionalInputs = document.querySelectorAll('#campi-cliente input, #campi-ristorante input');
        allConditionalInputs.forEach(input => {
            input.removeAttribute('required');
        });
        
        // mostra i campi appropriati in base alla selezione
        if (tipoUtente === 'cliente') {
            campiCliente.classList.remove('d-none');

            // solo nome e cognome sono obbligatori per il cliente,  telefono e indirizzo sono opzionali
            document.getElementById('nome').required = true;
            document.getElementById('cognome').required = true;
            
        } else if (tipoUtente === 'ristorante') {
            campiRistorante.classList.remove('d-none');
            // Solo nomeRistorante e partitaIVA sono obbligatori per il ristorante
            document.getElementById('nomeRistorante').required = true;
            document.getElementById('partitaIva').required = true;
           
        }
      });
      
      // gestione invio form, QUI USA FETCH
      //ascolta evento submit sul form, e è l'ggetto evento che viene passato alla funzione
      formRegistrazione.addEventListener('submit', async  function(e) {


        
        //previene comportamento predefinito del form (che ricaricherebbe la pagina), vogliamo sia js a gestire l'invio
        e.preventDefault();
        
        const tipoUtente = tipoUtenteSelect.value;
        
        if (!tipoUtente) {
            alert('Seleziona un tipo di utente');
            return;
        }
        
        // raccolta dati in base al tipo di utente, in un oggetto js.
        let userData = {
            ruolo: tipoUtente,
            email: document.getElementById('email').value,
            password: document.getElementById('password').value
        };
        
        //completo in base a tipo utente
        if (tipoUtente === 'cliente') {
            userData.nome = document.getElementById('nome').value;
            userData.cognome = document.getElementById('cognome').value;
            userData.telefono = document.getElementById('telefonoCliente').value;
            userData.indirizzo = document.getElementById('indirizzo').value;
        } else if (tipoUtente === 'ristorante') {
            userData.nomeRistorante = document.getElementById('nomeRistorante').value;
            userData.partitaIVA = document.getElementById('partitaIva').value;
            userData.telefono = document.getElementById('telefonoRistorante').value;
            userData.indirizzo = document.getElementById('indirizzoRistorante').value;
        }
        

        //VERSIONE CON  register() DA auth.js
        const result = await register(userData);
        
        if (result.success) {
            alert('✅ Registrazione completata!');
            window.location.href = '/login.html';
        } else {
            // Mostra errori di validazione dettagliati se presenti
            if (result.validationErrors) {
                let errorMsg = '❌ Errori di validazione:\n\n';
                result.validationErrors.forEach(err => {
                    errorMsg += `• ${err.campo}: ${err.messaggio}\n`;
                });
                alert(errorMsg);
            } else {
                alert('❌ Errore: ' + result.message);
            }
        }

        /*
        VERSIONE CON fetch DIRETTO
        

    //con await chiediamo a js di aspettare finche il server no da una risposta.
    // { ...} è l'oggetto opzioni. headers indica che sto inviando i dati in formato json al server
    // stringify converte l'oggetto js in stringa json (non si possono inviare idrettamente oggetti jw)
        try {
          const response = await fetch('/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(userData)
          });

          //risultato contiene la risposta del server, DICIAMO DI INTERPRETARLO COME JSON E CONVERTIRLO IN OGGETTO JS.
          //continene informazioni sull'operazione (tra 200 e 299 è andato tutto bene, altrimenti errore)
          const result = await response.json();

          //response.ok è true se status code è tra 200 e 299, scorciatoia per response.status >=200 && response.status <300
          //se true continene anche un message. 
          if (response.ok && result.message) {
              alert('✅ ' + result.message);
              window.location.href = '/login.html'; //reindirizzo al login
          } else {
              alert('❌ Errore: ' + (result.message || result.error || 'Registrazione fallita'));
          }
        } catch (error) {
          console.error('Errore di rete:', error);
            alert('❌ Errore di connessione. Controlla che il server sia attivo.');
        }
        
        // reindirizzamento (esempio)
        // window.location.href = 'login.html';
        */

      });

      
    });