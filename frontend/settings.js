// =============================================================================
// THEME (appliqué immédiatement pour éviter le flash)
// =============================================================================
(function() {
  if (localStorage.getItem('themeVersion') !== '2') {
    localStorage.removeItem('theme');
    localStorage.setItem('themeVersion', '2');
  }
  const saved = localStorage.getItem('theme');
  if (saved === 'light' || saved === 'dark') {
    document.documentElement.setAttribute('data-theme', saved);
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    if (!saved) localStorage.setItem('theme', 'auto');
  }
})();

// =============================================================================
// SETTINGS PAGE
// =============================================================================
document.addEventListener('DOMContentLoaded', function() {

  // Scroll header
  window.addEventListener('scroll', () => {
    const fixedHeader = document.querySelector('.fixed-header');
    if (fixedHeader) fixedHeader.classList.toggle('scrolled', window.scrollY > 10);
  }, { passive: true });

  // Theme selector
  function applyThemePref(value) {
    if (value === 'auto') {
      localStorage.setItem('theme', 'auto');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      localStorage.setItem('theme', value);
      document.documentElement.setAttribute('data-theme', value);
    }
    syncThemeSelector();
  }

  function syncThemeSelector() {
    const saved = localStorage.getItem('theme') || 'auto';
    document.querySelectorAll('.theme-option').forEach(btn => {
      const active = btn.dataset.value === saved;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  document.querySelectorAll('.theme-option').forEach(btn => {
    btn.addEventListener('click', () => applyThemePref(btn.dataset.value));
  });

  syncThemeSelector();

  // Préférence système en temps réel (si thème = auto)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if ((localStorage.getItem('theme') || 'auto') === 'auto') {
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    }
  });
});
