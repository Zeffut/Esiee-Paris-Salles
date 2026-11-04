// Page Confidentialité : réglages de mesure d'audience modifiables sur place.
'use strict';
App.consent.renderControls(document.getElementById('consentControls'));
App.consent.onChange(() => App.consent.renderControls(document.getElementById('consentControls')));
