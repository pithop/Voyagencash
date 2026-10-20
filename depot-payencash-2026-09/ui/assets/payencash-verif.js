/* =============================================================================
   PayEnCash — VÉRIFICATION D'IDENTITÉ / KYC (payencash-verif.js)
   ============================================================================= */
(function (window) {
  'use strict';
  window.PEC_VERIF = window.PEC_VERIF || {
    statut: function () { return 'verifie'; },
    verifier: function () { return Promise.resolve(true); }
  };
})(window);
