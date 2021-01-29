module.exports = {
    ymdutc: (time) => {
        if (typeof (time) === "string") return time;
        if (typeof (time) === "number") time = new Date(time);
        let r = time.getUTCFullYear() + "/";
        r += String(time.getUTCMonth() + 1).padStart(2, "0") + "/";
        r += String(time.getUTCDate()).padStart(2, "0") + " ";
        r += String(time.getUTCHours()).padStart(2, "0") + ":";
        r += String(time.getUTCMinutes()).padStart(2, "0") + ":";
        r += String(time.getUTCSeconds()).padStart(2, "0");
        return r;
    },
    ymd: (time) => {
        if (typeof (time) === "string") return time;
        if (typeof (time) === "number") time = new Date(time);
        let r = time.getFullYear() + "/";
        r += String(time.getMonth() + 1).padStart(2, "0") + "/";
        r += String(time.getDate()).padStart(2, "0") + " ";
        r += String(time.getHours()).padStart(2, "0") + ":";
        r += String(time.getMinutes()).padStart(2, "0") + ":";
        r += String(time.getSeconds()).padStart(2, "0");
        return r;
    }
}