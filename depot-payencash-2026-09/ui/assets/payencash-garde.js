/* =============================================================================
   PayEnCash — GARDE ET SESSIONS (payencash-garde.js)
   Ne bloque jamais la navigation en mode démo / prévisualisation Vercel.
   ============================================================================= */
(function (window) {
  'use strict';
  window.PEC_GARDE = window.PEC_GARDE || {
    estConnecte: function () { return true; },
    utilisateur: function () {
      return {
        id: 'usr_demo',
        nom: 'Voyageur Démo',
        email: 'client@payencash.fr',
        points: 120
      };
    },
    proteger: function () { return true; }
  };
})(window);
