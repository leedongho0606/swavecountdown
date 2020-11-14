"use strict";
const { app, BrowserWindow, screen, Menu, Tray, ipcMain, dialog } = require("electron"),
    pews = require("./pews"),
    fs = require("fs");

let win, popwin;
global.setdata = {};

async function update() {
    const requestResult = new Promise((resolve, reject) => {
        require("request").get({ url: "https://raw.githubusercontent.com/leedongho0606/swavecountdown/main/version.json" }, (err, res, body) => {
            if (err) reject(err);
            resolve([res, body]);
        });
    });
    let res, body;
    try {
        [res, body] = await requestResult;
    }
    catch (err) {
        return console.error("[Updater] Error: " + err.message);
    }
    if (res.statusCode !== 200 || !body) return;
    body = JSON.parse(body);
    const gitver = body["ver"].split("."),
        nowver = String(app.getVersion()).split(".");
    for (let i = 0; i < gitver.length; i++) {
        if (gitver[i] !== nowver[i]) {
            dialog.showMessageBox({ type: "question", title: "업데이트 요청", message: "지진파 도달프로그램 v" + body["ver"] + "이(가) 배포중입니다!\n업데이트 사항:\n" + (body["note"] || "불러오기 실패"), buttons: ["닫기", "다운로드 페이지"] })
                .then(r => {
                    if (r.response !== 1) return;
                    const { exec } = require('child_process');
                    exec("start https://github.com/leedongho0606/swavecountdown/releases/latest");
                });
            break;
        }
    }
}
update();

function popupwindow(url, w, h, ren, notlocal, loaded) {
    if (popwin) popwin.close();
    popwin = new BrowserWindow({
        webPreferences: {
            preload: `${__dirname}/src/html/script/${ren}`,
            devTools: pews.isdev
        },
        width: w,
        height: h,
        backgroundColor: "#000000",
        icon: __dirname + "/src/icon.ico"
    });
    if (notlocal) popwin.loadURL(url);
    else popwin.loadFile(`${__dirname}/src/html/${url}`);
    popwin.setMenuBarVisibility(false);
    popwin.on("closed", () => {
        popwin = null;
    });
    if (loaded) popwin.webContents.on("did-finish-load", loaded);
    popwin.webContents.on('new-window', (event, url) => {
        event.preventDefault();
    });
    if (pews.isdev) return;
    popwin.webContents.on('before-input-event', (event, input) => {
        if ((input.control || input.shift) && input.key.toLowerCase() === 'r') event.preventDefault();
    });
}

function createWindow() {
    win = new BrowserWindow({
        webPreferences: {
            preload: `${__dirname}/src/html/script/index_renderer.js`,
            devTools: pews.isdev
        },
        width: 850,
        height: 340,
        minWidth: 850,
        minHeight: 360,
        backgroundColor: "#000000",
        icon: __dirname + "/src/icon.ico"
    });
    //if (process.argv[2] === "-hide") win.hide();
    win.loadFile(`${__dirname}/src/html/index.html`);
    win.setMenuBarVisibility(false);
    const ssize = screen.getPrimaryDisplay().size;
    win.setPosition(ssize.width - win.getSize()[0], ssize.height - win.getSize()[1] - 40, false);
    win.webContents.on("did-finish-load", () => {
        global.elewin = win;
        maketrayicon();
    });
    win.on('close', event => {
        event.preventDefault();
        win.hide();
    });
    win.webContents.on("new-window", (event, a, b, c, options, d) => {
        event.preventDefault();
        Object.assign(options, {
            modal: true,
            parent: win
        });
        let bw = new BrowserWindow(options);
        event.newGuest = bw;
        bw.center();
        bw.setMenuBarVisibility(false);
    });
    if (pews.isdev) return;
    win.webContents.on("before-input-event", (event, input) => {
        if ((input.control || input.shift) && input.key.toLowerCase() === 'r') event.preventDefault();
    });
}

app.on("ready", () => {
    createWindow();
    setInterval(pews.pews, 1000);
    pews.location();
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
    if (win === null) createWindow();
});

ipcMain.on("location", (event, arg) => {
    pews.location(arg, result => {
        event.returnValue = result;
    });
});

ipcMain.on("simulation", (event, arg) => {
    if (arg !== -1) pews.StartSimulation(arg);
    else pews.StopSimulation();
    event.returnValue = true;
});

ipcMain.on("timeset", (event, arg) => {
    pews.timeset(arg);
    event.returnValue = true;
});

ipcMain.on("pewsweb", event => {
    popupwindow("https://www.weather.go.kr/pews/", 848, 950, "pci.js", true, () => {
        popwin.webContents.send("location", pews.location());
    });
    event.returnValue = true;
});

function savesetting(data, solution) {
    pews.makedir();
    fs.writeFile(pews.datapath + "setting.json", JSON.stringify(data), "utf-8", err => {
        if (err) return dialog.showMessageBox({ type: "error", title: "데이터 " + solution + " 실패", message: "데이터를 " + solution + "하지 못하였습니다" });
    });
}

function settingdata(items) {
    process.noAsar = true;
    const readdata = {
        "winnoti": true,
        "sound": true,
        "autopopup": true,
        "topmost": true,
        "recp2": true,
        "recp3": true
    };
    if (items == "default") return readdata;
    let json = {}, readeddata;
    if (Array.isArray(items)) {
        for (let item of items) {
            json[item.toolTip] = item.checked;
        }
    } else json = items;
    try {
        pews.makedir();
        readeddata = fs.readFileSync(pews.datapath + "setting.json");
        if (items == null) return JSON.parse(readeddata);
    }
    catch {
        if (items == null) return null;
        return savesetting(json, "생성");
    }
    win.webContents.send("setting", json);
    global.setdata = json;
    let stat;
    try {
        stat = fs.statSync(pews.datapath + "setting.json");
    } catch {
        return savesetting(json, "생성");
    }
    if (readeddata) savesetting(json, "저장");
}

