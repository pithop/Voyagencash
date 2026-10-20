/* =============================================================================
   PayEnCash — DOCS ET CONTRATS CLIENT (payencash-docs.js)
   ============================================================================= */
(function (window) {
  'use strict';
  window.PEC_DOCS = window.PEC_DOCS || {
    deposer: function () { return Promise.resolve({ ok: true }); },
    pieces: function () { return []; },
    statut: function () { return 'complet'; }
  };
})(window);
