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

// Detect Linux distro from userAgent
function detectLinuxDistro() {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('ubuntu')) return 'ubuntu';
  if (ua.includes('fedora')) return 'fedora';
  if (ua.includes('debian')) return 'debian';
  if (ua.includes('arch')) return 'arch';
  return 'linux';
}

// OS detection
function detectOS() {
  const ua = navigator.userAgent;
  const platform = navigator.platform || '';
  if (/Mac/.test(ua)) {
    // Detect Apple Silicon via canvas/hardwareConcurrency heuristic
    // Most reliable: check for arm in platform or use media query
    const isArm = /arm/i.test(platform) || (navigator.hardwareConcurrency >= 8 && /Mac/.test(ua));
    return isArm ? 'mac-arm' : 'mac-intel';
  }
  if (/Win/.test(ua)) return 'windows';
  if (/Linux/.test(ua)) return detectLinuxDistro();
  return 'mac-arm';
}

const dlMap = {
  'mac-arm':   { label: 'Download for Apple Silicon', url: 'https://github.com/divyo-argha/AutoScriber/releases/download/v2.0.1/autoScriber-2.0.1-arm64.dmg' },
  'mac-intel': { label: 'Download for Intel Mac',     url: 'https://github.com/divyo-argha/AutoScriber/releases/download/v2.0.1/autoScriber-2.0.1.dmg' },
  'windows':   { label: 'Download for Windows',       url: 'https://github.com/divyo-argha/AutoScriber/releases/download/v2.0.1/autoScriber-2.0.1.exe' },
  'linux':     { label: 'Download for Linux',         url: 'https://github.com/divyo-argha/AutoScriber/releases/download/v2.0.1/autoScriber-2.0.1.AppImage' },
  'ubuntu':    { label: 'Download for Ubuntu',        url: 'https://github.com/divyo-argha/AutoScriber/releases/download/v2.0.1/autoScriber-2.0.1.AppImage' },
  'fedora':    { label: 'Download for Fedora',        url: 'https://github.com/divyo-argha/AutoScriber/releases/download/v2.0.1/autoScriber-2.0.1.AppImage' },
  'debian':    { label: 'Download for Debian',        url: 'https://github.com/divyo-argha/AutoScriber/releases/download/v2.0.1/autoScriber-2.0.1.AppImage' },
  'arch':      { label: 'Download for Arch Linux',    url: 'https://github.com/divyo-argha/AutoScriber/releases/download/v2.0.1/autoScriber-2.0.1.AppImage' },
};

const os = detectOS();
const heroBtn = document.getElementById('hero-download-btn');
const heroLabel = document.getElementById('hero-dl-label');
const entry = dlMap[os] || dlMap['mac-arm'];
heroLabel.textContent = entry.label;
heroBtn.onclick = () => window.location.href = entry.url;

// Auto-select matching tab
const osToTab = { 'mac-arm': 'mac', 'mac-intel': 'mac', 'windows': 'windows', 'linux': 'linux', 'ubuntu': 'linux', 'fedora': 'linux', 'debian': 'linux', 'arch': 'linux' };
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
