<script setup>
import { gcj02towgs84, wgs84togcj02 } from './GCJ02-WGS84.js'
import { get_distance_hav } from './compute_distance.js'

import Map from '../views/Map/Map.vue'
import { reactive, ref, nextTick } from 'vue'
import AMapLoader from '@amap/amap-jsapi-loader';

import Zoom from 'ol/control/Zoom.js'
import ZoomSlider from 'ol/control/ZoomSlider.js'
import ZoomToExtent from 'ol/control/ZoomToExtent.js'

import ScaleLine from 'ol/control/ScaleLine.js'

import OverviewMap from 'ol/control/OverviewMap.js'
import TileLayer from 'ol/layer/Tile.js'

import MousePosition from 'ol/control/MousePosition.js'
import { createStringXY } from 'ol/coordinate'

import XYZ from 'ol/source/XYZ.js'
import BingMaps from 'ol/source/BingMaps.js'
import OSM from 'ol/source/OSM.js'
import TileImage from 'ol/source/TileImage.js'
import TileGrid from 'ol/tilegrid/TileGrid.js'

import VectorLayer from 'ol/layer/Vector.js'
import TileWMS from 'ol/source/TileWMS.js'
import WMTS from 'ol/source/WMTS.js'
import VectorSource from 'ol/source/Vector.js'
import WMTSTileGrid from 'ol/tilegrid/WMTS.js'
import { bbox as bboxStrategy } from 'ol/loadingstrategy.js'
import GeoJSON from 'ol/format/GeoJSON.js'
import { get as getProj } from 'ol/proj'
import { getWidth } from 'ol/extent'

import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import LineString from 'ol/geom/LineString'
import Polygon from 'ol/geom/Polygon'
import { getArea } from "ol/sphere";
import { ElMessageBox } from 'element-plus'
import { Fill, Stroke, Circle, Style, Text } from 'ol/style'
import Overlay from 'ol/Overlay.js'
import Select from 'ol/interaction/Select.js'
import { click } from 'ol/events/condition.js'
import { ElNotification } from 'element-plus'

let mapall = null; //从地图创建函数获取地图组件

// 天地图key
const cxApp =
{
    tianKey: 'b387b606afd9c346236f767123461927',
}

// 引入高德API服务
window._AMapSecurityConfig = {
    securityJsCode: 'e4e85f9be5cd4ca7a259bde752fee958'//申请好的秘钥
}
let gaode_map = null;
let auto_tips = null;
let geocoder = null;
let driving = null;

var autoOptions = { // 搜索输入提示
    input: "sole-input"
};
const creat_gaode_server = (container) => {
    AMapLoader.load({
        key: "58463e12e790a09ad9c7ca37c46120c8", // 申请好的Web端开发者Key，首次调用 load 时必填
        version: "2.0", // 指定要加载的 JSAPI 的版本，缺省时默认为 1.4.15
        plugins: ['AMap.Geocoder', 'AMap.AutoComplete', 'AMap.Driving'],
    })
        .then((AMap) => {
            gaode_map = new AMap.Map(container, {  //设置地图容器id
                viewMode: "3D",    //是否为3D地图模式
                zoom: 12,           //初始化地图级别
                center: [114.299323, 30.596], //初始化地图中心点位置
            });
            //输入提示
            auto_tips = new AMap.AutoComplete(autoOptions);
            auto_tips.on("select", function (e) {
                search_result();
            });//注册监听，当选中某条记录时会触发
            // 地点搜索
            geocoder = new AMap.Geocoder();
            // 导航路线
            driving = new AMap.Driving({
                map: gaode_map,
                panel: "path-show"
            });
        })
}
creat_gaode_server("gaodemap");


// -------------------- 1、控件 --------------------
// 缩放控件
const createZoom = map => {
    const zoom = new Zoom()
    const zoomSlider = new ZoomSlider()
    const zoomToExtent = new ZoomToExtent()
    // 缩放控件添加到地图
    map.addControl(zoom)
    map.addControl(zoomSlider)
    map.addControl(zoomToExtent)
}

// 比例尺控件
let olmap = null
let scale = null
const createScale = map => {
    olmap = map

    // 创建默认比例尺
    onScaleChange()
}
const onScaleChange = type => {
    if (!olmap)
        return

    // 移除旧比例尺
    scale && olmap.removeControl(scale)
    // 创建新比例尺
    scale = new ScaleLine({ bar: type === 'bar' })
    // 添加到地图
    olmap.addControl(scale)
}

// 鹰眼控件
const createOverviewMap = map => {
    // 获取主地图
    const baseLayer = map.getLayers().item(0)
    const miniMap = new OverviewMap({
        collapsed: false,
        layers: [new TileLayer({ source: baseLayer.getSource() })]
    })

    map.addControl(miniMap)
}

let x, y = 0;
// 鼠标位置
const createMousePosition = map => {
    const control = new MousePosition({
        className: 'mousPos',
        coordinateFormat: function (e) { // 这里格式化成 X: **  Y: **
            let stringifyFunc = createStringXY(8)
            let str = stringifyFunc(e)
            x = str.split(',')[0]
            y = str.split(',')[1]
            return 'X: ' + x + '&nbsp;' + ' Y: ' + y
        },
        projection: 'EPSG:4326',
        undefinedHTML: '&nbsp;'

    })
    map.addControl(control)
}


// -------------------- 2、绘制 --------------------
// 1 点
const vectorLayer_point = new VectorLayer({
    source: new VectorSource({
        features: []
    }),
    style: new Style({
        image: new Circle({
            radius: 4,                             // 半径
            fill: new Fill({ color: 'rgb(255,0,0,0.1)' }),         // 填充色
            stroke: new Stroke({ color: 'red' })   // 边框
        })
    })
})

