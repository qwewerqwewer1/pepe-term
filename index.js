const { app, BrowserWindow, ipcMain } = require("electron");
const pty = require("node-pty");
const os = require("os");

app.disableHardwareAcceleration();

let mainWindow;
const terminals = {}; // { id: ptyProcess }

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    transparent: true,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile("index.html");

  ipcMain.on("create-terminal", (event, id) => {
    const shell = os.platform() === "win32" ? "powershell.exe" : "bash";
    const ptyProcess = pty.spawn(shell, [], {
      name: "xterm-color",
      cols: 80,
      rows: 30,
      cwd: process.env.HOME,
      env: process.env,
    });

    terminals[id] = ptyProcess;
    ptyProcess.onData((data) =>
      mainWindow.webContents.send(`data-${id}`, data),
    );
  });

  ipcMain.on("terminal-outData", (event, { id, data }) => {
    if (terminals[id]) terminals[id].write(data);
  });

  ipcMain.on("terminal-resize", (event, { id, cols, rows }) => {
    if (terminals[id]) terminals[id].resize(cols, rows);
  });

  ipcMain.on("close-terminal", (event, id) => {
    if (terminals[id]) {
      terminals[id].kill();
      delete terminals[id];
    }
  });
}

app.whenReady().then(createWindow);
