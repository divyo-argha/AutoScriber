const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const http = require('http');

let mainWindow;

function startServer() {
  const serverPath = path.join(process.resourcesPath, 'app', 'server.js');
  const serverDir = path.dirname(serverPath);

  process.env.PORT = process.env.PORT || '3000';

  // Set DATABASE_URL to user data directory so it persists across app updates
  const fs = require('fs');
  const dbDir = app.getPath('userData');
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  process.env.DATABASE_URL = `file:${path.join(dbDir, 'dev.db')}`;

  process.chdir(serverDir);

  // Initialize database tables using raw SQL via bundled Prisma client
  try {
    const { PrismaClient } = require(path.join(serverDir, 'node_modules', '@prisma', 'client'));
    const prisma = new PrismaClient();
    Promise.all([
      prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "TranscriptionJob" ("id" TEXT NOT NULL PRIMARY KEY, "fileName" TEXT NOT NULL, "fileSize" INTEGER NOT NULL, "duration" REAL, "status" TEXT NOT NULL DEFAULT 'pending', "controlStatus" TEXT NOT NULL DEFAULT 'running', "progress" INTEGER NOT NULL DEFAULT 0, "model" TEXT NOT NULL DEFAULT 'gemini-2.5-flash', "language" TEXT NOT NULL DEFAULT 'bn', "chunksTotal" INTEGER NOT NULL DEFAULT 0, "chunksDone" INTEGER NOT NULL DEFAULT 0, "errorMessage" TEXT, "result" TEXT, "audioPath" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
      prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "AppSettings" ("id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default', "geminiApiKey" TEXT NOT NULL DEFAULT '', "geminiApiBaseUrl" TEXT NOT NULL DEFAULT '', "sonioxApiKey" TEXT NOT NULL DEFAULT '', "defaultModel" TEXT NOT NULL DEFAULT 'gemini-2.5-flash', "chunkDuration" INTEGER NOT NULL DEFAULT 300, "overlapDuration" INTEGER NOT NULL DEFAULT 10)`),
    ]).then(async () => {
      // Ensure the sonioxApiKey column exists in case AppSettings was created in an older version
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "AppSettings" ADD COLUMN "sonioxApiKey" TEXT NOT NULL DEFAULT ''`);
        console.log('Database migrated successfully (added sonioxApiKey).');
      } catch (e) {
        // Ignored if column already exists
      }
      // Ensure the controlStatus column exists for pause/resume/cancel support
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "TranscriptionJob" ADD COLUMN "controlStatus" TEXT NOT NULL DEFAULT 'running'`);
        console.log('Database migrated successfully (added controlStatus).');
      } catch (e) {
        // Ignored if column already exists
      }
      console.log('DB tables ready.');
      prisma.$disconnect();
    })
      .catch(e => console.error('DB init error:', e.message));
  } catch (e) {
    console.error('DB init failed:', e.message);
  }

  try {
    require(serverPath);
    console.log('Server started in-process at http://localhost:3000');
  } catch (error) {
    console.error('Failed to start server in-process:', error);
  }
}

function waitForServer(host = '127.0.0.1', port = 3000, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeout;

    const check = () => {
      const req = http.request({ host, port, method: 'HEAD', path: '/' }, (res) => {
        res.destroy();
        resolve();
      });

      req.on('error', (err) => {
        if (Date.now() > deadline) {
          reject(err);
        } else {
          setTimeout(check, 500);
        }
      });

      req.on('timeout', () => {
        req.destroy();
        if (Date.now() > deadline) {
          reject(new Error('Server readiness check timed out'));
        } else {
          setTimeout(check, 500);
        }
      });

      req.setTimeout(2000);
      req.end();
    };

    check();
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1280,
    minHeight: 860,
    title: 'autoScriber',
    icon: path.join(__dirname, 'icon.png'),
    useContentSize: true,
    autoHideMenuBar: false,
    frame: true,
    titleBarStyle: 'default',
    backgroundColor: '#f8fafc',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true);
    } else {
      callback(false);
    }
  });

  const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    startServer();

    try {
      await waitForServer('127.0.0.1', 3000, 30000);
      mainWindow.loadURL('http://127.0.0.1:3000');
    } catch (err) {
      console.error('Could not connect to local server:', err);
      mainWindow.loadURL('data:text/html,<h1>Failed to start app server</h1><p>Check console logs for details.</p>');
    }
  }

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Renderer failed to load:', errorCode, errorDescription, validatedURL);
    mainWindow.loadURL('data:text/html,<h1>Renderer load failed</h1><p>Please check the app console logs.</p>');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Custom menu
  const template = [
    {
      label: 'autoScriber',
      submenu: [
        { label: 'About autoScriber', selector: 'orderFrontStandardAboutPanel:' },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'Command+Q', click: () => app.quit() },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', selector: 'undo:' },
        { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', selector: 'redo:' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', selector: 'cut:' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', selector: 'copy:' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', selector: 'paste:' },
        { label: 'Select All', accelerator: 'CmdOrCtrl+A', selector: 'selectAll:' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => mainWindow.reload() },
        { label: 'Toggle DevTools', accelerator: 'Alt+CmdOrCtrl+I', click: () => mainWindow.webContents.toggleDevTools() },
        { type: 'separator' },
        { label: 'Actual Size', accelerator: 'CmdOrCtrl+0', click: () => mainWindow.webContents.setZoomLevel(0) },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', click: () => mainWindow.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() + 0.5) },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: () => mainWindow.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() - 0.5) },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  app.on('ready', createWindow);

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (mainWindow === null) {
      createWindow();
    }
  });
}
