const { getNoteListItems, openNoteWindow, deleteNote, transferNewNoteTitle, handleReceiveNoteBackground } = window.electronAPI;

// Handlers ====================================================================

handleReceiveNoteBackground((e, color, name) => {
    [...document.querySelectorAll(".note-container")].forEach(elem => {
        if (elem.dataset.name === name) elem.querySelector(".note-title").setAttribute("style", `border-color:${color};`);
    });
});

// Utility functions ===========================================================

const getTextWidth = text => {
    const tag = document.createElement("DIV");
    tag.style.position = "absolute";
    tag.style.left = "-99in";
    tag.style.whiteSpace = "nowrap";
    tag.style.font = "14px Montserrat";
    tag.innerHTML = text;

    document.body.appendChild(tag);
    const textWidth = tag.clientWidth;
    document.body.removeChild(tag);
    return textWidth;
};

const createNoteListEntry = (name, title = "My new note", color = "#b8fc90") => {
    let dblclickTimeout = null;
    let dblclickDelay = 200;
    let shouldPrevent = false;
    const notesList = document.querySelector(".notes-list");
    
    const noteContainer = document.createElement("DIV");
    noteContainer.classList.add("note-container");
    noteContainer.dataset.name = name;
    noteContainer.addEventListener("click", () => {
        dblclickTimeout = setTimeout(() => {
            if (!shouldPrevent) openNoteWindow(name);
            shouldPrevent = false;
        }, dblclickDelay);
    });

    const noteTitle = document.createElement("DIV");
    noteTitle.classList.add("note-title");
    noteTitle.innerText = title;
    noteTitle.setAttribute("style", `border-color:${color};`);
    noteTitle.addEventListener("click", e => {
        if (noteTitle.contentEditable === "true") e.stopPropagation();
    });
    noteTitle.addEventListener("dblclick", e => {
        clearTimeout(dblclickTimeout);
        shouldPrevent = true;

        noteTitle.setAttribute("contenteditable", "true");
        noteTitle.focus();
        
        // Ugly, terrible hack to move caret to the end of text (God forgive me)
        const range = document.createRange();
        range.selectNodeContents(noteTitle);
        range.collapse(false);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    });
    noteTitle.addEventListener("blur", () => {
        noteTitle.setAttribute("contenteditable", "false");
    });
    noteTitle.addEventListener("paste", e => {
        e.preventDefault();
        return false;
    });
    noteTitle.addEventListener("keypress", e => {
        if (e.key === "Enter") {
            noteTitle.setAttribute("contenteditable", "false");
            e.preventDefault();
            return false;
        }

        const elemWidth = noteTitle.clientWidth;
        const content = noteTitle.innerText;
        if (getTextWidth(content) >= elemWidth - 10) {
            e.preventDefault();
            return false;
        }
    });
    noteTitle.addEventListener("input", () => {
        const content = noteTitle.innerText;
        transferNewNoteTitle(content, name);
    });

    const noteButtonsContainer = document.createElement("DIV");
    noteButtonsContainer.classList.add("note-buttons-container");


    const btnDelete = document.createElement("DIV");
    btnDelete.classList.add("btn-delete");
    btnDelete.innerHTML = `<svg width="18px" height="18px" viewbox="0 0 24 24" stroke="white" xmlns="http://www.w3.org/2000/svg"><use xlink:href="#icon-delete"></use></svg>`;
    btnDelete.addEventListener("click", async e => {
        e.stopPropagation();
        const confirmation = await deleteNote(name);
        if (confirmation) notesList.removeChild(noteContainer);
    });
    
    noteButtonsContainer.appendChild(btnDelete);
    [noteTitle, noteButtonsContainer].forEach(node => {
        noteContainer.appendChild(node);
    });
    notesList.appendChild(noteContainer);
};

// Initialization ==============================================================

const initNotesList = async () => {
    const listItems = await getNoteListItems();
    listItems.forEach(obj => {
        createNoteListEntry(obj.noteName, obj.noteTitle, obj.noteColor);
    });
};

const initCreateButton = () => {
    document.querySelector("#btnCreate").addEventListener("click", async () => {
        const newNoteName = await openNoteWindow();
        createNoteListEntry(newNoteName);
    });
};

document.addEventListener("DOMContentLoaded", () => {
    initNotesList();
    initCreateButton();
});
