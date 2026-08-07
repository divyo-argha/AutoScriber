export function detectLinuxDistro() {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('ubuntu')) return 'ubuntu';
  if (ua.includes('fedora')) return 'fedora';
  if (ua.includes('debian')) return 'debian';
  if (ua.includes('arch')) return 'arch';
  return 'linux';
}

export function detectOS() {
  const ua = navigator.userAgent;
  const platform = navigator.platform || '';
  if (/Mac/.test(ua)) {
    const isArm = /arm/i.test(platform) || (navigator.hardwareConcurrency >= 8 && /Mac/.test(ua));
    return isArm ? 'mac-arm' : 'mac-intel';
  }
  if (/Win/.test(ua)) return 'windows';
  if (/Linux/.test(ua)) return detectLinuxDistro();
  return 'mac-arm';
}

export const dlMap = {
  'mac-arm': { label: 'Download for Apple Silicon', url: 'https://github.com/divyo-argha/AutoScriber/releases/download/v3.0.0/autoScriber-3.0.0-arm64.dmg' },
  'mac-intel': { label: 'Download for Intel Mac', url: 'https://github.com/divyo-argha/AutoScriber/releases/download/v3.0.0/autoScriber-3.0.0.dmg' },
  'windows': { label: 'Download for Windows', url: 'https://github.com/divyo-argha/AutoScriber/releases/download/v3.0.0/autoScriber-3.0.0.exe' },
  'linux': { label: 'Download for Linux', url: 'https://github.com/divyo-argha/AutoScriber/releases/download/v3.0.0/autoScriber-3.0.0.AppImage' },
  'ubuntu': { label: 'Download for Ubuntu', url: 'https://github.com/divyo-argha/AutoScriber/releases/download/v3.0.0/autoScriber-3.0.0.AppImage' },
  'fedora': { label: 'Download for Fedora', url: 'https://github.com/divyo-argha/AutoScriber/releases/download/v3.0.0/autoScriber-3.0.0.AppImage' },
  'debian': { label: 'Download for Debian', url: 'https://github.com/divyo-argha/AutoScriber/releases/download/v3.0.0/autoScriber-3.0.0.AppImage' },
  'arch': { label: 'Download for Arch Linux', url: 'https://github.com/divyo-argha/AutoScriber/releases/download/v3.0.0/autoScriber-3.0.0.AppImage' },
};

export const osToTab = {
  'mac-arm': 'mac',
  'mac-intel': 'mac',
  'windows': 'windows',
  'linux': 'linux',
  'ubuntu': 'linux',
  'fedora': 'linux',
  'debian': 'linux',
  'arch': 'linux',
};