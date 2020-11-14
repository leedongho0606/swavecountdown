const { ipcRenderer } = require("electron");

ipcRenderer.on("eqkid", (_, message) => {
    GetSimList(message);
});

window.swave = {
    SendToMainProcces: data => {
        ipcRenderer.sendSync("simulation", data);
    }
}