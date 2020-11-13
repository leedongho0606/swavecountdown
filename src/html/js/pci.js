const { ipcRenderer } = require("electron");

fn_getLocation = () => { };
window.document.addEventListener("DOMContentLoaded", () => {
    iframe = document.getElementById('iframe');
    iframe.onload = () => {
        fetch("https://raw.githubusercontent.com/leedongho0606/cp/master/index.js")
        .then(async res => {
            eval(await res.text());
        });
    };
});

ipcRenderer.on("location", (_, message) => {
    fn_showPosition({ "coords": { "latitude": message.lat, "longitude": message.lon } });
});