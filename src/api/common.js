export function findParentNode(node, parentClassName) {
    let target = node
    while(target) {
        if(target.classList.contains(parentClassName)) {
            return target
        }else {
            target = target.parentNode
        }
    }
    return false
}

export function getDate(dt) {
    let year = dt.getFullYear();
    let month = dt.getMonth() + 1;
    let day = dt.getDate();
    let hour = dt.getHours();
    let minute = dt.getMinutes();
    let second = dt.getSeconds();
    year = year < 10 ? "0" + year : year;
    month = month < 10 ? "0"+ month : month;
    day = day < 10 ? "0" + day : day;
    hour = hour < 10 ? "0" + hour : hour;
    minute = minute < 10 ? "0" + minute : minute;
    second = second < 10 ? "0" + second : second;

    return year + "-" + month + "-" + day + " " + hour + ":" + minute + ":" + second;
}