let tray = null;
function maketrayicon() {
    tray = new Tray(__dirname + "/src/icon.ico");
    tray.setToolTip("지진파 도달알림 v" + app.getVersion());
    tray.on("double-click", () => {
        win.isVisible() && !win.isMinimized() ? win.hide() : win.showInactive();
    });
    const readsetting = settingdata();
    let readdata = settingdata("default");
    if (readsetting == null) {
        settingdata(readdata);
        dialog.showMessageBox({ type: "error", title: "데이터 불러오기 실패", message: "데이터를 불러오지 못하였습니다\n기본값으로 설정되었습니다." });
    } else readdata = readsetting;
    win.webContents.send("setting", readdata);
    global.setdata = readdata;
    win.setAlwaysOnTop(readdata["topmost"]);
    const contextMenu = Menu.buildFromTemplate([
        {
            label: "설정",
            submenu: [
                {
                    label: "위치설정",
                    click: function () {
                        dialog.showMessageBox({ type: "info", title: "사용자 위치설정 안내", message: "지도에 본인의 위치를 클릭하여 마커를 표시해주세요!\n마커가 표시되지 않는 경우 잠시후 재시도 하세요." });
                        popupwindow("https://www.google.com/maps/", 848, 950, "gmap_inject.js", true, () => {
                            pews.location(null, r => {
                                if (popwin) popwin.webContents.send("location", r);
                            });
                        });
                    }
                },
                {
                    label: "환경설정",
                    submenu: [
                        {
                            label: "윈도우 알림",
                            type: "checkbox",
                            checked: readdata["winnoti"],
                            toolTip: "winnoti",
                            click: function (item) {
                                settingdata(item.menu.items);
                            }
                        },
                        {
                            label: "음성",
                            type: "checkbox",
                            checked: readdata["sound"],
                            toolTip: "sound",
                            click: function (item) {
                                settingdata(item.menu.items);
                            }
                        },
                        {
                            label: "모니터 대기상태관리",
                            type: "checkbox",
                            checked: readdata["monitormanage"],
                            toolTip: "monitormanage",
                            click: function (item) {
                                settingdata(item.menu.items);
                            }
                        },
                        {
                            label: "창 자동 팝업",
                            type: "checkbox",
                            checked: readdata["autopopup"],
                            toolTip: "autopopup",
                            click: function (item) {
                                settingdata(item.menu.items);
                            }
                        },
                        {
                            label: "창 최상위 고정",
                            type: "checkbox",
                            checked: readdata["topmost"],
                            toolTip: "topmost",
                            click: function (item) {
                                win.setAlwaysOnTop(item.checked);
                                settingdata(item.menu.items);
                            }
                        },
                        {
                            label: "PEWS WEB 자동팝업",
                            type: "checkbox",
                            checked: readdata["pewsweb"],
                            toolTip: "pewsweb",
                            click: function (item) {
                                settingdata(item.menu.items);
                            }
                        },
                        {
                            label: "신속정보 수신 (3.0 이상 - 긴급수준)",
                            type: "checkbox",
                            checked: readdata["recp2"],
                            toolTip: "recp2",
                            click: function (item) {
                                settingdata(item.menu.items);
                            }
                        },
                        {
                            label: "상세정보 수신 (2.0 이상 - 일반수준)",
                            type: "checkbox",
                            checked: readdata["recp3"],
                            toolTip: "recp3",
                            click: function (item) {
                                settingdata(item.menu.items);
                            }
                        }
                    ]
                },
            ],
        },
        {
            label: "기타",
            submenu: [
                {
                    label: "시뮬레이션",
                    click: function () {
                        popupwindow("simulation.html", 470, 400, "sim_renderer.js", false, () => {
                            popwin.webContents.send("eqkid", pews.lasteqkid());
                        });
                    }
                },
                {
                    label: "기준시각 조정",
                    click: function () {
                        popupwindow("timeset.html", 430, 210, "timeset_renderer.js", false, () => {
                            popwin.webContents.send("nowtimeset", pews.timeset());
                        });
                    }
                },
                {
                    label: "PEWS WEB(Custom)",
                    click: function () {
                        popupwindow("https://www.weather.go.kr/pews/", 848, 950, "pci.js", true, () => {
                            pews.location(null, r => {
                                popwin.webContents.send("location", r);
                            });
                        });
                    }
                },
            ]
        },
        {
            label: "프로그램 정보",
            click: function () {
                dialog.showMessageBox({ type: "none", title: "지진파 도달알림 프로그램 정보", message: `버전: ${app.getVersion()}\n개발자: LDH0606\n`, buttons: ["닫기", "Github", "Youtube"] })
                    .then(r => {
                        const c_p = require('child_process');
                        if (r.response === 1) c_p.exec("start https://github.com/leedongho0606");
                        else if (r.response === 2) c_p.exec("start https://www.youtube.com/channel/UC8ixXgeqKOg6NU80VYfxptQ");
                    });
            }
        },
        {
            label: "종료",
            click: function () {
                app.exit();
            }
        },
    ]);
    tray.setContextMenu(contextMenu);
}