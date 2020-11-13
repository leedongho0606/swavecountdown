require("date-utils");
const stanamelist = require("./stalist.json"),
    request = require("request"),
    fs = require("fs"),
    { dialog } = require("electron"),
    //ra = ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"],
    moment = require("moment"),
    hdir = require('os').homedir(),
    noinfo = "-",
    maxEqkStrLen = 60,
    maxEqkInfoLen = 120,
    isdev = process.env.NODE_ENV === "test",
    localpath = hdir + "\\AppData\\Local\\swavecountdown",
    datapath = localpath + "\\data\\";

process.on('uncaughtException', err => {
    request.post({ url: "error report server url", json: { "content": "Node.js Error```" + err + "```" } }, err => {
        dialog.showMessageBox({ type: "error", title: "프로그램 오류 감지", message: "오류가 감지되어 개발자에게 자동 보고되었습니다.\n계속해서 해당 창이 뜨는 경우 개발자에게 문의하십시오." });
    });
});

let pTime = moment().subtract(32401000, "milliseconds"),
    pewsurl = "https://www.weather.go.kr/pews/data/",
    simmode = false,
    headerLen = 4,
    servertime,
    phase = 1,
    lastphase = 1,
    url = "",
    pewsdata,
    timeset = 0,
    myloclat,
    myloclon,
    stti,
    stti_use = true,
    staList = [],
    nearsta = {},
    simautostop,
    lasteqkid = "",
    lasteqkocr;

function eqkHandler(data, byteArray) {
    data = data.substr(0 - ((maxEqkStrLen * 8 + maxEqkInfoLen)));
    let eqkId = "20" + parseInt(data.substr(69, 26), 2);
    if (pewsdata != "" && pewsdata != (phase + "|" + eqkId)) {
        location();
        let originLat = 30 + (parseInt(data.substr(0, 10), 2) / 100),
            originLon = 124 + (parseInt(data.substr(10, 10), 2) / 100),
            eqkMag = parseInt(data.substr(20, 7), 2) / 10,
            //eqkDep = parseInt(data.substr(27, 10), 2) / 10,
            eqkTime = Number(parseInt(data.substr(37, 32), 2) + "000");
        /*
        eqkMax = parseInt(data.substr(95, 4), 2),
        eqkMaxAreaStr = data.substr(99, 17),
        eqkMaxArea = [];
    if (eqkMaxAreaStr != "11111111111111111") {
        for (let i = 0; i < 17; i++) {
            if (eqkMaxAreaStr.charAt(i) == "1") eqkMaxArea.push(ra[i]);
        }
    } else eqkMaxArea.push("-");
    */
        let infoStrArr = [];
        for (let i = byteArray.byteLength - maxEqkStrLen; i < byteArray.byteLength; i++) infoStrArr.push(byteArray[i]);
        eqkStr = decodeURIComponent(escape(String.fromCharCode.apply(null, infoStrArr))).trim();
        eqkTimeStr = moment(eqkTime).add(9, "hours").format("YYYY/MM/DD HH:mm:ss");
        lasteqkocr = moment(eqkTime).add(9, "hours");
        eqkMag > 0 ? eqkMag = eqkMag.toFixed(1) : eqkMag = noinfo;
        /*
        eqkDep > 0 ? eqkDep = eqkDep + "km" : eqkDep = noinfo;
        if (eqkMaxArea == "") eqkMaxArea = noinfo;
        */
        if ((global.setdata["recp2"] && (phase === 2)) || (global.setdata["recp3"] && (phase === 3))) {
            if (global.setdata["monitormanage"]) monitor_on();
            if (global.setdata["autopopup"] && global.elewin) {
                global.elewin.showInactive();
                global.elewin.flashFrame(true);
            }
        }
        getgrid(eqkId, gridArr => {
            sendtoelect("maxmmi", locmmi(gridArr, myloclat, myloclon));
        });
        sendtoelect("eqktitle", `${eqkStr} M ${eqkMag}`);
        sendtoelect("eqktime", eqkTimeStr);
        sendtoelect("phaseupdate", phase);
        if (!stti) {
            stti_use = true;
            swavecountdown(eqkTime, originLat, originLon);
        }
        pewsdata = (phase + "|" + eqkId);
    } else if (pewsdata === "") pewsdata = (phase + "|" + eqkId);
}

