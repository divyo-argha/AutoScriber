const COMPONENTS_READY = 'autoscriber:components-loaded';

const COMPONENTS = ['nav', 'hero', 'features', 'models', 'pipeline', 'download', 'about', 'footer'];

async function loadComponents() {
  try {
    await Promise.all(
      COMPONENTS.map(async (name) => {
        const mount = document.querySelector(`[data-component="${name}"]`);
        if (!mount) return;
        const res = await fetch(`components/${name}/${name}.html`);
        if (!res.ok) throw new Error(`fetch failed for ${name}: ${res.status}`);
        mount.innerHTML = await res.text();
      })
    );
  } catch (err) {
    console.error('autoScriber component loader:', err);
  }
  document.dispatchEvent(new CustomEvent(COMPONENTS_READY));
  initRevealObserver();
}

function initRevealObserver() {
  const observer = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add('visible');
      }),
    { threshold: 0.12 }
  );
  document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
}

function scrollToDownload() {
  const el = document.getElementById('download');
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

loadComponents();