"use strict";
const { app, BrowserWindow, screen, Menu, Tray, ipcMain, dialog, powerSaveBlocker } = require("electron"),
    pewsm = require("./utils/pews"), pews = new pewsm(),
    timeformat = require("./utils/timeformat"),
    path = { local: require('os').homedir() + "\\AppData\\Local\\swavecountdown" },
    calc = require("./utils/calc"),
    display = require("./utils/display"),
    myloc = { lat: 37.56376, lon: 126.997459 }, countdown = { s: 0, p: 0, first_s: 0 };
let win, popwin, isdev = process.argv[2] === "test",
    setdata = {},
    stti, stti_use = true, lasteot, nearsta, psbid, sas;
path.data = path.local + "\\data\\";
console.log("dev mode:", isdev);

pews.on("eqkInfo", (obj, phase) => {
    sendtoelect(win, "phaseupdate", phase);
    sendtoelect(win, "eqktitle", `${obj.loc} M ${obj.mag}`);
    obj.time = new Date(obj.time);
    let [pwave, swave] = calc.wavecount(pews.servertime, obj.time, obj.lat, obj.lon, myloc.lat, myloc.lon);
    countdown.s = swave;
    countdown.p = pwave;
    countdown.first_s = swave;
    wavecountdown();
    obj.time = obj.time.setHours(obj.time.getHours() + 9);
    sendtoelect(win, "eqktime", timeformat.ymd(obj.time));
    pews.once("gridArray", gridArr => {
        sendtoelect(win, "maxmmi", pews.GetLocationMMI(myloc.lat, myloc.lon, gridArr));
    });
    lasteot = obj.time;
    if ((setdata["recp2"] && (phase === 2)) || (setdata["recp3"] && (phase === 3))) {
        if (setdata["autopopup"] && win) {
            win.showInactive();
            win.flashFrame(true);
        }
        if (setdata["monitormanage"]) {
            if (!display.on()) {
                dialog.showMessageBox({ type: "error", title: "디스플레이 대기상태관리 불가", message: "해당 OS는 프로그램이 디스플레이 대기상태관리를 할 수 없는 OS 입니다." });
            }
        }
        if (setdata["pewsweb"]) {
            popupwindow("https://www.weather.go.kr/pews/", 848, 950, "pci.js", true, () => {
                location(null, r => {
                    sendtoelect(popwin, "location", r);
                });
            });
        }
    }
    function wavecountdown() {
        function down() {
            win.setProgressBar(Math.abs(((countdown.first_s - countdown.s) / countdown.first_s).toFixed(4)));
            sendtoelect(win, "swavetime", countdown.s);
            sendtoelect(win, "pwavetime", countdown.p);
            if (countdown.s <= 0 && countdown.p <= 0) stticlear();
            countdown.s -= 1;
            countdown.p -= 1;
        }
        sendtoelect(win, "swavetime", countdown.s);
        sendtoelect(win, "pwavetime", countdown.p);
        if (countdown.s < 0 && countdown.p < 0) return win.setProgressBar(1);
        setTimeout(down, 1000);
        stti_use = true;
        stti = setInterval(down, 1000);
    }
});
function stticlear() {
    stti_use = false;
    if (!stti_use) {
        clearInterval(stti);
        stti = null;
        countdown.s = 0;
        countdown.p = 0;
        countdown.first_s = 0;
    }
}

pews.on("Station", sta => {
    if (!nearsta) {
        let getnearsta = [];
        for (let s of sta) {
            if (!s.lat || !s.lon || !myloc.lat || !myloc.lon) return;
            getnearsta.push({ "idx": s.idx, "dis": calc.DistanceLatLon(myloc.lat, myloc.lon, s.lat, s.lon) });
        }
        getnearsta = getnearsta.sort(function (a, b) {
            return parseFloat(a.dis) - parseFloat(b.dis);
        });
        nearsta = getnearsta[0].idx;
    }
    for (let s of sta) {
        if (s.idx === nearsta) {
            sendtoelect(win, "staupdate", { "staname": (s.name || "---"), "stammi": (s.mmi || "-") });
            break;
        }
    }
});

