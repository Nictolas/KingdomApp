# MyKingdom — Orchi: pelle sempre verde

Data: 23 ottobre 2026. Decisione di design: ogni Orco deve avere la pelle verde, **in tutte le parti visibili del corpo**, indipendentemente da sesso, età, abbigliamento, professione e colore memorizzato nei salvataggi.

## Implementazione

- LPC: la testa orca `orc_male/orc_female` usa già una palette verde nel set originale `olive`, mentre gli sprite del corpo `olive` erano marroni. Creati 12 sheet `orc_green` per corpo `male`, `female`, `teen`, `child`, `pregnant`, `muscular`, per `idle` e `walk`, rimappando soltanto i cinque toni cutanei sul verde della testa e preservando il contorno scuro. Aggiunti 4 adattatori di testa verde per child/pregnant dal materiale teen/female esistente.
- `normalizeCharacterAppearance` forza `skinTone = "orc_green"` ogni volta che `race === "orc"`; sono inoltre allineati sesso e stile della testa.
- `appearanceAlignedToRazza` converte vecchi abitanti con `razza = "Orco"` anche quando il vecchio record LPC era umano.
- `generaAspettoCasuale("Orco")` assegna sia nel formato LPC sia nel formato legacy la pelle verde `#39aa4e`.
- `normalizzaAspettoOrco` converte gli aspetti dei vecchi salvataggi senza modificare nomi, capelli, abbigliamento o carattere. `saveValidation` aggiorna gli abitanti attivi e proposti al caricamento.
- Nell'editor di creazione del Re, per un orco non è mostrato il selettore di altri colori di pelle; compare l'indicazione che il verde è obbligatorio. `compatibleCatalogOptions` non presenta `orc_green` agli altri popoli.
- La testa resta su sprite già verdi `olive` ma, con `orc_green`, il resolver la abbina automaticamente al corpo appena creato.
- Script riproducibile `scripts/generate_orc_green_body.py`: genera sheet, record nel manifest e import statici Expo a partire dagli asset esistenti. Dipendenza di sviluppo Pillow (non richiesta a runtime).
- Test: `tests/orc-green-skin-required.test.ts` più allineamento di test legacy. Verificare sempre full tests, TypeScript e build web.

La modifica è una regola estetica, non una nuova caratteristica di gameplay. Il resto delle razze mantiene i propri colori precedenti.