// 2 线
const vectorLayer_line = new VectorLayer({
    source: new VectorSource({
        features: []
    }),
    style: (feature) => {
        // 标注样式
        let textstyle = null;
        if (feature.getGeometry().getType() === 'Point') {
            textstyle = feature.get('distance');
            // 单位转换
            if (textstyle > 1000) {
                textstyle = (textstyle / 1000).toFixed(2).toString() + '千米';
            }
            else {
                textstyle = textstyle.toFixed(2).toString() + '米';
            }
        }
        const style_line = new Style({
            stroke: new Stroke({ color: 'rgb(255,0,0,0.5)', width: 3 }),
            text: new Text({
                text: textstyle, //文本内容
                font: '15px Calibri,sans-serif',
                offsetY: -15,
                fill: new Fill({ color: '#000' }),
                stroke: new Stroke({ color: '#fff', width: 3 })
            })
        })
        return style_line;
    }
})

// 3 面
const vectorLayer_polygon = new VectorLayer({
    source: new VectorSource({
        features: []
    }),
    style: (feature) => {
        // 标注样式
        let textstyle = null;
        if (feature.getGeometry().getType() === 'Point') {
            // 单位转换
            textstyle = feature.getProperties().area;
            if (textstyle > 1000000) {
                textstyle = (textstyle / 1000000).toFixed(4).toString() + '平方千米';
            }
            else {
                textstyle = textstyle.toFixed(2).toString() + '平方米';
            }
        }
        const style_polygon = new Style({
            fill: new Fill({ color: 'rgb(255,0,0,0.3)' }),
            text: new Text({
                text: textstyle, //文本内容
                font: '15px Calibri,sans-serif',
                offsetY: -15,
                fill: new Fill({ color: '#000' }),
                stroke: new Stroke({ color: '#fff', width: 3 })
            })
        })
        return style_polygon;
    }
})

// 将图层添加到地图上
const onDrawPointCreate = (map) => {
    map.addLayer(vectorLayer_point);
    map.addLayer(vectorLayer_line);
    map.addLayer(vectorLayer_polygon);
}


// 地图绘制
// 控制:    0：不绘制    1：点   2：线   3：面
let draw_control = 0;
let points_temp = [];   // 折线的点数组
let polygon_points_temp = [];   // 一个的多边形顶点数组
let count_right = 0;    // 右键次数（控制多边形） 0：开始绘制/绘制中；1：完成上一个图形绘制；2：完成所有图形绘制

// 按钮点击事件
const painting_point = () => {
    draw_control = 1;
    points_temp = [];
    document.body.style.cursor = "crosshair"; //鼠标变成十字
}
const painting_line = () => {
    draw_control = 2;
    points_temp = [];
    document.body.style.cursor = "crosshair";
}
const painting_polygon = () => {
    draw_control = 3;
    points_temp = [];
    document.body.style.cursor = "crosshair";
}

// 气泡标注（用于标注地点）
const overlayDlg = ref(null)
const popupCloser = ref(null)
const popupContent = ref(null)
let popup = null
const onPopupLabelCreate = (address, setPosition) => {
    popup = new Overlay({
        element: overlayDlg.value,                             // 将自己写的 html 内容添加到覆盖层，html 内容略
        positioning: 'bottom-center',                          // 覆盖层位置
        autoPan: false,                                         // 是否自动平移，当点击时对话框超出屏幕边距，会自动平移地图使其可见
        autoPanMargin: 20,                                     // 设置自动平移边距
        offset: [0, -20]                                       // 覆盖层偏移起点的位置
    })
    popupContent.value.innerHTML = address;
    popup.setPosition(setPosition);
    // 添加popup到地图上
    mapall.addOverlay(popup);
}
// 关闭气泡标注
const onClose = () => {
    popup.setPosition(undefined);
    // popupCloser.value.blur();
    return false
}


