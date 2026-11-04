// PostHog Analytics — fichier externe pour respecter la CSP script-src 'self'.
// Proxifié via /ingest, région EU.
//
// RGPD : PostHog n'est PLUS démarré automatiquement. core.js appelle
// window.startPostHog() uniquement si la personne a cliqué « Accepter » dans le
// bandeau de consentement (choix conservé 6 mois, modifiable dans Profil).
window.startPostHog = function startPostHog() {
  if (window.__posthogStarted) return;
  window.__posthogStarted = true;
!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug getPageViewId captureTraceFeedback captureTraceMetric".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
  posthog.init('phc_zdMj4p5wo8EvfVApjb2EbfUHJ76zgYGM5wAGz5YJC359', {
    api_host: '/ingest',
    ui_host: 'https://eu.posthog.com',
    person_profiles: 'identified_only',
    autocapture: true,
    capture_pageview: true,
    capture_pageleave: true,
    capture_performance: true,
    capture_exceptions: true,
    rageclick: true,
    enable_heatmaps: true,
    persistence: 'localStorage+cookie',
    respect_dnt: true,
    session_recording: {
      // Les saisies (recherche…) sont masquées dans les enregistrements de session,
      // et la fenêtre de connexion Google n'est jamais enregistrée.
      maskAllInputs: true,
      recordCrossOriginIframes: false
    }
  });
  // Super property envoyée avec TOUS les events
  posthog.register({ app: 'esiee-salles' });
};
