# AutoScribe Desktop App Releases

## Version 1.0.0

Built on: May 31, 2026

### macOS

#### Intel (x64)
- **AutoScribe-1.0.0.dmg** (94 MB) - DMG installer for Intel Macs
- **AutoScribe-1.0.0-mac.zip** (91 MB) - ZIP archive for Intel Macs

#### Apple Silicon (arm64)
- **AutoScribe-1.0.0-arm64.dmg** (89 MB) - DMG installer for M series Macs
- **AutoScribe-1.0.0-arm64-mac.zip** (86 MB) - ZIP archive for M series Macs

**Installation:**
1. Download the appropriate DMG or ZIP for your Mac
2. Open the DMG and drag AutoScribe to Applications, or extract the ZIP
3. First launch: Right-click → Open (to bypass Gatekeeper since the app is not signed)

**System Requirements:** macOS 10.13 or later

---

### Windows

#### Installers
- **AutoScribe-1.0.0.exe** (136 MB) - Universal installer (includes both x64 and ia32)
- **AutoScribe-1.0.0-x64.exe** (72 MB) - 64-bit installer
- **AutoScribe-1.0.0-ia32.exe** (64 MB) - 32-bit installer

**Installation:**
1. Download the appropriate installer
2. Run the .exe file
3. Follow the installation wizard
4. Choose installation directory (default: C:\Users\YourName\AppData\Local\Programs\AutoScribe)

**System Requirements:** Windows 7 or later

---

### Linux (Ubuntu)

#### AppImage
- **AutoScribe-1.0.0.AppImage** (99 MB) - Universal Linux application

**Installation:**
1. Download the AppImage
2. Make it executable: `chmod +x AutoScribe-1.0.0.AppImage`
3. Run: `./AutoScribe-1.0.0.AppImage`

**System Requirements:** Ubuntu 18.04 or later (works on most modern Linux distributions)

**Note:** DEB packages were not included in this release due to build issues on macOS. AppImage is the recommended format for Linux users as it works across all distributions.

---

## Build Information

- **Electron Version:** 28.3.3
- **Builder:** electron-builder 24.13.3
- **Build Platform:** macOS (darwin)
- **Node.js:** Compatible with Node 16+

## Checksums

To verify the integrity of your download, you can generate checksums:

```bash
# macOS/Linux
shasum -a 256 AutoScribe-1.0.0.dmg

# Windows (PowerShell)
Get-FileHash AutoScribe-1.0.0.exe -Algorithm SHA256
```

## Known Issues

1. **macOS:** App is not code-signed, so you need to right-click → Open on first launch
2. **Windows:** Windows Defender may show a warning since the app is not signed
3. **Linux:** DEB packages are not available in this release; use AppImage instead

## Support

For issues, questions, or feature requests, please visit the main repository.