// 在地图上点击关联函数
const painting = (e) => {
    // 屏蔽浏览器右键
    document.oncontextmenu = function () {
        return false;
    }

    // 点
    const draw_point = function () {
        vectorLayer_point.getSource().addFeature(
            new Feature({
                geometry: new Point([x, y])
            })
        )
    }
    // 线
    const draw_line = function () {
        draw_point();
        var prev_point = points_temp[points_temp.length - 1];
        points_temp.push([x, y]);
        if (points_temp.length > 1) {
            var line = new Feature({
                geometry: new LineString([prev_point, [x, y]])
            });
            vectorLayer_line.getSource().addFeature(line);
            if (draw_control == 2) {
                var last_point = new Feature({
                    geometry: new Point([x, y]),
                    distance: get_distance_hav(prev_point, [x, y])
                })
                vectorLayer_line.getSource().addFeature(last_point);
            }
        }
    }

    // 绘制点
    if (draw_control == 1) {
        if (e.button == 0) {
            draw_point();
            regeoCode();
            document.body.style.cursor = "default";
            draw_control = 0;
        }
    }
    // 绘制线
    else if (draw_control == 2) {
        if (e.button == 0) {
            draw_line();
        }
    }
    // 绘制面
    else if (draw_control == 3) {
        if (e.button == 0) {
            // 上一个图形绘制完之后不将折线连接到下一个图形
            if (count_right != 1) {
                draw_line();
            }
            draw_point();
            // 将忽略的点重新加入折线的数组
            points_temp.push([x, y]);
            polygon_points_temp.push([x, y]);
            count_right = 0;
        }
        else if (e.button == 2) {
            count_right++;
            // ↓右键一次，绘制图形
            if (count_right != 2) {
                if (polygon_points_temp.length < 3) {
                    ElMessageBox.alert('两个顶点不能构建多边形', '提示');
                    count_right = 0;
                    return;
                }

                // 绘制多边形最后一条线
                vectorLayer_line.getSource().addFeature(new Feature({
                    geometry: new LineString([polygon_points_temp[polygon_points_temp.length - 1], polygon_points_temp[0]])
                }));
                points_temp = [];

                // 绘制多边形
                polygon_points_temp.push(polygon_points_temp[0]); // 添加多边形终点为起点
                const new_polygon = new Polygon([polygon_points_temp]);
                vectorLayer_polygon.getSource().addFeature(new Feature({ geometry: new_polygon }));
                // 添加点对多边形的面积进行标注
                var first_point = new Feature({
                    geometry: new Point(polygon_points_temp[0]),
                    area: getArea(new_polygon, {
                        projection: 'EPSG:4326'
                    })
                })
                vectorLayer_polygon.getSource().addFeature(first_point);
                polygon_points_temp = [];

                return; // 跳过右键重置所有点
            }
        }
    }

    // 右键，重置所有点
    if (e.button == 2) {
        if (draw_control != 0) {
            vectorLayer_point.getSource().clear();
            vectorLayer_line.getSource().clear();
            vectorLayer_polygon.getSource().clear();
            points_temp = [];
            count_right = 0;

            //鼠标变成默认
            document.body.style.cursor = "default";
            draw_control = 0;
            change_map_function("none");
            onClose(); //关闭气泡提示
        }
    }

}


// -------------------- 3、地图图层 --------------------
// 公开地图切换
// 1-创建天地图
const createLyrTian = () => {
    return new TileLayer({
        properties: {
            name: 'tian',
            title: '天地图影像',
        },
        visible: false,
        source: new XYZ({
            projection: 'EPSG:4326',
            url: `http://t{0-7}.tianditu.gov.cn/img_c/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=c&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${cxApp.tianKey}`,
        })
    })
}

// 2-创建百度地图
const createLyrBd = () => {
    let url = 'http://online{0-3}.map.bdimg.com/onlinelabel/?qt=tile&x={x}&y={y}&z={z}&styles=pl&udt=20191119&scaler=1&p=1'

    // 构造分辨率序列
    const resolutions = []
    for (let i = 0; i < 19; i++)
        resolutions.push(Math.pow(2, 18 - i))

    // 创建切片规则对象
    const tileGrid = new TileGrid({
        origin: [0, 0],
        resolutions
    })

    return new TileLayer({
        properties: {
            name: 'baidu',
            title: '百度地图',
        },
        visible: false,
        source: new TileImage({
            projection: 'EPSG:3857',
            tileGrid: tileGrid,
            tileUrlFunction: function (tileCoord, pixelRatio, proj) {
                if (!tileCoord)
                    return ''

                let tempUrl = url
                tempUrl = tempUrl.replace('{x}', tileCoord[1] < 0 ? `M${-tileCoord[1]}` : tileCoord[1])
                tempUrl = tempUrl.replace('{y}', tileCoord[2] < 0 ? `M${tileCoord[2] + 1}` : -(tileCoord[2] + 1))
                tempUrl = tempUrl.replace('{z}', tileCoord[0])

                // 范围替换
                var match = /\{(\d+)-(\d+)\}/.exec(tempUrl)
                if (match) {
                    var delta = parseInt(match[2]) - parseInt(match[1])
                    var num = Math.round(Math.random() * delta + parseInt(match[1]))
                    tempUrl = tempUrl.replace(match[0], num.toString())
                }
                return tempUrl
            }
        })
    })
}

// 3-创建高德地图
const createLyrGd = () => {
    return new TileLayer({
        properties: {
            name: 'gaode',
            title: '高德地图',
        },
        visible: false,
        source: new XYZ({
            url: 'http://webrd0{1-4}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scl=1&style=8&lstyle=7&x={x}&y={y}&z={z}',
        })
    })
}

// 4-创建OpenStreetMap地图
const createLyrOSM = () => {
    return new TileLayer({
        properties: {
            name: 'osm',
            title: 'OpenStreetMap地图',
        },
        visible: false,
        source: new OSM()
    })
}

// 5-创建Bing地图
const createLyrBing = () => {
    // 你的key, 如AvehefmVM_surC2UyDjyO2T_EvSgRUA9Te3_9D_xxxxxxx
    const key = 'AvehefmVM_surC2UyDjyO2T_EvSgRUA9Te3_9D_sj88ZYEBNNWxaufCSPGzecf-B'
    return new TileLayer({
        properties: {
            name: 'bing',
            title: 'Bing地图',
        },
        visible: false,
        source: new BingMaps({
            key: key,
            imagerySet: 'RoadOnDemand'
        })
    })
}

// 5-创建Arcgis地图
const createLyrArc = () => {
    return new TileLayer({
        properties: {
            name: 'arc',
            title: 'Arcgis地图',
        },
        visible: false,
        source: new XYZ({
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            projection: 'EPSG:3857'
        })
    })
}

// 添加图层
let olmap1 = null
let layers1 = []
const checks1 = ref([])
const onMapCreate1 = map => {
    olmap1 = map
    map.addLayer(createLyrTian())
    map.addLayer(createLyrBd())
    map.addLayer(createLyrGd())
    map.addLayer(createLyrOSM())
    map.addLayer(createLyrBing())
    map.addLayer(createLyrArc())

    layers1 = map.getLayers().getArray().map(layer => {
        layer.getVisible() && checks1.value.push(layer.get('name'))
        return {
            name: layer.get('name'),
            title: layer.get('title'),
            locate: layer.get('locate'),
            layer
        }
    })
}

