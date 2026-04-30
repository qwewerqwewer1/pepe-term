const { ipcRenderer } = require("electron");

function setupTerminalHelpers(term, fitAddon) {
  // Логика изменения размера
  const fitTerminal = () => {
    fitAddon.fit();
    ipcRenderer.send("terminal-resize", {
      cols: term.cols,
      rows: term.rows,
    });
  };

  window.onresize = fitTerminal;
  setTimeout(fitTerminal, 100);

  // Логика кнопки закрытия
  const closeBtn = document.getElementById("close-app");
  if (closeBtn) {
    closeBtn.onclick = () => window.close();
  }

  // Логика вставки
  window.onpaste = (e) => {
    ipcRenderer.send("terminal-outData", e.clipboardData.getData("text"));
  };

  return fitTerminal; // Возвращаем функцию на случай ручного вызова
}

module.exports = { setupTerminalHelpers };
