/**
 * The Brandora shell: theme, language, the opening animation and scroll reveals.
 *
 * Loaded on every page. Kept to one file and one request because §72 and §63
 * point at the same reality — this product is used on a phone, often on a slow
 * connection, and every extra round trip is a second of blank screen for someone
 * deciding whether to trust it.
 *
 * Nothing here is required for the page to work. The HTML is complete and
 * readable with JavaScript switched off; this adds preference, motion and
 * translation on top.
 */

(function () {
  'use strict';

  document.documentElement.classList.remove('no-js');

  /* --- Theme (§6, §7) ---------------------------------------------------- */

  var THEME_KEY = 'brandora.theme';

  /**
   * Dark is not Brandora's default — it is Brandora's *primary experience* (§6).
   * The polished black surface with one purple highlight is the brand, in the
   * same way the logo is, so a first visit shows it whatever the operating
   * system happens to prefer.
   *
   * A person's own choice is a different matter and always wins. Once someone
   * has picked light, they get light on every page and every visit (§7) — the
   * brand gets the first impression, the user gets every one after that.
   */
  function preferredTheme() {
    try {
      var stored = localStorage.getItem(THEME_KEY);
      if (stored === 'dark' || stored === 'light') return stored;
    } catch (err) {
      // Private browsing, or storage disabled. The brand default still applies.
    }
    return 'dark';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#FBFAFC' : '#050507');

    var toggles = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < toggles.length; i += 1) {
      toggles[i].setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
      var label = toggles[i].querySelector('[data-theme-label]');
      if (label) label.textContent = themeLabel(toggles[i], theme);
    }
  }

  /**
   * The word on the theme button, in the reader's language.
   *
   * This used to be `theme === 'light' ? 'Light' : 'Dark'`, which put an English
   * word in the header of every page in all three languages — the exact "Votre
   * compte / Something went wrong" mix the brief calls out, sitting in the one
   * control that appears on every single screen. It survived this long because
   * the label is written by script and so carries no `data-i18n` for the
   * translation pass to find.
   *
   * Three sources, most specific first:
   *
   *   1. `data-label-dark` / `data-label-light` on the button itself. A
   *      single-language page carries its own words and needs no catalogue —
   *      that is how the French launch page says "Sombre" without loading one.
   *   2. The translation catalogue, once it has loaded.
   *   3. English, the authored fallback used everywhere else in this file.
   */
  function themeLabel(toggle, theme) {
    var attr = toggle.getAttribute(theme === 'light' ? 'data-label-light' : 'data-label-dark');
    if (attr) return attr;
    var translated = translate(theme === 'light' ? 'theme.light' : 'theme.dark');
    if (translated) return translated;
    return theme === 'light' ? 'Light' : 'Dark';
  }

  function setTheme(theme) {
    applyTheme(theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (err) {
      // The preference simply does not persist. The page still works.
    }
  }

  applyTheme(preferredTheme());

  document.addEventListener('click', function (event) {
    var toggle = event.target.closest ? event.target.closest('[data-theme-toggle]') : null;
    if (!toggle) return;
    setTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
  });

  /* --- Language (§23) ----------------------------------------------------- */

  var LOCALE_KEY = 'brandora.locale';
  var SUPPORTED = ['en', 'fr', 'es'];

  /**
   * French unless the visitor has said otherwise.
   *
   * Brandora sells to small businesses in Côte d'Ivoire. This used to read
   * `navigator.languages` and fall back to English, so a baker in Abidjan whose
   * phone shipped configured in English — which most do — landed on an English
   * page for a French product. The browser's language is a fact about the
   * handset, not about the person holding it.
   *
   * An explicit choice still wins and is remembered. `?lang=en` wins over that,
   * so a link can be shared in a particular language without the recipient's
   * stored preference overriding it.
   */
  var DEFAULT_LOCALE = 'fr';

  function preferredLocale() {
    try {
      var fromUrl = new URLSearchParams(window.location.search).get('lang');
      if (SUPPORTED.indexOf(fromUrl) !== -1) return fromUrl;
    } catch (err) {
      // No URLSearchParams, or no search string. Fall through.
    }
    try {
      var stored = localStorage.getItem(LOCALE_KEY);
      if (SUPPORTED.indexOf(stored) !== -1) return stored;
    } catch (err) {
      // Ignored, as above.
    }
    return DEFAULT_LOCALE;
  }

  var catalogue = {};

  function translate(key, vars) {
    // `catalogue` is a hoisted `var`, so it is still `undefined` during the
    // first `applyTheme` call above — which runs before this section is
    // reached. Indexing it there would be a TypeError at module scope, which
    // stops the entire script and leaves the page with no theme, no language
    // and no navigation. Guarded rather than reordered, because the theme has
    // to be applied before first paint and the catalogue arrives over the
    // network.
    var template = catalogue && catalogue[key];
    if (!template) return null;
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, function (whole, name) {
      return Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole;
    });
  }

  /**
   * Apply the catalogue to the page.
   *
   * `data-i18n` swaps text; `data-i18n-attr` swaps an attribute, which is what
   * placeholders, titles and aria-labels need. A key with no translation leaves
   * the markup alone rather than blanking it — the English in the HTML is a
   * working fallback, not filler.
   */
  function applyLocale(locale) {
    document.documentElement.setAttribute('lang', locale);

    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i += 1) {
      var value = translate(nodes[i].getAttribute('data-i18n'));
      if (value !== null) nodes[i].textContent = value;
    }

    var attrNodes = document.querySelectorAll('[data-i18n-attr]');
    for (var j = 0; j < attrNodes.length; j += 1) {
      var pairs = attrNodes[j].getAttribute('data-i18n-attr').split(',');
      for (var k = 0; k < pairs.length; k += 1) {
        var parts = pairs[k].split(':');
        var translated = translate(parts[1]);
        if (translated !== null) attrNodes[j].setAttribute(parts[0].trim(), translated);
      }
    }

    var switches = document.querySelectorAll('[data-locale-switch]');
    for (var m = 0; m < switches.length; m += 1) switches[m].value = locale;

    // The theme button's label is written by script, so the pass above cannot
    // reach it. Re-applying the current theme rewrites it from the catalogue
    // that has just loaded — without this, switching to French translates the
    // whole header except the one control next to the switcher.
    applyTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');

    // Translated: the text may be shown. Removed here rather than only on the
    // head script's timeout, so on a fast connection nobody waits 1.2 seconds.
    document.documentElement.removeAttribute('data-i18n-pending');

    document.dispatchEvent(new CustomEvent('brandora:locale', { detail: { locale: locale, t: translate } }));
  }

  function loadLocale(locale) {
    return fetch('locales/' + locale + '.json')
      .then(function (response) {
        if (!response.ok) throw new Error('locale ' + locale + ' unavailable');
        return response.json();
      })
      .then(function (data) {
        catalogue = data;
        applyLocale(locale);
      })
      .catch(function () {
        // The page keeps its authored English. A failed translation fetch must
        // never leave someone looking at an empty interface.
        applyLocale(locale);
      });
  }

  loadLocale(preferredLocale());

  document.addEventListener('change', function (event) {
    if (!event.target.hasAttribute || !event.target.hasAttribute('data-locale-switch')) return;
    var locale = event.target.value;
    try {
      localStorage.setItem(LOCALE_KEY, locale);
    } catch (err) {
      // Not persisted; still applied for this visit.
    }
    loadLocale(locale);
  });

  window.brandoraTranslate = translate;

  /* --- The opening film (§9) ---------------------------------------------- */

  var video = document.querySelector('[data-film-video]');
  if (video) {
    /**
     * Decide whether this visitor should download 8.5MB of video.
     *
     * Brandora is built for people who often pay for data by the megabyte
     * (§63), so the film is opt-out by connection rather than opt-in by luck.
     * Three things veto it: an explicit Data Saver setting, a connection the
     * browser reports as 2G, and a reduced-motion preference. In each case the
     * poster stands in, and it is a real poster — the logo and the wordmark —
     * not a grey box.
     */
    var shouldLoadFilm = function () {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;

      var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (connection) {
        if (connection.saveData === true) return false;
        if (connection.effectiveType === 'slow-2g' || connection.effectiveType === ' 2g' || connection.effectiveType === '2g') {
          return false;
        }
      }
      return true;
    };

    var toggle = document.querySelector('[data-film-toggle]');
    var toggleLabel = document.querySelector('[data-film-toggle-label]');
    var filmLogo = document.querySelector('[data-film-logo]');

    // Set once the source turns out to be undecodable. Everything else checks
    // it, so a late-arriving `play()` rejection cannot re-offer a broken film.
    var filmFailed = false;

    var setToggle = function (playing) {
      if (!toggle || filmFailed) return;
      toggle.hidden = false;
      toggle.firstElementChild.textContent = playing ? '❚❚' : '▶';
      if (toggleLabel) toggleLabel.textContent = playing ? 'Pause' : 'Play';
      toggle.setAttribute('aria-pressed', playing ? 'false' : 'true');
    };

    /** The lockup belongs on screen whenever the film is not carrying it. */
    var showLogo = function (visible) {
      if (!filmLogo) return;
      filmLogo.style.transition = 'opacity 0.8s ease';
      filmLogo.style.opacity = visible ? '1' : '0';
    };

    if (shouldLoadFilm()) {
      /**
       * If the file cannot be decoded, stop offering to play it.
       *
       * A `<video>` keeps showing its poster when the source fails, so the hero
       * still looks right — but a Pause button over a still frame is a control
       * that lies. Browsers without H.264 exist (Chromium built without
       * proprietary codecs is the common one), and so do half-downloaded files.
       */
      video.addEventListener('error', function () {
        filmFailed = true;
        if (toggle) toggle.hidden = true;
        showLogo(true);
      });

      // The film resolves to the logo, so the static lockup steps aside while it
      // runs and comes back the moment it stops.
      video.addEventListener('playing', function () {
        showLogo(false);
        setToggle(true);
      });
      video.addEventListener('pause', function () {
        showLogo(true);
        setToggle(false);
      });

      video.src = video.getAttribute('data-src');
      video.load();

      // `play()` rejects when a browser declines autoplay. That is not an error
      // worth surfacing — the poster is already showing something worth looking
      // at, so the control simply offers to start it.
      var attempt = video.play();
      if (attempt && typeof attempt.then === 'function') {
        attempt.then(function () { setToggle(true); }).catch(function () { setToggle(false); });
      } else {
        setToggle(true);
      }

      if (toggle) {
        toggle.addEventListener('click', function () {
          if (video.paused) {
            video.play().then(function () { setToggle(true); }).catch(function () { setToggle(false); });
          } else {
            video.pause();
            setToggle(false);
          }
        });
      }

      // A film playing behind a page nobody is looking at is spent battery.
      document.addEventListener('visibilitychange', function () {
        if (document.hidden && !video.paused) video.pause();
      });
    }
  }

  /* --- Reveal on scroll --------------------------------------------------- */

  var revealables = document.querySelectorAll('[data-reveal]');
  if (revealables.length && 'IntersectionObserver' in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    for (var n = 0; n < revealables.length; n += 1) observer.observe(revealables[n]);
  } else {
    for (var p = 0; p < revealables.length; p += 1) revealables[p].classList.add('is-visible');
  }

  /* --- Current page in the navigation ------------------------------------- */

  var here = window.location.pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
  var links = document.querySelectorAll('.site-nav a');
  for (var q = 0; q < links.length; q += 1) {
    var target = links[q].getAttribute('href').replace(/\.html$/, '').replace(/^\.\//, '');
    if (target && here.indexOf(target) !== -1 && target !== '') {
      links[q].setAttribute('aria-current', 'page');
    }
  }
})();
