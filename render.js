const { Terminal } = require("xterm");
const { FitAddon } = require("xterm-addon-fit");
const { ipcRenderer } = require("electron");

let tabs = {}; // Хранилище: { id: { term, fitAddon, tabBtn, container } }
let activeTabId = null;

/**
 * Создание новой вкладки
 */
function createTab() {
  const id = `tab-${Date.now()}`;

  // 1. Создаем кнопку вкладки
  const tabBtn = document.createElement("div");
  tabBtn.className = "tab";
  tabBtn.onclick = () => switchTab(id);

  // Текст вкладки
  const tabTitle = document.createElement("span");
  tabTitle.innerText = `Terminal ${Object.keys(tabs).length + 1} `;
  tabBtn.appendChild(tabTitle);

  // Иконка закрытия
  const closeIcon = document.createElement("span");
  closeIcon.innerText = "✕";
  closeIcon.className = "close-tab-btn";
  closeIcon.onclick = (e) => closeTab(id, e);
  tabBtn.appendChild(closeIcon);

  // Вставляем кнопку в панель перед плюсиком
  document
    .getElementById("tabs-container")
    .insertBefore(tabBtn, document.getElementById("add-tab-btn"));

  // 2. Создаем контейнер для терминала
  const container = document.createElement("div");
  container.className = "term-instance";
  document.getElementById("terms-wrapper").appendChild(container);

  // 3. Инициализируем xterm.js
  const term = new Terminal({
    cursorBlink: true,
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: 14,
    allowTransparency: true,
    theme: {
      background: "transparent",
      foreground: "#ffffff",
      cursor: "#00ff00",
      selection: "rgba(0, 255, 0, 0.3)",
    },
  });

  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  term.open(container);

  // Сохраняем данные вкладки
  tabs[id] = { term, fitAddon, tabBtn, container };

  // 4. Запускаем процесс в бэкенде
  ipcRenderer.send("create-terminal", id);

  // Слушаем данные от бэкенда
  const dataListener = (event, data) => term.write(data);
  ipcRenderer.on(`data-${id}`, dataListener);
  tabs[id].dataListener = dataListener; // Сохраняем ссылку для удаления позже

  // Отправляем ввод пользователя в бэкенд
  term.onData((data) => {
    ipcRenderer.send("terminal-outData", { id, data });
  });

  // Переключаемся на новую вкладку
  switchTab(id);
}

/**
 * Переключение между вкладками
 */
function switchTab(id) {
  if (!tabs[id]) return;

  // Снимаем активный класс со всех
  Object.keys(tabs).forEach((tid) => {
    tabs[tid].container.classList.remove("active");
    tabs[tid].tabBtn.classList.remove("active");
  });

  // Активируем нужную
  tabs[id].container.classList.add("active");
  tabs[id].tabBtn.classList.add("active");
  activeTabId = id;

  // Подгоняем размер с задержкой, чтобы DOM успел отрисоваться
  setTimeout(() => {
    tabs[id].fitAddon.fit();
    ipcRenderer.send("terminal-resize", {
      id,
      cols: tabs[id].term.cols,
      rows: tabs[id].term.rows,
    });
  }, 20);
}

/**
 * Закрытие вкладки
 */
function closeTab(id, event) {
  if (event) event.stopPropagation(); // Чтобы не сработал switchTab

  // 1. Убиваем процесс в бэкенде и чистим слушатели
  ipcRenderer.send("close-terminal", id);
  ipcRenderer.removeListener(`data-${id}`, tabs[id].dataListener);

  // 2. Удаляем элементы из DOM
  tabs[id].tabBtn.remove();
  tabs[id].container.remove();

  // 3. Уничтожаем объект терминала
  tabs[id].term.dispose();
  delete tabs[id];

  // 4. Логика переключения после закрытия
  if (activeTabId === id) {
    const remainingIds = Object.keys(tabs);
    if (remainingIds.length > 0) {
      switchTab(remainingIds[remainingIds.length - 1]);
    } else {
      activeTabId = null;
      createTab(); // Если закрыли последнюю — создаем новую
    }
  }
}

// --- Глобальные обработчики ---

// Кнопка "+"
document.getElementById("add-tab-btn").onclick = createTab;

// Кнопка закрытия приложения
document.getElementById("close-app").onclick = () => window.close();

// Изменение размера окна
window.onresize = () => {
  if (activeTabId) {
    tabs[activeTabId].fitAddon.fit();
    ipcRenderer.send("terminal-resize", {
      id: activeTabId,
      cols: tabs[activeTabId].term.cols,
      rows: tabs[activeTabId].term.rows,
    });
  }
};

// Поддержка вставки текста (Ctrl+V)
window.addEventListener("paste", (e) => {
  if (activeTabId) {
    const text = e.clipboardData.getData("text");
    ipcRenderer.send("terminal-outData", { id: activeTabId, data: text });
  }
});

// Запуск первой вкладки при загрузке
createTab();
