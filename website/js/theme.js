const THEME_ATTR = 'data-theme';
const THEME_KEY = 'theme';
const COMPONENTS_READY = 'autoscriber:components-loaded';

const SUN_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;

const MOON_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

let initialized = false;

export function initTheme() {
  if (initialized) return;

  const toggle = document.querySelector('[data-action="toggle-theme"]');
  if (!toggle) return;

  initialized = true;

  const storedTheme = localStorage.getItem(THEME_KEY);
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialTheme = storedTheme || (systemPrefersDark ? 'dark' : 'light');

  setTheme(initialTheme);

  toggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute(THEME_ATTR);
    setTheme(currentTheme === 'dark' ? 'light' : 'dark');
  });

  const systemMedia = window.matchMedia('(prefers-color-scheme: dark)');
  const onSystemChange = (event) => {
    if (!localStorage.getItem(THEME_KEY)) {
      setTheme(event.matches ? 'dark' : 'light');
    }
  };
  if (systemMedia.addEventListener) {
    systemMedia.addEventListener('change', onSystemChange);
  } else if (systemMedia.addListener) {
    systemMedia.addListener(onSystemChange);
  }
}

function setTheme(theme) {
  document.documentElement.setAttribute(THEME_ATTR, theme);
  localStorage.setItem(THEME_KEY, theme);
  updateThemeIcon(theme);
}

function updateThemeIcon(theme) {
  const iconContainer = document.querySelector('#theme-toggle-icon');
  if (!iconContainer) return;
  iconContainer.innerHTML = theme === 'dark' ? SUN_ICON : MOON_ICON;
}

document.addEventListener(COMPONENTS_READY, initTheme);
if (document.querySelector('[data-action="toggle-theme"]')) initTheme();