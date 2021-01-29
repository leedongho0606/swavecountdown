"use strict";
module.exports = {
    on: () => {
        process.noAsar = true;
        const os = require("os");
        if (os.platform() === "win32") {
            const path = require("path"),
                { spawn } = require("child_process");
            spawn('powershell.exe', ['-ExecutionPolicy', 'ByPass', '-File', path.normalize(__dirname + "/../.././utils/display.ps1")])
                .stderr.on("data", err => {
                    console.log("Display",err.toString());
                    throw err.toString();
                });
            return true;
        }
        else return false;
    }
}