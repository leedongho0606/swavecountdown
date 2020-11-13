const { ipcRenderer } = require("electron");

window.swave = {
    SendToMainProcces: (locdata, callback) => {
        callback(ipcRenderer.sendSync("location", { "lat": locdata["lat"], "lon": locdata["lon"] }));
    }
}

window.addEventListener("load", () => {
    let lastdata = "";
    setInterval(() => {
        const a = document.querySelector(".widget-reveal-card"),
            b = document.querySelector(".widget-reveal-card-lat-lng");
        if (a && a.classList !== null) {
            if (lastdata === b.textContent) return;
            lastdata = b.textContent;
            const latlng = b.textContent.split(", ");
            if (latlng.length != 2) return;
            latlng[0] = Number(latlng[0]);
            latlng[1] = Number(latlng[1]);
            if (confirm(`다음 정보가 맞는지 확인해주세요.\n - 위도: ${latlng[0]}\n - 경도: ${latlng[1]}`)) {
                if (!(latlng[0] >= 33) || !(latlng[0] <= 43) || !(latlng[1] >= 124) || !(latlng[1] <= 132)) alert("한반도내의 경도가 아님이 확인되었습니다.\n지진파 도달 카운트다운이 정상적이지 않을 수 있습니다.");
                swave.SendToMainProcces({ "lat": latlng[0], "lon": latlng[1] }, r => {
                    if (!r) return alert("위치정보를 저장하지 못하였습니다.");
                    alert("위치정보 설정이 반영되었습니다.\n(지진 정보가 수신중인 경우에는 다음 정보때부터 반영됩니다)");
                    window.close();
                });
            }
        }
    }, 500);
});