function fn_callback(data) {
    if (!data) return null;
    const mmiObject = mmiBinHandler(data)[0];
    let mylocstammi;
    for (let i = 0; i < staList.length; i++) {
        staList[i]["mmi"] = mmiObject.mmiData[staList[i].idx];
        if (nearsta["name"] === staList[i]["name"]) mylocstammi = staList[i]["mmi"];
    }
    if (Object.keys(nearsta).length < 2) {
        let getnearsta = [];
        for (let i = 0; i < staList.length; i++) {
            if (!staList[i]["lat"] || !staList[i]["lon"] || !myloclat || !myloclon) return;
            getnearsta.push({ "name": (stanamelist[staList[i]["lat"] + "," + staList[i]["lon"]] || i + "번"), "mmi": staList[i]["mmi"], "dis": getDistanceFromLatLonInKm(myloclat, myloclon, staList[i]["lat"], staList[i]["lon"]) });
        }
        getnearsta = getnearsta.sort(function (a, b) {
            return parseFloat(a.dis) - parseFloat(b.dis);
        });
        nearsta["name"] = getnearsta[0]["name"];
        nearsta["mmi"] = getnearsta[0]["mmi"];
    }
    sendtoelect("staupdate", { "staname": (nearsta["name"] || "---"), "stammi": (mylocstammi || "-") });
}

function swavecountdown(t, lat, lon) {
    if (!t || !lat || !lon) return;
    const serverdiff = (simmode ? moment(servertime).diff(moment(t)) : moment(servertime).subtract(9, "hours").diff(moment(t))),
        serverdifftosec = (serverdiff / 1000),
        countdownbase = Math.sqrt(Math.pow((lat - myloclat) * 111, 2) + Math.pow((lon - myloclon) * 88, 2));
    let sw = (Math.ceil((countdownbase / 3 - serverdifftosec))),
        pw = (Math.ceil((countdownbase / 6 - serverdifftosec))),
        firstsw = sw;
    sendtoelect("swavetime", sw);
    sendtoelect("pwavetime", pw);
    if (sw < 0 && pw < 0) return global.elewin.setProgressBar(1);
    stti = setInterval(() => {
        global.elewin.setProgressBar(Math.abs(((firstsw - sw) / firstsw).toFixed(4)));
        sendtoelect("swavetime", sw);
        sendtoelect("pwavetime", pw);
        //console.log("[SWAVE] " + String(sw) + "sec");
        if (sw <= 0 && pw <= 0) stticlear();
        sw -= 1;
        pw -= 1;
    }, 1000);
}

function stticlear() {
    stti_use = false;
    if (!stti_use) {
        clearInterval(stti);
        stti = null;
    }
}

