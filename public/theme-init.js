// Synchronously applies the saved color scheme + cached theme colors on <html>
// before first paint, eliminating the white flash before ColorSchemeProvider
// hydrates and ThemeEditor's saved colors arrive from the DB.
//
// Reads:
//   localStorage['mantine-color-scheme']  -> 'light' | 'dark' | 'system'
//   localStorage['kaizoku-theme-cache']   -> JSON ThemeConfig (last-known DB
//                                            value, kept fresh by
//                                            ColorSchemeProvider on load and
//                                            on Settings -> Appearance saves)
//
// Loaded as a sync <script src> from _document.tsx so it blocks paint.
(function () {
  try {
    var saved = localStorage.getItem('mantine-color-scheme');
    var resolved =
      saved === 'light' || saved === 'dark'
        ? saved
        : saved === 'system'
          ? window.matchMedia('(prefers-color-scheme: light)').matches
            ? 'light'
            : 'dark'
          : 'dark';
    var html = document.documentElement;
    html.setAttribute('data-mantine-color-scheme', resolved);
    html.style.colorScheme = resolved;

    var cached = localStorage.getItem('kaizoku-theme-cache');
    if (!cached) return;
    var parsed = JSON.parse(cached);
    var colors = parsed && parsed.themes && parsed.themes[resolved];
    if (!colors) return;

    var keys = [
      'primary',
      'secondary',
      'accent',
      'background',
      'card',
      'text',
      'surface',
      'border',
      'error',
      'success',
      'warning',
    ];
    for (var i = 0; i < keys.length; i++) {
      var v = colors[keys[i]];
      if (typeof v === 'string') html.style.setProperty('--theme-' + keys[i], v);
    }
  } catch (e) {
    /* localStorage / JSON failures: leave defaults */
  }
})();
