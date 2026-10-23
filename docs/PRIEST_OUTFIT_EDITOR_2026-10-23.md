# Editor dell'abito sacerdotale — vincoli

23 ottobre 2026 — MyKingdom, PR #265.

Quando il Re personalizza l'abito del sacerdote nelle Religioni, l'editor riutilizza la componentistica LPC della creazione del personaggio, ma non e' un editor di identita'.

- La modalita' outfit visualizza solo Busto, Maniche, Veste, Mantello, Pantaloni, Gonne, Scarpe e Calze.
- Identita', Capelli e Sorprendimi rimangono accessibili nell'editor del Re, ma non per gli abiti sacerdotali.
- L'anteprima outfit e' chiamata "Anteprima abito", senza indicare un'eta' specifica.
- Le patch LPC sono filtrate per escludere razza, corporatura, pelle, occhi, barba, capelli e altre componenti non indossabili.
- Anche al salvataggio vengono copiati soltanto i campi di abbigliamento sul modello iniziale, mantenendo inalterata l'identita'.
- Verifiche: tests/priest-outfit-editor-scope.test.ts — filtro patch, salvataggio identita', schede e modalita' Re.

Le modifiche sono nella PR #265: non diventano visibili sul sito prima di merge e deploy.
