module.exports.check = (nowver,dialog) => {
    let body = Buffer.alloc(0);
    const https = require("https"),
        r = https.request({
            hostname: "raw.githubusercontent.com",
            path: "/leedongho0606/swavecountdown/main/version.json",
            method: "GET",
        }, (res) => {
            res.on("data", data => {
                body = Buffer.concat([body, data], body.byteLength + Buffer.from(data).byteLength);
            });
            res.once("end", () => {
                if (res.statusCode !== 200 || !body) return;
                body = JSON.parse(body);
                const gitver = body["ver"].split(".");
                nowver = String(nowver).split(".");
                for (let i = 0; i < gitver.length; i++) {
                    if (gitver[i] !== nowver[i]) {
                        dialog.showMessageBox({ type: "question", title: "업데이트 요청", message: "지진파 도달알림 v" + body["ver"] + "이(가) 배포중입니다!\n업데이트 사항:\n" + (body["note"] || "불러오기 실패"), buttons: ["닫기", "다운로드 페이지"] })
                            .then(r => {
                                if (r.response !== 1) return;
                                const { exec } = require('child_process');
                                exec("start https://github.com/leedongho0606/swavecountdown/releases/latest");
                            });
                        break;
                    }
                }
            });
        });
    r.once("error", (err) => {
        reject();
    });
    r.once("timeout", () => {
        reject();
    });
    r.end();
}