// 图层开关控制
const onCheckChange1 = () => {
    if (!olmap1)
        return

    let lastLocate = null
    layers1.forEach(layer => {
        layer.layer.setVisible(checks1.value.includes(layer.name))
        if (layer.name === checks1.value[checks1.value.length - 1])
            lastLocate = layer.locate
    })

    if (lastLocate) {
        olmap1.getView().setZoom(lastLocate[2])
        olmap1.getView().setCenter([lastLocate[0], lastLocate[1]])
    }
}


// -------------------- 4、地图服务 --------------------
// 加载WMS、WMTS、WFS服务
// 图层输入提示框
const input_layer_name = () => {
    let ovalue = prompt(
        '请输入图层名称(如:nurc:mosaic,tiger:tiger_roads)',
        'tiger:tiger_roads',
        {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: "warning",
            inputValue: 'tiger:tiger_roads',
        })
    return ovalue;
}

let serverlayer_wms = null;
let serverlayer_wmts = null;
let serverlayer_wfs = null

// WMS
const createLyrWMS = () => {
    const ovalue = input_layer_name();
    // 检查输入内容
    if (ovalue != '') {
        let tempovalue = ovalue.split(':');
        if (tempovalue.length == 1) {
            ElMessageBox.alert('输入格式错误', '提示');
            return;
        }
    }
    else {
        ElMessageBox.alert('输入为空', '提示');
        return;
    }
    // 检查请求的数据是否有问题
    try {
        const url = '/local/geoserver/nurc/wms'
        serverlayer_wms = new TileLayer({
            properties: {
                name: 'wms',
                title: 'WMS服务',
            },
            visible: true,
            source: new TileWMS({
                url: url,
                params: { 'LAYERS': ovalue },
                projection: 'EPSG:4326',
                ratio: 1,
                serverType: 'geoserver'
            }),
        })
        mapall.addLayer(serverlayer_wms);
    }
    catch (error) {
        ElMessageBox.alert(error.message, '错误');
    }
}

// WMTS
const createLyrWMTS = () => {
    // 1-构造分辨率序列
    const size = getWidth(getProj('EPSG:4326').getExtent()) / 256
    const resolutions = []
    const matrixIds = []
    for (let i = 0; i < 19; i++) {
        resolutions.push(size / Math.pow(2, i))
        matrixIds.push(i)
    }

    // 2-创建切片规则对象
    const tileGrid = new WMTSTileGrid({
        origin: [-180, 90],
        resolutions: resolutions,
        matrixIds: matrixIds
    })

    // 3-创建瓦片图层和wmts数据源
    serverlayer_wmts = new TileLayer({
        properties: {
            name: 'wmts',
            title: 'WMTS服务',
        },
        visible: true,
        source: new WMTS({
            url: `http://t{0-7}.tianditu.gov.cn/vec_c/wmts?tk=${cxApp.tianKey}`,
            projection: 'EPSG:4326',
            tileGrid: tileGrid,
            crossOrigin: '*',
            format: 'image/png',
            layer: 'vec',
            matrixSet: 'c',
            style: 'default'
        })
    })
    mapall.addLayer(serverlayer_wmts);

}

// 用于检查是否为GeoJSON格式  
function isGeoJSON(obj) {
    const typeGeoJSON = {
        types: ['Feature', 'FeatureCollection', 'GeometryCollection', 'Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon', 'Geometry', 'Circle', /* 其他可能的类型 */],
    };
    return obj && typeof obj === 'object' && obj.type && typeGeoJSON.types.indexOf(obj.type) !== -1;
}

// WFS
const createLyrWFS = async () => {
    const ovalue = input_layer_name();
    if (ovalue != '') {
        let tempovalue = ovalue.split(':');
        if (tempovalue.length == 1) {
            ElMessageBox.alert('输入格式错误', '提示');
            return;
        }
    }
    else {
        ElMessageBox.alert('输入为空', '提示');
        return;
    }
    const url = `/local/geoserver/wfs?service=WFS&version=1.0.0&request=GetFeature&typename=${ovalue}&outputFormat=application/json&srsname=EPSG:4326&`;
    // 检查请求的数据是否有问题
    try {
        // 发送GET请求到WFS服务URL  
        const response = await fetch(url);
        // 检查响应状态码  
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);

        }
        // 读取响应
        const jsonData = await response.json();
        // 检查是否为GeoJSON格式  
        if (!isGeoJSON(jsonData)) {
            throw new Error('返回的数据不是GeoJSON格式');
        }
        // 先获取地图中心
        const center_to_map = jsonData['features'][0]['geometry']['coordinates'][0][0];

        // 检查没有问题之后创建图层
        serverlayer_wfs = new VectorLayer({
            properties: {
                name: 'wfs',
                title: 'WFS服务',
            },
            visible: true,
            source: new VectorSource({
                format: new GeoJSON(),
                url: url,
                strategy: bboxStrategy
            }),
            style: {
                'stroke-width': 2,
                'stroke-color': 'red',
                'fill-color': 'rgba(100,100,100,0.25)'
            }
        })
        mapall.addLayer(serverlayer_wfs);
        // 调整地图显示
        mapall.getView().animate({
            center: center_to_map, // 中心点
            zoom: 7, // 缩放级别
        })
        // 添加选中图形功能
        addInteraction();

    }
    catch (error) {
        ElMessageBox.alert(error.message, '错误');
    }

}

