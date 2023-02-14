const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
    // mainWindow
    deleteNote: name => ipcRenderer.invoke("deleteNote", name),
    openNoteWindow: name => ipcRenderer.invoke("openNoteWindow", name),
    getNoteListItems: () => ipcRenderer.invoke("getNoteListItems"),
    transferNewNoteTitle: (title, name) => ipcRenderer.send("transferNewNoteTitle", title, name),
    handleReceiveNoteBackground: (callback) => ipcRenderer.on("updateNoteColor", callback),

    // noteWindow
    getNoteData: () => ipcRenderer.invoke("getNoteData"),
    saveNoteContent: content => ipcRenderer.send("saveNoteContent", content),
    setNewNoteBackground: color => ipcRenderer.send("setNewNoteBackground", color),
    handleReceiveNoteTitle: (callback) => ipcRenderer.on("updateNoteTitle", callback),

    // both types
    closeWindow: () => ipcRenderer.send("closeWindow"),
    quitApp: () => ipcRenderer.send("quitApp"),
});
