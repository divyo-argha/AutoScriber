// Nav scroll effect
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 20);
});

// Reveal on scroll
const observer = new IntersectionObserver(
  (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
  { threshold: 0.12 }
);
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// OS detection → set hero download button
function detectOS() {
  const ua = navigator.userAgent;
  if (/Mac/.test(ua) && /arm/.test(navigator.platform || '')) return 'mac-arm';
  if (/Mac/.test(ua)) return 'mac-intel';
  if (/Win/.test(ua)) return 'windows';
  if (/Linux/.test(ua)) return 'linux';
  return 'mac-arm';
}

const dlMap = {
  'mac-arm':   { label: 'Download for Apple Silicon', url: 'https://github.com/divyo-argha/AutoScriber/releases/download/v1.0.0/AutoScribe-1.0.0-arm64.dmg' },
  'mac-intel': { label: 'Download for Intel Mac',     url: 'https://github.com/divyo-argha/AutoScriber/releases/download/v1.0.0/AutoScribe-1.0.0.dmg' },
  'windows':   { label: 'Download for Windows',       url: 'https://github.com/divyo-argha/AutoScriber/releases/download/v1.0.0/AutoScribe-1.0.0.exe' },
  'linux':     { label: 'Download for Linux',         url: 'https://github.com/divyo-argha/AutoScriber/releases/download/v1.0.0/AutoScribe-1.0.0.AppImage' },
};

const os = detectOS();
const heroBtn = document.getElementById('hero-download-btn');
const heroLabel = document.getElementById('hero-dl-label');
heroLabel.textContent = dlMap[os].label;
heroBtn.onclick = () => window.location.href = dlMap[os].url;

// Auto-select matching tab in download section
const osToTab = { 'mac-arm': 'mac', 'mac-intel': 'mac', 'windows': 'windows', 'linux': 'linux' };
function activateTab(os) {
  const tab = osToTab[os] || 'mac';
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.os === tab));
  document.querySelectorAll('.download-panel').forEach(p => p.classList.toggle('active', p.id === `panel-${tab}`));
}
activateTab(os);

// Tab click
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.download-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`panel-${btn.dataset.os}`).classList.add('active');
  });
});

// Copy command
function copyCmd(btn) {
  const code = btn.previousElementSibling.textContent;
  navigator.clipboard.writeText(code).then(() => {
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
  });
}

// Scroll to download
function scrollToDownload() {
  document.getElementById('download').scrollIntoView({ behavior: 'smooth' });
}