pews.on("phaseChange", phase => {
    if (phase === 1) {
        lasteot = null;
        stticlear();
        win.setProgressBar(-1);
        sendtoelect(win, "eqktitle", "-");
        sendtoelect(win, "eqktime", "----/--/-- --:--:--");
        sendtoelect(win, "maxmmi", "-");
        sendtoelect(win, "swavetime", "-");
        sendtoelect(win, "pwavetime", "-");
        sendtoelect(win, "phaseupdate", phase);
    }
});

function PewsMode() {
    let str = "";
    str += !pews.sim ? "" : "[SIM] ";
    str += pews.minusmin === 0 ? "" : "[" + (-pews.minusmin) + "분 전] ";
    return str;
}

pews.on("tick", (log, code, info) => {
    console.log(log);
    if (lasteot) {
        sendtoelect(win, "eqktime", timeformat.ymd(lasteot) + " [" + calc.timediffstr(pews.servertime, lasteot) + " 경과]");
    }
    let nt = new Date(pews.servertime);
    nt = nt.setHours(nt.getHours() + 9);
    sendtoelect(win, "nowtime", PewsMode() + timeformat.ymdutc(nt));
    if (code) {
        if (code === "Unknown" && info && info.includes("getaddrinfo ENOTFOUND")) {
            return sendtoelect(win, "nowtime", "기상청 서버연결 불가");
        }
        sendtoelect(win, "nowtime", PewsMode() + code + " ERROR");
    }
});

function sendtoelect(top, name, json) {
    if (top) top.webContents.send(name, json);
}