// 移除服务图层
const removelayers = () => {
    mapall.removeLayer(serverlayer_wms);
    mapall.removeLayer(serverlayer_wmts);
    mapall.removeLayer(serverlayer_wfs);
    mapall.removeInteraction(selectClick);  //移除选中图形功能
}

// 图形操作
// 图形选中
const selectStyle = () => {
    return new Style({
        fill: new Fill({
            color: 'red'
        }),
        stroke: new Stroke({
            color: 'rgba(255, 255, 255, 0.7)',
            width: 2
        }),
        image: new Circle({
            radius: 5,
            fill: new Fill({ color: '#319FD3' }),
            stroke: new Stroke({ color: '#319FD3' })
        })
    })
}

const selectClick = new Select({
    condition: click,
    style: selectStyle
})

const addInteraction = () => {
    mapall.addInteraction(selectClick)
    selectClick.on('select', (e) => {
        ElNotification({
            title: '资源信息',
            type: 'success',
            showClose: false,
            message:
                e.target.getFeatures().getArray()[0].getProperties().NAME
        })
    })
}

// -------------------- 5、地图搜索 --------------------
// 根据经纬度查询地址（地图标记）（逆地理编码）
const regeoCode = () => {
    const search_x = x;
    const search_y = y;
    geocoder.getAddress(wgs84togcj02(search_x, search_y),
        function (status, result) {
            if (status === 'complete' && result.regeocode) {
                const index_result = result.regeocode;
                const address = index_result.formattedAddress;
                onPopupLabelCreate(address, [search_x, search_y]);

                // 详细信息显示
                area_data.data_name = address;
                area_data.data_address = index_result.addressComponent.province + ' '
                    + index_result.addressComponent.city + ' '
                    + index_result.addressComponent.district;
                area_data.data_adcode = '行政区划代码:' + index_result.addressComponent.adcode;
                area_data.data_location = 'lng:' + search_x + ' lat:' + search_y;
                area_data.index_show = '1 / 1';
                // 显示div
                change_map_function("block");
            } else {
                onPopupLabelCreate('根据经纬度查询地址失败', [search_x, search_y]);
            }
        });
}

// 搜索结果的点的图层
const vectorLayer_search = new VectorLayer({
    source: new VectorSource({
        features: []
    }),
    style: new Style({
        image: new Circle({
            radius: 4,                             // 半径
            fill: new Fill({ color: 'rgb(0,0,255,0.1)' }),         // 填充色
            stroke: new Stroke({ color: 'blue' })   // 边框
        })
    })
})

// 根据地址查询经纬度（地理编码）
// 响应式数据
const area_data = reactive({
    data_name: '',
    data_address: '',
    data_adcode: '',
    data_location: '',
    index_show: '',
})

// 搜索框搜索功能
let search_input = ref(null);   //获取输入内容
let location_result = [];   // 搜索结果
const search_result = () => {
    geocoder.getLocation(search_input.value.value, function (status, result) {
        if (status === 'complete' && result.geocodes.length) {
            location_result = result.geocodes;  // 获取地点搜索结果
            result_show(location_result, 0);    // 搜索完成后展示
        } else {
            alert('根据地址查询位置失败');
        }
    });
}

// 组件显示
const map_function = ref(0);
// 更改显示样式（display:block/none）
const change_map_function = async (display) => {
    await nextTick()
    map_function.value.style.display = display;
}

// 搜索完成后展示
const result_show = (location_result, index) => {
    const index_result = location_result[index];
    const lng = index_result.location.lng;
    const lat = index_result.location.lat;
    const transform_lnglat = gcj02towgs84(lng, lat);  //坐标转换

    // 详细信息显示
    area_data.data_name = index_result.formattedAddress;
    area_data.data_address = index_result.addressComponent.province + ' '
        + index_result.addressComponent.city + ' '
        + index_result.addressComponent.district;
    area_data.data_adcode = '行政区划代码:' + index_result.adcode;
    area_data.data_location = 'lng:' + transform_lnglat[0] + ' lat:' + transform_lnglat[1];
    area_data.index_show = (index + 1).toString() + ' / ' + location_result.length.toString();

    // 显示div
    change_map_function("block");

    // 地图添加搜索结果点
    vectorLayer_search.getSource().addFeature(
        new Feature({
            geometry: new Point(transform_lnglat)
        })
    )
    // 气泡标注
    onPopupLabelCreate(search_input.value.value, transform_lnglat);
    // 设置地图视图显示
    mapall.getView().animate({
        center: transform_lnglat, // 中心点
        zoom: 15, // 缩放级别
    })
}

// “下一个结果”按钮
let index_index = 0;
const next_result = () => {
    if (index_index < location_result.length - 1) {
        index_index++;
        result_show(location_result, index_index);
    }
}
// “上一个结果”按钮
const prev_result = () => {
    if (index_index > 0) {
        index_index--;
        result_show(location_result, index_index);
    }
}


// “到这去”按钮
const end_point = () => {
    path_end.value.value = area_data.data_name;
    change_map_function("none");
    path_search_box_display("block");
}

// “从这出发”按钮
const begin_point = () => {
    path_start.value.value = area_data.data_name;
    change_map_function("none");
    path_search_box_display("block");
}

// 清空搜索结果
const clear_search = () => {
    search_input.value.value = '';  // 清空搜索框
    path_start.value.value = '';    // 清空导航输入框
    path_end.value.value = '';
    // 移除列表显示路线的所有内容
    while (path_show.value.firstChild) {
        path_show.value.removeChild(path_show.value.firstChild);
    }
    vectorLayer_path.getSource().clear();   // 清除路线
    vectorLayer_point.getSource().clear();  // 清除标记
    vectorLayer_search.getSource().clear(); // 清除搜索结果点
    change_map_function("none");    // 隐藏详细信息框
    onClose();  // 关闭气泡提示
}


