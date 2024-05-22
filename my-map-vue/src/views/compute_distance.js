/**
 * 通过经纬度坐标计算两点距离
 */

const EARTH_RADIUS = 6371009;      // 地球平均半径大约6371km

function hav(theta) {
    var s = Math.sin(theta / 2);
    return s * s;
}

function radians(degree) {
    return degree * Math.PI / 180.0;
}

function get_distance_hav(p1, p2) {
    // 用haversine公式计算球面两点间的距离
    // 经纬度转换成弧度
    var lat0 = radians(p1[1]);
    var lat1 = radians(p2[1]);
    var lng0 = radians(p1[0]);
    var lng1 = radians(p2[0]);
    var dlng = Math.abs(lng0 - lng1);
    var dlat = Math.abs(lat0 - lat1);
    var h = hav(dlat) + Math.cos(lat0) * Math.cos(lat1) * hav(dlng);
    var distance = 2 * EARTH_RADIUS * Math.asin(Math.sqrt(h)); // 单位：m
    return distance;
}

export {
    get_distance_hav
}