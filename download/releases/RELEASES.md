# AutoScribe Desktop App Releases

## Version 2.0.1

**Released:** August 2026  
**Electron:** 33  
**electron-builder:** 25

---

### 🍎 macOS

| Chip | File | Size |
|------|------|------|
| Intel (x64) | `autoScriber-2.0.1.dmg` | 94 MB |
| Intel (x64) | `autoScriber-2.0.1-mac.zip` | 91 MB |
| Apple Silicon (arm64) | `autoScriber-2.0.1-arm64.dmg` | 89 MB |
| Apple Silicon (arm64) | `autoScriber-2.0.1-arm64-mac.zip` | 86 MB |

**Installation:**
1. Download the DMG or ZIP for your chip
2. Open DMG → drag AutoScribe to Applications (or extract the ZIP)
3. First launch: right-click → **Open** (bypasses Gatekeeper — app is unsigned)

**System Requirements:** macOS 10.13 or later

---

### 🪟 Windows

| Edition | File | Size |
|---------|------|------|
| Universal (Recommended) | `autoScriber-2.0.1.exe` | 136 MB |
| 64-bit | `autoScriber-2.0.1-x64.exe` | 72 MB |
| 32-bit | `autoScriber-2.0.1-ia32.exe` | 64 MB |
| Portable (64-bit) | `autoScriber-2.0.1-x64-portable.exe` | — |

**Installation:**
1. Download the appropriate installer
2. Run the `.exe` file
3. Follow the installation wizard

**System Requirements:** Windows 7 or later

---

### 🐧 Linux

| Format | File | Size |
|--------|------|------|
| AppImage (Universal) | `autoScriber-2.0.1.AppImage` | 99 MB |

**Installation:**
```bash
chmod +x autoScriber-2.0.1.AppImage
./autoScriber-2.0.1.AppImage
```

**System Requirements:** Ubuntu 18.04+ or equivalent (any modern Linux distribution)

---

## Checksums

To verify file integrity:

```bash
# macOS / Linux
shasum -a 256 autoScriber-2.0.1.dmg

# Windows (PowerShell)
Get-FileHash autoScriber-2.0.1.exe -Algorithm SHA256
```

---

## Known Issues

1. **macOS:** App is not code-signed — right-click → Open on first launch
2. **Windows:** Windows Defender may warn about an unsigned app — click More info → Run anyway
3. **Linux DEB:** Not included in this release; use AppImage (works on all distributions)

---

## Support

For issues, questions, or feature requests, visit the [main repository](https://github.com/divyo-argha/AutoScriber).