// -------------------- 6、地图路线 --------------------
// 路线图层
const vectorLayer_path = new VectorLayer({
    source: new VectorSource({
        features: []
    }),
    style: new Style({
        stroke: new Stroke({ color: 'rgb(255,0,0,0.8)', width: 5 }),
    })

})

let map_path_search = ref(null);    // 起点终点输入框的父标签
let path_show = ref(null);  // 用于展示路线列表的div

// 搜索框样式设置为显示（display:block/none）
const path_search_box_display = async (display) => {
    await nextTick()
    map_path_search.value.style.display = display;
    path_show.value.style.display = display;
}

// 搜索框旁的路线按钮
const path_search_show = () => {
    // 移除列表显示路线的所有内容
    while (path_show.value.firstChild) {
        path_show.value.removeChild(path_show.value.firstChild);
    }
    // 搜索框显示或隐藏
    if (map_path_search.value.style.display == "none" || path_show.value.style.display == "") {
        path_search_box_display("block");
    }
    else {
        path_search_box_display("none");
        path_start.value.value = '';
        path_end.value.value = '';
    }
    // 移除路线
    vectorLayer_path.getSource().clear();
}

// 获取起点终点的输入信息
let path_start = ref(null); 
let path_end = ref(null);

// 导航路径搜索按钮
const map_path = () => {
    // 搜索前移除先前搜索的路线
    vectorLayer_path.getSource().clear();
    const start_keyword = path_start.value.value;
    const end_keyword = path_end.value.value;

    // 根据起终点名称规划驾车导航路线
    driving.search([
        { keyword: start_keyword },
        { keyword: end_keyword }
    ], function (status, result) {
        if (status === 'complete') {
            // 展示路径
            mappath_show(result.routes);
        } else {
            alert('获取驾车数据失败：' + result)
        }
    });
}

// 起点终点反转按钮
const search_reversal = () => {
    const temptext = path_start.value.value;
    path_start.value.value = path_end.value.value;
    path_end.value.value = temptext;
}

// 根据返回的路线搜索结果显示路线图层及更改地图视图
const mappath_show = (routes) => {
    const steps = routes[0].steps;
    let path_points = [];
    const path_firstpoint = gcj02towgs84(steps[0].start_location.KL, steps[0].start_location.kT);
    path_points.push(path_firstpoint);
    for (let i = 0; i < steps.length; i++) {
        const one_path = steps[i].path;
        for (let j = 0; j < one_path.length; j++) {
            path_points.push(gcj02towgs84(one_path[j].KL, one_path[j].kT));
        }

    }
    vectorLayer_path.getSource().addFeature(new Feature({
        geometry: new LineString(path_points)
    }));
    mapall.getView().animate({
        center: path_firstpoint, // 中心点
        zoom: 12, // 缩放级别
    })
    try {
        mapall.addLayer(vectorLayer_path);
    }
    catch (error) {

    }

}

// -----------------------------------------------------------------------------
// 所有控件
const all_create = map => {
    mapall = map;
    createZoom(map);
    createOverviewMap(map);
    createScale(map);
    createMousePosition(map);
    onMapCreate1(map);
    onDrawPointCreate(map);
    map.addLayer(vectorLayer_search);

}
</script>