exports.pews = async function () {
    url = pewsurl + pTime.format("YYYYMMDDHHmmss");
    const requestResult = new Promise((resolve, reject) => {
        request.get({ url: url + ".b", encoding: null }, (err, res, body) => {
            if (err) reject(err);
            resolve([res, body]);
        });
    });
    let res, body;
    try {
        [res, body] = await requestResult;
    }
    catch (err) {
        sendtoelect("nowtime", (simmode ? "[SIM] " : "") + "GET ERROR");
        return console.error("[EQK_API] Error: " + err.message);
    }
    if (!simmode) {
        servertime = moment(res.headers.date);
        //const sync = moment(moment() - servertime).add(1, "seconds");
        if (timeset === 0) pTime = moment(servertime);
        else pTime = moment(servertime).add(timeset, "minutes");
        sendtoelect("nowtime", (timeset < 0 ? "[" + timeset + "min] " : "") + pTime.format("YYYY/MM/DD HH:mm:ss"));
        pTime.subtract(9, "hours");
        //console.log("[PEWS]\nSync: " + sync + "ms / " + (sync / 1000) + "s", "\nServer: " + moment(servertime).format("YYYYMMDDHHmmss"), "\npTime: " + pTime.format("YYYYMMDDHHmmss"), "\nReal: " + moment(servertime).format("YYYY-MM-DD HH:mm:ss"));
    } else {
        servertime = servertime.add(1, "second");
        pTime = moment(servertime);
        //console.log("[SIM] " + url + ".b");
        sendtoelect("nowtime", `[SIM] ${moment(servertime).add(9, "hours").format("YYYY/MM/DD HH:mm:ss")}`);
    }
    if (res.statusCode !== 200 || new Uint8Array(body) === "") {
        sendtoelect("nowtime", `${(simmode ? "[SIM] " : "")}${res.statusCode} ERROR`);
        return console.error("[PEWS] status: " + res.statusCode);
    }
    servertime = (!simmode ? moment(servertime).format("YYYY/MM/DD HH:mm:ss") : moment(servertime));
    let byteArray = new Uint8Array(body), header = "", binaryStr = lpad(byteArray[0].toString(2), 8);
    for (let i = 0; i < headerLen; i++) header += lpad(byteArray[i].toString(2), 8);
    for (let i = headerLen; i < byteArray.byteLength; i++) binaryStr += lpad(byteArray[i].toString(2), 8);
    if (header.substr(1, 1) === "0") phase = 1;
    else if (header.substr(1, 1) === "1" && header.substr(2, 1) === "0") phase = 2;
    else if (header.substr(2, 1) === "1") phase = 3;
    if (phase >= 2) eqkHandler(binaryStr, byteArray);
    if (!simmode) lasteqkid = "20" + parseInt(header.substr(6, 26), 2);
    if (lastphase !== phase) {
        if (phase === 1) {
            stticlear();
            sendtoelect("eqktitle", "-");
            sendtoelect("eqktime", "----/--/-- --:--:--");
            sendtoelect("maxmmi", "-");
            sendtoelect("swavetime", "-");
            sendtoelect("pwavetime", "-");
            sendtoelect("phaseupdate", phase);
            global.elewin.setProgressBar(0);
            pewsdata = "0|0";
        }
        lastphase = phase;
    }
    if (phase !== 1) {
        const eqkocrdiff = (Math.floor(moment.duration(moment(servertime).add((!simmode ? -9 : 9), "hours").diff(lasteqkocr)).asSeconds()));
        sendtoelect("eqktime", lasteqkocr.format("YYYY/MM/DD HH:mm:ss") + " [" + (eqkocrdiff >= 60 ? Math.floor(eqkocrdiff / 60) + "분" : eqkocrdiff + "초") + " 지남]");
    }
    if (header.substr(0, 1) === "1" || staList.length < 99) fn_getSta(url + ".s", binaryStr);
    else fn_callback(binaryStr);
}

function monitor_on() {
    const { spawn } = require('child_process'),
        DisplayPower = spawn(__dirname + "/DisplayPower.exe").stdout.on('data', (data) => {
            if (data.toString() === "Mouse Moved!") DisplayPower.destroy();
        });
}

