module.exports = {
    DistanceLatLon: (lat1, lon1, lat2, lon2) => {
        return Math.floor(Math.sqrt(Math.pow(((lon2 - 124.5) * 113) - (lon1 - 124.5) * 113, 2) + Math.pow(((38.9 - lat2) * 138.4) - (38.9 - lat1) * 138.4, 2)));
    },
    wavecount: (st, t, lat, lon, mylat, mylon) => {
        if (!st || !t || !lat || !lon) return;
        const serverdiff = (new Date(st).getTime() - 32400000 - new Date(t).getTime()) / 1000,
            countdownbase = Math.sqrt(Math.pow((lat - mylat) * 111, 2) + Math.pow((lon - mylon) * 88, 2));
        return [Math.floor((countdownbase / 6) - serverdiff), Math.floor((countdownbase / 3) - serverdiff)];
    },
    timediffstr: (now, past) => {
        if (!now || !past) return "";
        now = new Date(now).getTime();
        past = new Date(past).getTime();
        const diffsec = (now - past) / 1000;
        let result;
        if (diffsec < 60) {
            result = Math.floor(diffsec) + "초";
        } else if (diffsec < 3600) {
            result = Math.floor(diffsec / 60) + "분";
        } else {
            result = Math.floor(diffsec / 60 / 60) + "시간";
        }
        return result;
    }
}