const { app, Menu, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

const w = { min: 300, max: 1000 };
const h = { min: 320, max: 1000 };

let config;
const configPath = path.join(__dirname, "noteconfig.json");

let mainWindow = null;
const activeNoteWindows = {};

// Exposed handlers ============================================================

const handleOpenNoteWindow = (e, name = `note${config.windows.length}`) => {
	if (activeNoteWindows.hasOwnProperty(name)) {
		activeNoteWindows[name].focus();
		return false;
	}

	const opts = { show: false, frame: false, width: w.min, height: h.min, minWidth: w.min, minHeight: h.min, maxWidth: w.max, maxHeight: h.max, backgroundColor: "#b8fc90", webPreferences: { preload: path.join(__dirname, "preload.js") }, icon: path.join(__dirname, "app", "src", "icon", "256x256.png") }
	let windowIndex = config.windows.findIndex(e => e.windowName === name);

	if (windowIndex > -1) {
		const cfg = config.windows[windowIndex];
		
		if (cfg.hasOwnProperty("width")) opts.width = cfg.width;
		if (cfg.hasOwnProperty("height")) opts.height = cfg.height;
		if (cfg.hasOwnProperty("bgcolor")) opts.backgroundColor = cfg.bgcolor;
		if (cfg.hasOwnProperty("xPos") && cfg.hasOwnProperty("yPos")) {
			opts.x = cfg.xPos;
			opts.y = cfg.yPos;
		}
	} else {
		config.windows.push({ "windowName": name, "windowTitle": "My new note", "width": w.min, "height": h.min, "bgcolor": "#b8fc90", windowContent: "" });
		windowIndex = config.windows.length - 1;
	}
	
	activeNoteWindows[name] = new BrowserWindow(opts);

	const win = activeNoteWindows[name];
	const cfg = config.windows[windowIndex];
	
	const hasPosition = cfg.hasOwnProperty("yPos") && cfg.hasOwnProperty("xPos");
	if (!hasPosition) {
		win.center();
		const pos = win.getPosition();
		const data = { xPos: pos[0], yPos: pos[1] };
		Object.assign(config.windows[windowIndex], data);
	}

	config.windows[windowIndex].isOpen = true;
	config.windows[windowIndex].windowID = win.id;

	win.on("move", e => storeWindowGeometry(e));
	win.on("resize", e => storeWindowGeometry(e));
	win.once("ready-to-show", () => win.show());
	win.loadURL(path.join("file://", __dirname, "app", "note", "note.html"));

	return name;
};

const handleDeleteNote = async (e, name) => {
	const res = await dialog.showMessageBox(mainWindow, {
        "type": "question",
        "title": "Confirm Delete",
        "message": "Are you sure you want to delete the note?",
        "buttons": [ "Yes", "No" ]
    });

	if (res.response === 0) {
		const win = BrowserWindow.fromId(getWindowIDFromName(name));
		if (win) win.close();
		if (activeNoteWindows.hasOwnProperty(name)) delete activeNoteWindows[name];
		config.windows.splice(getWindowIndexFromName(name), 1);
		
		saveConfig();
		return true;
	} else {
		return false;
	}
};

const handleGetNoteListItems = () => {
	const result = [];

	config.windows.forEach(win => {
		if (win.windowName !== "mainWindow") {
			result.push({
				noteName: win.windowName,
				noteTitle: win.windowTitle,
				noteColor: win.bgcolor
			});
		}
	});

	return result;
};

const handleCloseWindow = e => {
	const win = BrowserWindow.fromWebContents(e.sender);
	const mainWindowID = getWindowIDFromName("mainWindow");

	if (Object.keys(activeNoteWindows).length > 0) {
		if (win.id === mainWindowID) {
			const index = getWindowIndexFromID(mainWindowID);
			config.windows[index].isOpen = false;
			
			mainWindow.hide();
		} else {
			win.close();
			const index = getWindowIndexFromID(win.id);
			config.windows[index].isOpen = false;
			delete activeNoteWindows[getWindowNameFromID(win.id)];

			const mainWindowIndex = getWindowIndexFromName("mainWindow");
			config.windows[mainWindowIndex].isOpen = true;
			mainWindow.show();
		}
	} else {
		win.close();
	}

	saveConfig();
};

const handleQuitApp = () => {
	saveConfig();
	app.quit();
};

const handleTransferNewNoteTitle = (e, title, name) => {
	if (activeNoteWindows.hasOwnProperty(name)) {
		const win = activeNoteWindows[name];
		win.webContents.send("updateNoteTitle", title);
	}

	config.windows[getWindowIndexFromName(name)].windowTitle = title;
};

const handleGetNoteData = e => {
	const win = BrowserWindow.fromWebContents(e.sender);
	const windowIndex = getWindowIndexFromID(win.id);

	const noteColor = win.getBackgroundColor().toLowerCase();
	const noteTitle = config.windows[windowIndex].windowTitle;
	const noteContent = config.windows[windowIndex].windowContent;
	return { noteColor: noteColor, noteTitle: noteTitle, noteContent: noteContent };
};

const handleSaveNoteContent = (e, content) => {
	const win = BrowserWindow.fromWebContents(e.sender);
	const windowIndex = getWindowIndexFromID(win.id);

	config.windows[windowIndex].windowContent = content;
};

const handleSetNewNoteBackground = (e, color) => {
	const win = BrowserWindow.fromWebContents(e.sender);
	const windowIndex = getWindowIndexFromID(win.id);

	config.windows[windowIndex].bgcolor = color;
	win.setBackgroundColor(color);

	mainWindow.webContents.send("updateNoteColor", color, getWindowNameFromID(win.id));
};

// Utility functions ===========================================================

const saveConfig = () => {
	const data = JSON.stringify(config);
	fs.writeFileSync(configPath, data);
};

const storeWindowGeometry = e => {
	const dims = e.sender.getSize();
	const pos = e.sender.getPosition();
	const data = { xPos: pos[0], yPos: pos[1], width: dims[0], height: dims[1] };

	const index = getWindowIndexFromID(e.sender.id);
	Object.assign(config.windows[index], data);
};

const getWindowIDFromName = name => {
	const index = config.windows.findIndex(e => e.windowName === name);
	return config.windows[index].windowID;
};

const getWindowNameFromID = id => {
	const index = config.windows.findIndex(e => e.windowID === id);
	return config.windows[index].windowName;
};

const getWindowIndexFromID = id => {
	const index = config.windows.findIndex(e => e.windowID === id);
	return index;
};

const getWindowIndexFromName = name => {
	const index = config.windows.findIndex(e => e.windowName === name);
	return index;
};

// Initialization ==============================================================

const initConfig = () => {
	if (!fs.existsSync(configPath)) {
		const data = JSON.stringify({ "windows": [] });
		fs.writeFileSync(configPath, data);
	}

	config = JSON.parse(fs.readFileSync(configPath));
};

const initMainWindow = () => {
	const opts = { show: false, frame: false, width: w.min, height: h.min, minWidth: w.min, minHeight: h.min, maxWidth: w.max, maxHeight: h.max, backgroundColor: "#222222", webPreferences: { preload: path.join(__dirname, "preload.js") }, icon: path.join(__dirname, "app", "src", "icon", "256x256.png") }
	let windowIndex = config.windows.findIndex(e => e.windowName === "mainWindow");
	
	if (windowIndex > -1) {
		const cfg = config.windows[windowIndex];
		
		if (cfg.hasOwnProperty("width")) opts.width = cfg.width;
		if (cfg.hasOwnProperty("height")) opts.height = cfg.height;
		if (cfg.hasOwnProperty("bgcolor")) opts.backgroundColor = cfg.bgcolor;
		if (cfg.hasOwnProperty("xPos") && cfg.hasOwnProperty("yPos")) {
			opts.x = cfg.xPos;
			opts.y = cfg.yPos;
		}
	} else {
		config.windows.push({
			"windowName": "mainWindow",
			"width": w.min,
			"height": h.min,
			"bgcolor": "#222222"
		});
		windowIndex = 0;
	}

	mainWindow = new BrowserWindow(opts);
	
	const cfg = config.windows[windowIndex];
	const hasPosition = cfg.hasOwnProperty("yPos") && cfg.hasOwnProperty("xPos");
	
	if (!hasPosition) {
		mainWindow.center();
		const pos = mainWindow.getPosition();
		Object.assign(config.windows[windowIndex], { xPos: pos[0], yPos: pos[1] });
	}

	config.windows[windowIndex].windowID = mainWindow.id;
	
	mainWindow.on("move", e => storeWindowGeometry(e));
	mainWindow.on("resize", e => storeWindowGeometry(e));

	const readyToShow = () => {
		mainWindow.once("ready-to-show", () => mainWindow.show());
	};

	if (cfg.hasOwnProperty("isOpen")) {
		if (cfg.isOpen) {
			readyToShow();	
		}
	} else {
		readyToShow();
		config.windows[windowIndex].isOpen = true;
	}

	mainWindow.loadURL(path.join("file://", __dirname, "app", "mainwindow", "mainwindow.html"));
};

const initOpenNoteWindows = () => {
	config.windows.forEach(win => {
		if (win.windowName !== "mainWindow" && win.isOpen) {
			handleOpenNoteWindow(null, win.windowName);
		}
	});
};

const setup = () => {
	Menu.setApplicationMenu(null);

	initConfig();
	initMainWindow();
	initOpenNoteWindows();
};

app.whenReady().then(() => {
	ipcMain.handle("openNoteWindow", handleOpenNoteWindow);
	ipcMain.handle("deleteNote", handleDeleteNote);
	ipcMain.handle("getNoteListItems", handleGetNoteListItems);
	ipcMain.handle("getNoteData", handleGetNoteData);
	ipcMain.on("saveNoteContent", handleSaveNoteContent);
	ipcMain.on("setNewNoteBackground", handleSetNewNoteBackground);
	ipcMain.on("closeWindow", handleCloseWindow);
	ipcMain.on("quitApp", handleQuitApp);
	ipcMain.on("transferNewNoteTitle", handleTransferNewNoteTitle);
	
	setup();
});

app.on("before-quit", () => {
	saveConfig();
});

app.on("window-all-closed", () => {
	app.quit();
});
