const { handleReceiveNoteTitle, getNoteData, saveNoteContent, setNewNoteBackground } = window.electronAPI;

let editSaveTimeout = null;
const fontFamilies = ["Anonymous Pro=anonymous pro", "Arial=arial", "Calibri=calibri", "Courier Prime=courier prime", "Fredoka One=fredoka one", "Lilita One=lilita one", "Monospace=monospace", "Montserrat=montserrat", "Nunito=nunito", "Open Sans=open sans", "Roboto=roboto", "Sans Serif=sans-serif", "Serif=serif"];
const fontImports = `@import url("https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap");@import url("https://fonts.googleapis.com/css2?family=Anonymous+Pro:ital,wght@0,400;0,700;1,400;1,700&display=swap");@import url('https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400;1,700&display=swap');@import url('https://fonts.googleapis.com/css2?family=Fredoka+One&display=swap');@import url('https://fonts.googleapis.com/css2?family=Lilita+One&display=swap');@import url('https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;0,1000;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900;1,1000&display=swap');@import url('https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300;1,400;1,500;1,600;1,700;1,800&display=swap');@import url('https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&display=swap');`;
const fontSizes = ["8px", "9px", "10px", "12px", "14px", "16px", "18px", "20px", "24px", "32px", "42px", "54px", "68px", "84px"];

// Handlers ====================================================================

handleReceiveNoteTitle((e, title) => {
    document.querySelector(".apptitle").textContent = title;
});

const handleEditorChanged = () => {
    clearTimeout(editSaveTimeout);

    editSaveTimeout = setTimeout(() => {
        const content = tinymce.activeEditor.getContent();
        saveNoteContent(content);
    }, 1000);
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

const updateEditorColor = color => {
    let c = tinymce.activeEditor.getContent();
    
    if (color === "#ffffff") {
        c = c.replace(/rgb\(0, 0, 0\)/g, "rgb(255, 255, 255)");
    } else {
        c = c.replace(/rgb\(255, 255, 255\)/g, "rgb(0, 0, 0)");
    }

    tinymce.activeEditor.setContent(c);
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
    
    tinymce.activeEditor.setContent(noteContent);

    // Let's hack it boys
    setTimeout(() => updateEditorColor(bestColor), 1000);
};

const initTinyMCE = () => {
    tinymce.init({
        selector: "div#mainContainer",
        menubar: false,
        plugins: "lists",
        toolbar: "fontfamily fontsize | formatgroup paragraphgroup | notecolorbutton",
        toolbar_groups: {
            formatgroup: {
                icon: "format",
                tooltip: "Formatting",
                items: "bold italic underline | forecolor | removeformat"
            },
            paragraphgroup: {
                icon: "paragraph",
                tooltip: "Paragraph format",
                items: "bullist numlist | alignleft aligncenter alignright | indent outdent"
            },
        },
        font_size_formats: fontSizes.join(" "),
        font_family_formats: fontFamilies.join("; "),
        content_style: fontImports,
        content_css: "./note.css",
        setup: editor => {
            editor.on("input", () => handleEditorChanged());
            editor.addShortcut("meta+s", "Save content in config", () => handleEditorChanged());
            editor.on("init", () => initNoteData());

            editor.ui.registry.addButton("notecolorbutton", {
                icon: "fill",
                onAction: () => document.querySelector(".colorpicker-container").classList.add("active")
            });
        }
    });
};

const initColorPicker = () => {
    const container = document.querySelector(".colorpicker-container");
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

        updateEditorColor(bestColor);

        document.body.setAttribute("style", "--note-color:" + color + ";");

        container.classList.remove("active");
    };

    colors.forEach(elem => {
        elem.setAttribute("style", `background-color:${elem.dataset.color};`);
        elem.innerHTML = `<span class="checkmark"><div class="checkmark-circle"></div><div class="checkmark-stem"></div><div class="checkmark-kick"></div></span>`;
        elem.addEventListener("click", e => handlePickedColor(e));
    });
};

window.addEventListener("DOMContentLoaded", async () => {
    initColorPicker();
    initTinyMCE();

    // Backup listener to save content in case editor isn't focused
    document.addEventListener("keypress", e => {
        if (e.ctrlKey && e.code == "KeyS") handleEditorChanged();
    });
});