<template>
    <!-- 地图组件 -->
    <Map :def-lyrs="['img_c', 'vec_c', 'cva_c']" @created="all_create" :defaultControl="[]" @mousedown="painting"></Map>
    <!-- 图层切换 -->
    <el-card class="control">
        <el-checkbox-group v-model="checks1" @change="onCheckChange1">
            <el-checkbox v-for="layer in layers1" :key="layer.name" :label="layer.name">{{ layer.title }}</el-checkbox>
        </el-checkbox-group>
    </el-card>
    <!-- 地点搜索 -->
    <div id="left-panel" class style="height: 142px;">
        <div id="searchbox" class="clearfix">
            <div id="searchbox-container">
                <div id="sole-searchbox-content" class="searchbox-content">
                    <input id="sole-input" class="searchbox-content-common" type="text" name="word" autocomplete="off"
                        maxlength="256" placeholder="地点搜索" value="" ref="search_input">
                    <div class="input-clear" title="清空" @click="clear_search"></div>
                    <div class="searchbox-content-button right-button route-button loading-button" data-title="路线"
                        @click="path_search_show">
                    </div>
                </div>
            </div>

            <button id="search-button" data-title="搜索" data-tooltip="2" @click="search_result"></button>
        </div>
    </div>
    <!-- 路线搜索 -->
    <div class="map-path" ref="map_path_search">
        <div class="routebox">
            <div class="searchbox-content-common routebox-content">
                <div class="routebox-revert" title="切换起终点" @click="search_reversal">
                    <div class="routebox-revert-icon"> </div>
                </div>
                <div class="routebox-inputs">
                    <div class="routebox-input route-start">
                        <div class="route-input-icon"></div>
                        <input autocomplete="off" maxlength="256" placeholder="输入起点或在图区上选点" class="route-start-input"
                            type="text" value="" ref="path_start">
                    </div>
                    <div class="routebox-input route-end">
                        <div class="route-input-icon"></div>
                        <input autocomplete="off" maxlength="256" placeholder="输入终点" class="route-end-input" type="text"
                            value="" ref="path_end">
                    </div>
                </div>
            </div>
        </div>
        <i></i>
        <button id="search-path-button" data-title="搜索" data-tooltip="2" @click="map_path"></button>
    </div>
    <!-- 路线详细 -->
    <div id="path-show" class="path-show" ref="path_show"></div>
    <!-- 地点搜索详细内容 -->
    <div class="map-function" ref="map_function">

        <div class="area-data">
            <p class="data-name">{{ area_data.data_name }}</p>
            <p class="data-address">{{ area_data.data_address }}</p>
            <p class="data-adcode">{{ area_data.data_adcode }}</p>
            <p class="data-location">{{ area_data.data_location }}</p>
        </div>
        <hr>
        <div class="previous-next">
            <button class="init_buttom" @click="prev_result">←</button>
            <span style="float: left;width: 20%;text-align: center;">{{ area_data.index_show }}</span>
            <button class="init_buttom" @click="next_result">→</button>
        </div>
        <div style="clear:both;"></div>
        <div class="area-path">
            <div class="path-end" @click="end_point" style="border-right: 1px solid #b6b6b6;">
                <a href="#">↓ 到这去</a>
            </div>
            <div class="path-start" @click="begin_point" style="border-left: 1px solid #b6b6b6;">
                <a href="#">从这出发 ↗</a>
            </div>
        </div>
    </div>
    <!-- 工具箱 -->
    <div class="painting">
        <div class="map-tools painting-all">
            <p>工具箱</p>
            <div class="tools-show">
                <a class="b1" @click="painting_point">标记</a>
                <a class="b1" @click="painting_line">测距</a>
                <a class="b1" @click="painting_polygon">面积</a>
            </div>
        </div>

        <div class="map-server painting-all">
            <p>地图服务</p>
            <div class="server-show">
                <a class="b1" @click="createLyrWMS">WMS服务</a>
                <a class="b1" @click="createLyrWMTS">WMTS服务</a>
                <a class="b1" @click="createLyrWFS">WFS服务</a>
                <a class="b1" @click="removelayers">清除图层</a>
            </div>
        </div>
    </div>
    <!-- 气泡标注 -->
    <div ref="overlayDlg" class="popup" title="右键取消">
        <div ref="popupContent"></div>
    </div>
    <!-- 用于装载高德地图 -->
    <!-- 仅调用功能，不渲染 -->
    <!-- visibility: hidden; -->
    <div id="gaodemap"></div>
</template>

<style>
#left-panel {
    position: absolute;
    left: 50px;
    top: 20px;
    overflow: hidden;
    pointer-events: none;
    z-index: 5;
}

#searchbox {
    border-radius: 2px;
    width: 425px;
    position: relative;
    z-index: 5;
}

#searchbox #searchbox-container {
    position: relative;
    z-index: 2;
    pointer-events: auto;
    width: 368px;
    float: left;
    box-sizing: border-box;
    box-shadow: 1px 2px 1px rgba(0, 0, 0, .15);
}

#sole-searchbox-content {
    position: relative;
}

.searchbox-content {
    width: 368px;
    height: 38px;
    border-radius: 2px 0 0 2px;
    background: #fff;
}

#sole-searchbox-content #sole-input {
    box-sizing: border-box;
    border: 0;
    padding: 9px 0;
    border-left: 10px solid transparent;
    border-right: 27px solid transparent;
    line-height: 20px;
    font-size: 16px;
    height: 38px;
    color: #333;
    position: relative;
    border-radius: 2px 0 0 2px;
}

