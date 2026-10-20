/* =============================================================================
   PayEnCash — NOTIFICATIONS ET BANNIÈRES (payencash-notif.js)
   ============================================================================= */
(function (window) {
  'use strict';
  window.PEC_NOTIF = window.PEC_NOTIF || {
    afficher: function (msg, type) {
      console.log('[PEC_NOTIF]', type || 'info', msg);
    },
    nonVues: function () { return 0; },
    marquerVues: function () {}
  };
})(window);
