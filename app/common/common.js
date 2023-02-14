const { closeWindow, quitApp } = window.electronAPI;

const initButtons = () => {
    document.querySelector("#btnClose").addEventListener("click", () => closeWindow());
    document.querySelector("#btnQuit").addEventListener("click", () => quitApp());
};

const initDropdowns = () => {
    [...document.querySelectorAll(".dropdown-trigger")].forEach(trigger => {
        ["click", "contextmenu"].forEach(event => {
            trigger.addEventListener(event, e => {
                const target = e.currentTarget.querySelector(".dropdown-container");
                target.classList.add("triggered");
                setTimeout(() => { target.classList.remove("triggered") }, 2500);
            });
        });
    });
};

const setup = () => {
    initButtons();
    initDropdowns();
};

document.addEventListener("DOMContentLoaded", () => {
    setup();
});
