const { ipcRenderer } = require("electron");

window.swave = {
    PopupPewsWeb: () => {
        ipcRenderer.sendSync("pewsweb");
    }
}

for (const i of ["eqktitle", "eqktime", "maxmmi", "nowtime", "swavetime", "pwavetime", "phaseupdate", "staupdate"]) {
    ipcRenderer.on(i, (_, message) => {
        UI_update(i, message);
    });
}

ipcRenderer.on("setting", (_, message) => {
    Setting(message);
});