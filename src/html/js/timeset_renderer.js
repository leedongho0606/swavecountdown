const { ipcRenderer } = require("electron");

ipcRenderer.on("nowtimeset", (_, message) => {
    Inputset(message);
});

window.swave = {
    SendToMainProcces: (data) => {
        ipcRenderer.sendSync("timeset", data);
    }
}