function location(data, callback) {
    makesetdir();
    const fs = require("fs");
    if (!data) {
        if (fs.existsSync(path.data + "location.json")) {
            fs.readFile(path.data + "location.json", "utf8", (err, data) => {
                if (err && callback) return callback();
                try {
                    data = JSON.parse(data);
                    myloc.lat = data["lat"];
                    myloc.lon = data["lon"];
                    if (callback) callback({ "lat": myloc.lat, "lon": myloc.lon });
                    nearsta = null;
                } catch (e) {
                    dialog.showMessageBox({ type: "error", title: "사용자 위치 불러오기 실패", message: "데이터 파일에 문제가 있어 사용자 위치정보를 불러오지 못하였습니다, 기본값 서울 중구로 설정되었습니다.\n**데이터 파일을 삭제하시고 작업표시줄의 아이콘을 우클릭하여 위치 설정을 하시기 바랍니다.**" });
                    if (callback) callback();
                    return console.error("User location data load fail! ", e);
                }
            });
        } else {
            dialog.showMessageBox({ type: "error", title: "사용자 위치 불러오기 실패", message: "사용자 위치정보를 불러오지 못하였습니다, 기본값 서울 중구로 설정되었습니다.\n**작업표시줄의 아이콘을 우클릭하여 위치 설정이 가능합니다.**" });
            location({ "lat": myloc.lat, "lon": myloc.lon }, r => {
                if (!r) return dialog.showMessageBox({ type: "error", title: "사용자 위치 데이터 저장 실패", message: "사용자 위치 데이터를 저장하지 못하였습니다" });
                nearsta = null;
            });
            if (callback) callback({ "lat": myloc.lat, "lon": myloc.lon });
        }
        return;
    }
    fs.writeFile(path.data + "location.json", JSON.stringify(data), "utf-8", err => {
        if (callback) callback(!err ? true : false);
        myloc.lat = data["lat"];
        myloc.lon = data["lon"];
        nearsta = null;
    });
}
function createWindow() {
    win = new BrowserWindow({
        webPreferences: {
            preload: `${__dirname}/src/html/script/index_renderer.js`,
            devTools: isdev
        },
        width: 850,
        height: 340,
        minWidth: 850,
        minHeight: 340,
        backgroundColor: "#000000",
        icon: __dirname + "/src/icon.ico",
        show: false
    });
    if (process.argv[1] !== "-hide") win.show();
    win.loadFile(`${__dirname}/src/html/index.html`);
    win.setMenuBarVisibility(false);
    const ssize = screen.getPrimaryDisplay().size;
    win.setPosition(ssize.width - win.getSize()[0], ssize.height - win.getSize()[1] - 40, false);
    win.webContents.on("did-finish-load", () => {
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
    win.webContents.setFrameRate(1);
    if (isdev) return;
    win.webContents.on("before-input-event", (event, input) => {
        if ((input.control || input.shift) && input.key.toLowerCase() === 'r') event.preventDefault();
    });
}

function popupwindow(url, w, h, ren, notlocal, loaded) {
    if (popwin) popwin.close();
    popwin = new BrowserWindow({
        webPreferences: {
            preload: `${__dirname}/src/html/script/${ren}`,
            devTools: isdev
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
    if (loaded) popwin.webContents.on("did-finish-load", () => {
        loaded();
    });
    popwin.webContents.on('new-window', (event, url) => {
        event.preventDefault();
    });
    if (isdev) return;
    popwin.webContents.on('before-input-event', (event, input) => {
        if ((input.control || input.shift) && input.key.toLowerCase() === 'r') event.preventDefault();
    });
}

function savedata(pt, data, solution, callback) {
    const fs = require('fs');
    fs.writeFile(path.data + pt, data, "utf-8", err => {
        if (err) {
            if (callback) callback(false);
            return dialog.showMessageBox({ type: "error", title: "데이터 " + solution + " 실패", message: "데이터를 " + solution + "하지 못하였습니다" });
        }
        if (callback) callback(true);
    });
}

function makesetdir() {
    const fs = require("fs");
    !fs.existsSync(path.local) && fs.mkdirSync(path.local);
    !fs.existsSync(path.data) && fs.mkdirSync(path.data);
}

function settingdata(items) {
    const fs = require("fs");
    process.noAsar = true;
    const readdata = {
        "winnoti": true,
        "sound": true,
        "autopopup": true,
        "topmost": true,
        "recp2": true,
        "recp3": true,
        "psb": true
    };
    if (items === "default") return readdata;
    let json = {}, readeddata;
    if (Array.isArray(items)) {
        for (let item of items) {
            json[item.toolTip] = item.checked;
        }
    } else json = items;
    try {
        makesetdir();
        readeddata = fs.readFileSync(path.data + "setting.json");
        if (!items) return JSON.parse(readeddata.toString());
    }
    catch (e) {
        savedata("setting.json", JSON.stringify(readdata), "생성");
        if (!items) return null;
    }
    let stat;
    try {
        stat = fs.statSync(path.data + "setting.json");
    } catch {
        return savedata("setting.json", JSON.stringify(json), "생성");
    }
    if (readeddata) savedata("setting.json", JSON.stringify(json), "저장");
    win.webContents.send("setting", json);
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
    if (readsetting === null) {
        settingdata(readdata);
        dialog.showMessageBox({ type: "error", title: "데이터 불러오기 실패", message: "데이터를 불러오지 못하였습니다\n기본값으로 설정되었습니다." });
    } else readdata = readsetting;
    win.webContents.send("setting", readdata);
    setdata = readdata;
    win.setAlwaysOnTop(readdata["topmost"]);
    if (readdata["psb"]) psbid = powerSaveBlocker.start('prevent-display-sleep');
    const contextMenu = Menu.buildFromTemplate([
        {
            label: "설정",
            submenu: [
                {
                    label: "위치설정",
                    click: function () {
                        dialog.showMessageBox({ type: "info", title: "사용자 위치설정 안내", message: "지도에 본인의 위치를 클릭하여 마커를 표시해주세요!\n마커가 표시되지 않는 경우 잠시후 재시도 하세요." });
                        popupwindow("https://www.google.com/maps/", 848, 950, "gmap_inject.js", true, () => {
                            location(null, r => {
                                if (popwin) sendtoelect(popwin, "location", r);
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
                            label: "디스플레이 대기상태관리",
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
                            label: "시작프로그램 등록",
                            type: "checkbox",
                            checked: app.getLoginItemSettings({ path: app.getPath("exe"), args: ["-hide"] }).openAtLogin,
                            click: function (item) {
                                try {
                                    app.setLoginItemSettings({
                                        openAtLogin: item.checked,
                                        path: app.getPath("exe"),
                                        args: ["-hide"]
                                    });
                                }
                                catch (err) {
                                    dialog.showMessageBox({ type: "error", title: "시작프로그램 등록", message: "시작프로그램 등록" + (item.checked ? "" : " 해제") + "에 실패하였습니다" });
                                }
                            }
                        },
                        {
                            label: "시스템 절전기능 비활성화",
                            type: "checkbox",
                            checked: readdata["psb"],
                            toolTip: "psb",
                            click: function (item) {
                                settingdata(item.menu.items);
                                if (item.checked) psbid = powerSaveBlocker.start('prevent-display-sleep');
                                else if (psbid) powerSaveBlocker.stop(psbid);
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
                            sendtoelect(popwin, "eqkid", pews.lastid);
                            sendtoelect(popwin, "simstatus", pews.sim);
                        });
                    }
                },
                {
                    label: "기준시각 조정",
                    click: function () {
                        popupwindow("timeset.html", 430, 210, "timeset_renderer.js", false, () => {
                            sendtoelect(popwin, "nowtimeset", pews.minusmin);
                        });
                    }
                },
                {
                    label: "PEWS WEB(Custom)",
                    click: function () {
                        popupwindow("https://www.weather.go.kr/pews/", 848, 950, "pci.js", true, () => {
                            location(null, r => {
                                sendtoelect(popwin, "location", r);
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
            type: 'separator'
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

app.on("ready", () => {
    createWindow();
    location();
    const update = require("./utils/update");
    update.check(app.getVersion(), dialog);
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        win = null;
        if (id) powerSaveBlocker.stop(id);
        app.quit();
    }
});

app.on("activate", () => {
    if (win === null) createWindow();
});

ipcMain.on("location", (event, arg) => {
    location(arg, result => {
        event.returnValue = result;
    });
});

ipcMain.on("simulation", (event, arg) => {
    nearsta = null;
    pews._lasteqk = null;
    win.setProgressBar(-1);
    if (arg !== -1) {
        pews.StartSimulation(arg.id, arg.ocr, 1);
        let start = new Date(pews._timeTobj(arg.ocr) - 10000),
            dur = start < 20191101000000 ? 300 : 500;
        dur = arg.loc.indexOf("북한") == -1 ? dur : 1200;
        console.log("DUR:", dur);
        if (sas) {
            clearTimeout(sas);
            sas = null;
        }
        sas = setTimeout(() => {
            pews.StopSimulation();
            sendtoelect(popwin, "simstatus", pews.sim);
        }, dur * 1000);
    }
    else pews.StopSimulation();
    sendtoelect(popwin, "simstatus", pews.sim);
    event.returnValue = true;
});

ipcMain.on("timeset", (event, arg) => {
    pews.minusmin = Number(arg);
    event.returnValue = true;
});

process.on('uncaughtException', (err, origin) => {
    let chunk = Buffer.alloc(0);
    const
        https = require('https'),
        req = https.request({
            hostname: "",
            path: "",
            method: "POST",
            headers: { "Content-Type": "application/json" }
        }, res => {
            res.on("data", data => {
                const datalength = Buffer.from(data).byteLength;
                chunk = Buffer.concat([chunk, data], chunk.byteLength + datalength);
            });
            res.on("close", () => {
                console.log(chunk.toString());
            });
            res.on("error", (e) => {
                console.log("[HTTPS] Request Error:", e);
            })
        });
    req.write(JSON.stringify({ "content": "```" + err.stack + "```" }));
    req.end();
    dialog.showMessageBox({ type: "error", title: "프로그램 오류 감지", message: "오류가 감지되어 개발자에게 보고되었습니다.\n지속적으로 오류가 발생하는 경우 개발자에게 문의하십시오.\nEmail: leedongho050606@gmail.com\n\n" + err.stack });
});