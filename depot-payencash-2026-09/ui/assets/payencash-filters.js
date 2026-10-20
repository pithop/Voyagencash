/* =============================================================================
   PayEnCash — FILTRES ET RECHERCHE CLIENTE (payencash-filters.js)
   ============================================================================= */
(function (window, document) {
  'use strict';

  function initFilters() {
    // Gestion des champs de recherche instantanée data-fsearch
    document.querySelectorAll('input[data-fsearch]').forEach(function (inp) {
      if (inp._boundSearch) return;
      inp._boundSearch = true;
      var targetSel = inp.getAttribute('data-fsearch');
      inp.addEventListener('input', function () {
        var q = (this.value || '').trim().toLowerCase();
        var items = document.querySelectorAll(targetSel);
        var visibleCount = 0;
        items.forEach(function (el) {
          var txt = (el.textContent || '').toLowerCase();
          var match = !q || txt.indexOf(q) !== -1;
          el.style.display = match ? '' : 'none';
          if (match) visibleCount++;
        });
        var vide = document.querySelector('[data-fvide="' + targetSel + '"]');
        if (vide) {
          if (visibleCount === 0 && q) {
            var tpl = vide.getAttribute('data-fvide-txt') || 'Aucun résultat.';
            vide.textContent = tpl.replace('%q', q);
            vide.style.display = 'block';
          } else {
            vide.style.display = 'none';
          }
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFilters);
  } else {
    initFilters();
  }

  window.PEC_FILTERS = {
    init: initFilters
  };
})(window, document);
