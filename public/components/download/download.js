import { detectOS, dlMap, osToTab } from '../../js/os-detect.js';

const COMPONENTS_READY = 'autoscriber:components-loaded';

export function initDownload() {
  const os = detectOS();
  const entry = dlMap[os] || dlMap['mac-arm'];

  const heroBtn = document.getElementById('hero-download-btn');
  const heroLabel = document.getElementById('hero-dl-label');
  if (heroLabel) heroLabel.textContent = entry.label;
  if (heroBtn) {
    heroBtn.addEventListener('click', () => {
      window.location.href = entry.url;
    });
  }

  activateTab(os);

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.download-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = document.getElementById(`panel-${btn.dataset.os}`);
      if (panel) panel.classList.add('active');
    });
  });

  document.querySelectorAll('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', () => copyCmd(btn));
  });
}

function activateTab(os) {
  const tab = osToTab[os] || 'mac';
  document.querySelectorAll('.tab-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.os === tab);
  });
  document.querySelectorAll('.download-panel').forEach((p) => {
    p.classList.toggle('active', p.id === `panel-${tab}`);
  });
}

function copyCmd(btn) {
  const code = btn.previousElementSibling.textContent;
  navigator.clipboard.writeText(code).then(() => {
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = 'Copy';
      btn.classList.remove('copied');
    }, 2000);
  });
}

document.addEventListener(COMPONENTS_READY, initDownload);
if (document.querySelector('.tab-btn')) initDownload();