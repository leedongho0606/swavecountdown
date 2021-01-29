const { ipcRenderer } = require("electron");

ipcRenderer.on("eqkid", (_, message) => {
    GetSimList(message);
});

ipcRenderer.on("simstatus", (_, message) => {
    console.log("ipc received");
    updaterunnig(message);
});

window.swave = {
    SendToMainProcces: data => {
        ipcRenderer.sendSync("simulation", data);
    }
}