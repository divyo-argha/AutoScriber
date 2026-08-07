const COMPONENTS_READY = 'autoscriber:components-loaded';

export function initNav() {
  const nav = document.getElementById('nav');
  if (!nav) return;

  const onScroll = () => {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

document.addEventListener(COMPONENTS_READY, initNav);
if (document.getElementById('nav')) initNav();