const { handleReceiveNoteTitle, getNoteData, saveNoteContent, setNewNoteBackground } = window.electronAPI;

// Handlers ====================================================================

handleReceiveNoteTitle((e, title) => {
    document.querySelector(".apptitle").textContent = title;
});

const handleEditorSave = () => {
    return new Promise(res => {
        saveNoteContent(window.editor.getData());
        res();
    });
};

// Utilities ===================================================================

const hexToRGB = hex => {
    if (hex.indexOf("#") > -1) hex = hex.replace("#", "");

    const [seg1, seg2, seg3] = hex.match(/.{1,2}/g);
    return [
        parseInt(seg1, 16),
        parseInt(seg2, 16),
        parseInt(seg3, 16)
    ];
};

const getLuminance = (r, g, b) => {
    const a = [r, g, b].map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });

    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
};

const getTextColorBasedOnBackground = bgcolor => {
    const textColors = ["#000000", "#ffffff"];
    const ratios = [];
    const bgLum = getLuminance(...hexToRGB(bgcolor));

    textColors.forEach(textColor => {
        const txtLum = getLuminance(...hexToRGB(textColor));

        ratios.push(bgLum > txtLum
            ? ((txtLum + 0.05) / (bgLum + 0.05))
            : ((bgLum + 0.05) / (txtLum + 0.05)));
    });

    const best = Math.min(...ratios);
    const index = ratios.indexOf(best);
    return textColors[index];
};

// Initialization ==============================================================

const initNoteData = async () => {
    const { noteColor, noteTitle, noteContent } = await getNoteData();
    
    [...document.querySelectorAll(".colorpicker-color")].forEach(elem => {
        if (elem.dataset.color === noteColor) elem.classList.add("selected");
    });
    
    const [r, g, b] = hexToRGB(noteColor);
    const colorStr = `rgba(${r}, ${g}, ${b}, 0.5)`;
    document.body.setAttribute("style", "--note-color:" + colorStr + ";");
    
    const bestColor = getTextColorBasedOnBackground(noteColor);
    document.querySelector(":root").style.setProperty("--theme-color", bestColor);
    
    document.querySelector(".apptitle").textContent = noteTitle;
    
    window.editor.setData(noteContent);
};

const initCKE = () => {
    BalloonEditor.create(document.querySelector("#mainContainer"), {
        toolbar: { items: ["bold", "italic", "underline", "|", "fontFamily", "fontSize", "fontColor", "|", "highlight", "removeFormat", "|", "link", "strikethrough", "horizontalLine", "|", "bulletedList", "numberedList", "todoList", "|", "indent", "outdent", "alignment"] },
        fontSize: { options: [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 36, 42] },
        fontFamily: { options: ["Anonymous Pro", "Arial", "Calibri", "Courier Prime", "Default", "Fredoka One", "Lilita One", "Monospace", "Montserrat", "Open Sans", "Roboto", "Sans-Serif", "Serif"] },
        autosave: {
            save() {
                return handleEditorSave();
            },
            waitingTime: 500
        }
    }).then(editor => {
        window.editor = editor;
        initNoteData();
    });
};

const initColorPicker = () => {
    const container = document.querySelector(".colorpicker-background");
    const colors = [...document.querySelectorAll(".colorpicker-color")];

    const handlePickedColor = e => {
        const selected = e.currentTarget;
        const color = selected.dataset.color;

        setNewNoteBackground(color);

        colors.forEach(elem => {
            elem.classList.remove("selected");
        });

        selected.classList.add("selected");

        const bestColor = getTextColorBasedOnBackground(color);
        document.querySelector(":root").style.setProperty("--theme-color", bestColor);

        document.body.setAttribute("style", "--note-color:" + color + ";");

        container.classList.remove("active");
    };

    colors.forEach(elem => {
        elem.setAttribute("style", `background-color:${elem.dataset.color};`);
        elem.innerHTML = `<span class="checkmark"><div class="checkmark-circle"></div><div class="checkmark-stem"></div><div class="checkmark-kick"></div></span>`;
        elem.addEventListener("click", e => handlePickedColor(e));
    });

    document.querySelector("#btnColorPicker").addEventListener("click", () => {
        container.classList.add("active");
    });
};

window.addEventListener("DOMContentLoaded", async () => {
    initColorPicker();
    initCKE();
});