.searchbox-content .input-clear {
    cursor: pointer;
    position: absolute;
    width: 27px;
    height: 38px;
    right: 39px;
    top: 0;
    border-right: 1px solid #b6b6b6;
    background: url(//webmap1.bdimg.com/wolfman/static/common/images/new/searchbox_5c0d97d.png) no-repeat 0 -114px #fff;
}

.searchbox-content .searchbox-content-common {
    box-sizing: border-box;
    float: left;
    width: 329px;
    height: 38px;
}

.searchbox-content .searchbox-content-button.route-button {
    background: url(//webmap1.bdimg.com/wolfman/static/common/images/new/searchbox_5c0d97d.png) no-repeat 0 0;
}

.searchbox-content .searchbox-content-button {
    box-sizing: border-box;
    float: left;
    height: 38px;
    width: 39px;
    cursor: pointer;
    position: relative;
}

#searchbox #search-button {
    pointer-events: auto;
    background-color: #fff;
    background: url(//webmap1.bdimg.com/wolfman/static/common/images/new/searchbox_5c0d97d.png) no-repeat 0 -76px #3385ff;
    width: 57px;
    height: 38px;
    float: left;
    border: 0;
    padding: 0;
    cursor: pointer;
    border-radius: 0 2px 2px 0;
    box-shadow: 1px 2px 1px rgba(0, 0, 0, .15);
}

.map-path {
    position: absolute;
    left: 50px;
    top: 58px;
    width: 368px;
    background-color: #fff;
    overflow: hidden;
    pointer-events: none;
    z-index: 5;
    border-top: 1px solid #b6b6b6;
    box-shadow: 1px 2px 1px rgba(0, 0, 0, .15);
    display: none;
}

.map-path .path-heard a {
    float: left;
    padding: 0 10px;
    margin: 8px;
    cursor: pointer;
    pointer-events: auto;
}

.map-function {
    position: absolute;
    left: 50px;
    top: 58px;
    width: 368px;
    background-color: #fff;
    overflow: hidden;
    pointer-events: none;
    z-index: 10;
    border-top: 1px solid #b6b6b6;
    box-shadow: 1px 2px 1px rgba(0, 0, 0, .15);
    display: none;
}

.area-data {
    width: 100%;
}

.area-path {
    width: 100%;
}

.map-function p {
    margin: 10px;

}

.data-name {
    font-size: 20px;
    font-weight: bold;
}

.data-address {
    font-size: 16px;
    font-weight: bold;
}

.path-end,
.path-start {
    border-top: 1px solid #b6b6b6;
    text-align: center;
    float: left;
    width: 50%;
    font-size: 22px;
    pointer-events: auto;
}

.map-function a {
    text-align: center;
}

.previous-next {
    margin: 10px 40px;
    justify-content: center;
    align-items: center;
    display: flex;
}

.previous-next .init_buttom {

    width: 57px;
    height: 30px;
    pointer-events: auto;
}

.routebox {
    -webkit-transition: max-height 1s ease-in;
    transition: max-height 1s ease-in;
    overflow: hidden;
}

.routebox .routebox-content {
    height: auto !important;
    position: relative;
}

.searchbox-content .searchbox-content-common {
    box-sizing: border-box;
    float: left;
    width: 329px;
    height: 38px;
}

.routebox .routebox-content .routebox-revert {
    pointer-events: auto;
    width: 39px;
    height: 100%;
    position: absolute;
    left: 0;
    top: 0;
    cursor: pointer;
}

.routebox .routebox-content .routebox-revert .routebox-revert-icon {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 18px;
    height: 14px;
    margin-left: -9px;
    margin-top: -7px;
    background: url(//webmap1.bdimg.com/wolfman/static/common/images/new/revert_172bb58.png) no-repeat 0 0;
}

.routebox .routebox-content .routebox-inputs {
    margin-left: 39px;
}

.routebox .routebox-content .routebox-input {
    height: 40px;
    width: 289px;
    border-bottom: 1px solid #eaebed;
    position: relative;
}

.routebox .routebox-content .routebox-input .route-input-icon {
    width: 11px;
    height: 10px;
    background: url(//webmap1.bdimg.com/wolfman/static/common/images/new/start_ee17f81.png) no-repeat 0 0;
    position: absolute;
    top: 15px;
    left: 3px;
}

.routebox .routebox-content .routebox-input input {
    pointer-events: auto;
    box-sizing: border-box;
    border: 0;
    height: 100%;
    width: 100%;
    padding: 10px 0;
    font-size: 14px;
    border-left: 20px solid transparent;
    border-right: 27px solid transparent;
    line-height: 20px;
}


.routebox .routebox-content .routebox-input {
    height: 40px;
    width: 289px;
    border-bottom: 1px solid #eaebed;
    position: relative;
}

.routebox .routebox-content .routebox-input.route-end .route-input-icon {
    background: url(//webmap0.bdimg.com/wolfman/static/common/images/new/end_e68ad9a.png) no-repeat 0 0;
}

.routebox .routebox-content .routebox-input .route-input-icon {
    width: 11px;
    height: 10px;
    background: url(//webmap1.bdimg.com/wolfman/static/common/images/new/start_ee17f81.png) no-repeat 0 0;
    position: absolute;
    top: 15px;
    left: 3px;
}

.map-path i {
    width: 15px;
    height: 14px;
    background-position: 0 -68px;
    display: flex;
    position: absolute;
    top: 32px;
    right: 43px;
    background-image: url(//webmap1.bdimg.com/wolfman/static/common/images/new/route-icon_41d3af5.png);
    background-repeat: no-repeat;
    z-index: 1;
}

.map-path #search-path-button {
    pointer-events: auto;
    background-color: #fff;
    background: url(//webmap1.bdimg.com/wolfman/static/common/images/new/searchbox_5c0d97d.png) no-repeat -9px -70px #7c51e0;
    position: absolute;
    top: 20%;
    right: 0%;
    width: 40px;
    height: 60%;
    float: left;
    border: 0;
    padding: 0;
    cursor: pointer;
    border-radius: 0 2px 2px 0;
    box-shadow: 1px 2px 1px rgba(0, 0, 0, .15);
}

.path-show {
    position: absolute;
    background-color: #fff;
    float: left;
    top: 116px;
    left: 50px;
    width: 369px;
    display: none;
}


.painting {
    position: absolute;
    text-align: center;
    width: 120px;
    background: #fff;
    border-radius: 0 2px 2px 0;
    box-shadow: 1px 2px 1px rgba(0, 0, 0, .15);
    top: 40px;
    right: 8px;
    background-color: white;
}

.painting .painting-all {
    float: left;
}

.painting .b1 {
    float: left;
    padding: 0 10px;
    margin: 8px;
    cursor: pointer;
}

.ol-scale-line {
    background: var(--ol-partial-background-color);
    border-radius: 4px;
    bottom: 8px;
    left: 75%;
    text-align: right;
    padding: 2px;
    position: absolute;
}

.mousPos {
    position: absolute;
    top: 8px;
    right: 8px;
    color: red;
}

.control {
    position: absolute;
    right: 5px;
    bottom: 10px;
    width: 150px;
}

#gaodemap {
    visibility: hidden;
    /* visibility: visible; */
    position: absolute;
    left: 0px;
    top: 0px;
    z-index: -1;
    overflow: hidden;
    width: 100%;
    height: calc(100vh);
    background: 'witer';
}

.popup {
    background-color: white;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
    padding: 15px;
    border-radius: 10px;
    border: 1px solid #cccccc;
    min-width: 280px;
    color: black;
}

.popup-closer {
    text-decoration: none;
    position: absolute;
    top: 2px;
    right: 8px;
}
</style>