const location = (data, callback) => {
    !fs.existsSync(localpath) && fs.mkdirSync(localpath);
    !fs.existsSync(datapath) && fs.mkdirSync(datapath);
    if (!data) {
        if (fs.existsSync(datapath + "location.json")) {
            fs.readFile(datapath + "location.json", "utf8", (err, data) => {
                if (err && callback) return callback();
                try {
                    data = JSON.parse(data);
                    myloclat = data["lat"];
                    myloclon = data["lon"];
                    if (callback) callback({ "lat": myloclat, "lon": myloclon });
                    staredata();
                } catch (e) {
                    dialog.showMessageBox({ type: "error", title: "사용자 위치 불러오기 실패", message: "데이터 파일에 문제가 있어 사용자 위치정보를 불러오지 못하였습니다, 기본값 서울 중구로 설정되었습니다.\n**데이터 파일을 삭제하시고 작업표시줄의 아이콘을 우클릭하여 위치 설정을 하시기 바랍니다.**" });
                    if (callback) callback();
                    return console.error("User location data load fail! ", e);
                }
            });
        } else {
            dialog.showMessageBox({ type: "error", title: "사용자 위치 불러오기 실패", message: "사용자 위치정보를 불러오지 못하였습니다, 기본값 서울 중구로 설정되었습니다.\n**작업표시줄의 아이콘을 우클릭하여 위치 설정이 가능합니다.**" });
            myloclat = 37.56376;
            myloclon = 126.997459;
            location({ "lat": myloclat, "lon": myloclon }, r => {
                if (!r) return dialog.showMessageBox({ type: "error", title: "사용자 위치 데이터 저장 실패", message: "사용자 위치 데이터를 저장하지 못하였습니다" });
                staredata();
            });
            if (callback) callback({ "lat": myloclat, "lon": myloclon });
        }
        return;
    }
    fs.writeFile(datapath + "location.json", JSON.stringify(data), "utf-8", err => {
        if (callback) callback(!err ? true : false);
        myloclat = data["lat"];
        myloclon = data["lon"];
        staredata();
    });
}

function staredata() {
    staList = [];
    nearsta = {};
}

function sendtoelect(name, json) {
    if (global.elewin) global.elewin.webContents.send(name, json);
}

async function getgrid(id, callback) {
    const requestResult = new Promise((resolve, reject) => {
        request.get({ url: pewsurl + id + (phase === 2 ? ".e" : ".i"), encoding: null }, (err, res, body) => {
            if (err) reject(err);
            resolve([res, body]);
        });
    });
    let res, body;
    try {
        [res, body] = await requestResult;
    }
    catch (err) {
        return console.error("[EQK_API] Error: " + err.message);
    }
    if (res.statusCode !== 200 || new Uint8Array(body) === "") {
        callback();
        return console.error("[PEWS-Grid] status: " + res.statusCode);
    }
    if (!body) return callback();
    const byteArray = new Uint8Array(body);
    let gridArr = [];
    for (let i = 0; i < byteArray.length; i++) {
        let gridStr = lpad(byteArray[i].toString(2), 8);
        gridArr.push(parseInt(gridStr.substr(0, 4), 2));
        gridArr.push(parseInt(gridStr.substr(4, 4), 2));
    }
    if (callback) callback(gridArr);
}

function lpad(str, len) {
    while (str.length < len) {
        str = "0" + str;
    }
    return str;
}

function locmmi(gridArr, lat, lon) {
    let cnt = 0;
    if (gridArr.length > 0) {
        for (let i = 38.85; i > 33; i -= 0.05) {
            for (let j = 124.5; j < 132.05; j += 0.05) {
                if (Math.abs(lat - i) < 0.025 && Math.abs(lon - j) < 0.025) return gridArr[cnt];
                cnt++;
            }
        }
    } else {
        return noinfo;
    }
}

async function fn_getSta(url, data) {
    const requestResult = new Promise((resolve, reject) => {
        request.get({ url: url, encoding: null }, (err, res, body) => {
            if (err) reject(err);
            resolve([res, body]);
        });
    });
    let res, body;
    try {
        [res, body] = await requestResult;
    }
    catch (err) {
        return console.error("[PEWS-Sta] Error: " + err.message);
    }
    if (res.statusCode !== 200 || new Uint8Array(body) === "") return console.error("[PEWS-Sta] status: " + res.statusCode, url);
    if (!body) return;
    let byteArray = new Uint8Array(body), binaryStr = "";
    for (let i = 0; i < byteArray.byteLength; i++) {
        binaryStr += lpad(byteArray[i].toString(2), 8);
    }
    staBinHandler(binaryStr);
    fn_callback(data);
}

function staBinHandler(binaryData) {
    let newStaList = [], staLatArr = [], staLonArr = [];
    for (let i = 0; i < binaryData.length; i += 20) {
        staLatArr.push(30 + (parseInt(binaryData.substr(i, 10), 2) / 100));
        staLonArr.push(120 + (parseInt(binaryData.substr(i + 10, 10), 2) / 100));
    }
    for (let i = 0; i < staLatArr.length; i++) {
        let staInfo = new Object();
        staInfo["lat"] = staLatArr[i];
        staInfo["lon"] = staLonArr[i];
        staInfo["idx"] = i;
        staInfo["name"] = (stanamelist[staInfo["lat"] + "," + staInfo["lon"]] || i + "번");
        newStaList.push(staInfo);
    }
    if (newStaList.length > 99) staList = newStaList;
}

function mmiBinHandler(binaryData) {
    if (!binaryData || binaryData.length === 0) return null;
    const binArr = binaryData.split("11111111");
    let mmiArr = [];
    for (let i = 0; i < binArr.length; i++) {
        const mmiObj = new Object();
        mmiObj.mmiData = [];
        for (let j = 8; j < binArr[i].length; j += 4) mmiObj.mmiData.push(parseInt(binArr[i].substr(j, 4), 2));
        mmiArr.push(mmiObj);
    }
    return mmiArr;
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const pi180 = Math.PI / 180,
        aq = (lat2 - lat1) * pi180,
        ay = (lon2 - lon1) * pi180,
        a = Math.sin(aq / 2) * Math.sin(aq / 2) + Math.cos(lat1 * pi180) * Math.cos(lat2 * pi180) * Math.sin(ay / 2) * Math.sin(ay / 2),
        d = (6371e3 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))));
    return Math.floor(d / 1000);
}

const StartSimulation = (data) => {
    if (!data) return;
    let time = String(data["ocr"]);
    time = moment().year(Number(time.substr(0, 4)))
        .month(Number(time.substr(4, 2)))
        .date(Number(time.substr(6, 2)))
        .hours(Number(time.substr(8, 2)))
        .minutes(Number(time.substr(10, 2)))
        .seconds(Number(time.substr(12, 2)))
        .subtract(1, "months")
        .subtract(32410000, "milliseconds");
    timestr = time.format("YYYYMMDDHHmmss");
    let dur = Number(timestr) < 20191101000000 ? 300000 : 500000;
    dur = data["loc"].indexOf("북한") == -1 ? dur : 1200000;
    simmode = true;
    headerLen = 1;
    pewsurl = "https://www.weather.go.kr/pews/data/" + data["id"] + "/";
    servertime = moment(time);
    simautostop = setTimeout(() => {
        if (simautostop) StopSimulation();
    }, dur);
    staredata();
}

const StopSimulation = () => {
    if (simautostop) {
        clearTimeout(simautostop);
        simautostop = null;
    }
    simmode = false;
    headerLen = 4;
    pewsurl = `https://www.weather.go.kr/pews/data/`;
    servertime = moment().subtract(32401000, "milliseconds").format("YYYYMMDDHHmmss");
    staredata();
}

exports.StartSimulation = StartSimulation;
exports.StopSimulation = StopSimulation;
exports.datapath = datapath;
exports.localpath = localpath;
exports.isdev = isdev;
exports.location = location;

exports.makedir = () => {
    !fs.existsSync(localpath) && fs.mkdirSync(localpath);
    !fs.existsSync(datapath) && fs.mkdirSync(datapath);
}

exports.lasteqkid = () => {
    return lasteqkid;
}

exports.timeset = input => {
    if (input) timeset = input;
    return timeset;
}