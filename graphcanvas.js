
var canvas = document.getElementById("canvas"),
ctx = canvas.getContext("2d");
crosshairs = canvas.getContext("2d");

canvas.width = 800;
canvas.height = 468;

var seriesColors = ["green", "pink", "blue", "red", "yellow"];
var activeSeries = 0;
var xOffsets = new Array();
var yOffsets = new Array();
var datum = {x: 40, y: 435}
var chartWidth = window.width * 0.75;
var chartHeight = window.height * 0.75;
var series = new Array(new Array());
var showDecimals = 2;
var calibrations = new Array({
    x0: 40,
    y0: 435,
    v_x0: 0,
    v_y0: 0,
    x1: 286,
    y1: 107,
    v_x1: 4,
    v_y1: 120
}); // added some defaults for this graph
var polyResult = null;
var polyDegree = 4;
var mode = 0;   // clickmode for canvas
var zoomRatio = 3;
var crossXY = [];


// initiate the default graph
var image = new Image();
image.src = "./scalegraph-resized.png";

var imageRescaled = image.cloneNode();
imageRescaled.height = image.naturalHeight * 2;
imageRescaled.width = image.naturalWidth * 2;

// Make sure the image is loaded first otherwise nothing will draw.
image.onload = function () {
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
}

var getScale = function() {
    /*
        return the x and y scales on a per-pixel basis
    */
    let cal = calibrations[activeSeries]
    let dx = (cal.v_x1 - cal.v_x0) / (cal.x1 - cal.x0);
    let dy = (cal.v_y0 - cal.v_y1) / (cal.y1 - cal.y0); // note that y's are inverted due to x,y starting at top left of canvas instead of bottom-left
    return {x: dx, y: dy};
}

var drawRegression = function() {
    // TODO: retrace the regression so it can be visualized
    console.log("plotting regression")
    for (let x = datum.x; x < canvas.width; x++) {
        let y = new window.poly(polyResult, polyDegree).predictY(polyResult, transformPoint(x, 0).x);
        // console.log("x,y=" + x +", "+ y);
        let pt = transformPoint(x, y, true);
        // console.log("x,y=" + x +", "+ pt.y);
        drawSquareMarker(x, pt.y, "magenta", 2, 2);

    }
}

var readDatum = function() {
    // adjusted datum.
    return {x: datum.x, y: canvas.height - datum.y};
}

var updateCalibrationUI = function() {
    // update the calibration pointss on the ui
    document.getElementById("point1pixel").innerText =  datum.x + ", " + datum.y;
    document.getElementById("point2pixel").innerText = calibrations[activeSeries].x1 + ", " + calibrations[activeSeries].y1;
    document.getElementById("calibdx").innerText = getScale().x;
    document.getElementById("calibdy").innerText = getScale().y;
    redrawUiPointList();
}

var transformPoint = function(x,y, reverse=false) {
    // transform a pixel-based x,y into an x,y using the chart axis scales
    if (reverse) {
        var ox = (x/getScale().x) + readDatum().x;
        var oy = (canvas.height - readDatum().y - y/getScale().y);
        return { x: ox, y: oy };

    }
    var ox = (x - readDatum().x) * getScale().x;
    var oy = (canvas.height - y - readDatum().y) * getScale().y;
    return {x: ox, y: oy};
}

var clearGraph = function () {
    // resets the canvas to show only the image
    // ctx.scale(1,1);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    drawDatum(datum.x, datum.y);
}

var canvasXYtoImageXY = function(x, y) {
    // rescales the canvas XY into Image XY

    // input: x, y from canvas
    // output: x,y on the image

    // adjust the x & y of the image to match the canvas size
    // input an x & y from a canvas event and the output will an object containing the images x, y coordinates
    // var out = {};
    // if (image.naturalWidth <= canvas.width) {
    //     console.log("image smaller than canvas");
    //     // have to upsize the zoom box
    //     // out
    //     xScale = image.naturalWidth / canvas.width;
    //     xFactor = zoomRatio / xScale;
    //     out = { x: x * xFactor, y: y * image.naturalHeight / canvas.height };
    // } else {
    //     console.log("image larger than canvas");
    //     // zoombox is already upsize
    //     xScale = image.naturalWidth / canvas.width;
    //     xFactor = zoomRatio / xScale;
    //     out = { x: x * xFactor, y: y * image.naturalHeight / canvas.height};

    // }
    // console.log(out);
    var out = { x: x * image.naturalWidth / canvas.width, y: y * image.naturalHeight / canvas.height };

    return out;
}

var setDatum = function(x, y) {
    //set the datum vars
    console.log("Setting datum")
    datum.x = x;
    datum.y = y;
    document.getElementById("datum0").innerText = x + ", " + y;
    return;

}

var drawDatum = function(x, y) {
    // draw the datum on the canvas
    if (x === null || y === null)  {
        // console.log("datum not yet set");
        return;
    }

    var c = canvas.getContext("2d")
    let r = 10;

    // draw circle
    c.beginPath();
    c.strokeStyle = "red";
    c.arc(x, y, r, 0, Math.PI * 2);
    c.stroke();

    // draw se arc
    c.beginPath();
    c.fillStyle = "red";
    c.moveTo(x,y);
    c.lineTo(x + r, y);
    c.arc(x, y, r, 0, Math.PI/2);
    c.moveTo(x, y);
    c.lineTo(x, y+r)
    c.fill();

    // draw nw arc
    c.beginPath();
    c.filleStyle = "red";
    c.moveTo(x, y);
    c.lineTo(x - r, y);
    c.arc(x, y, r, Math.PI , Math.PI * 2 * 0.75);
    c.moveTo(x, y)
    c.lineTo(x, y + r);
    c.fill();



    c.strokeStyle = "black";
    c.filleStyle = "black";
}

var drawZoomBox = function(x,y) {
    // draw the zoombox on the canvas

    if (!document.getElementById("showZoom").checked)
        return;

    let canv = document.getElementById("canvas")
    var c = canvas.getContext("2d")
    var boxSize = 250;
    var rescaled = canvasXYtoImageXY(x, y)
    var dx, dy = 0;
    let offset = 10;

    // x & y locations where the box grid is drawn
    dx = (canvas.width - x < boxSize) ? x - offset - boxSize : x + offset;
    dy = (canvas.height - y < boxSize) ? y - offset - boxSize : y + offset;

    xtxt = (canvas.width - x < boxSize) ? x - offset - boxSize + 2: x + offset + 2;
    ytxt = (canvas.height - y < boxSize) ? y + offset + 2: y - offset;

    // fill the image inside the boxgrid
    c.scale(zoomRatio, zoomRatio);
    // image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight
    c.drawImage(image, rescaled.x - boxSize / 2 / zoomRatio, rescaled.y - boxSize / 2 / zoomRatio, boxSize / zoomRatio, boxSize / zoomRatio, dx / zoomRatio, dy / zoomRatio, boxSize / zoomRatio, boxSize / zoomRatio);

    // the magic, return from the transformation:
    ctx.setTransform(1, 0, 0, 1, 0, 0);


    // TODO: redraw the marks inside the previewer?

    c.strokeStyle = "black"


    c.beginPath();
    c.strokeRect(dx, dy, boxSize / 2, boxSize / 2); // NW
    c.strokeRect(dx + boxSize / 2, dy, boxSize / 2, boxSize / 2); // NE
    c.strokeRect(dx, dy + boxSize / 2, boxSize / 2, boxSize / 2); //SW
    c.strokeRect(dx + boxSize / 2, dy + boxSize / 2, boxSize / 2, boxSize / 2); // SE

    c.font = "12px Courier"
    c.beginPath();
    // c.moveTo(xtxt, ytxt);
    c.strokeText("Zoom (+/-): " + zoomRatio, xtxt, ytxt);

    // var viewPane = image.cloneNode();
    // viewPane.height = '5000px';
    // c.scale(1.01, 1.01)
    // c.scale(1, 1);
}

var drawCrosshair = function (e, xOveride=null, yOveride=null) {
    // draw the crosshair on the canvas
    var x = 0;
    var y = 0;
    if (xOveride != null && yOveride != null) {
        x = xOveride;
        y = yOveride;
    } else {
        x = e.offsetX;
        y = e.offsetY;
        crossXY = [x,y];
    }

    clearGraph();
    crosshairs.beginPath();
    crosshairs.strokeStyle = "black";

    // vertical line
    crosshairs.moveTo(x, 0);
    crosshairs.lineTo(x, canvas.height);

    // horizontal line
    crosshairs.moveTo(0, y);
    crosshairs.lineTo(canvas.width, y);

    crosshairs.stroke();

    // redraw everything else as the cursor moves
    redrawSeries();
    drawDatum(datum.x, datum.y);
    drawZoomBox(crossXY[0], crossXY[1]);
}

var redrawSeries = function () {
    // draw all the marked datapoints
    for (i=0; i < series.length; i++) {
        for (ii = 0; ii < series[i].length; ii++) {
            drawSquareMarker(series[i][ii][0], series[i][ii][1], seriesColors[i])
        }
    }
}

var setCalibrationXYpixels = function(seriesId, pointNum, x, y) {
    // store the pixels for calibration points
    calibrations[seriesId]['x' + pointNum] = x;
    calibrations[seriesId]['y' + pointNum] = y;
    console.log(calibrations[seriesId]);
    updateCalibrationUI();
}

var setCalibrationXYvalues = function(seriesId, pointNum, x, y) {
    // store the user entered values for calibration points
    calibrations[seriesId]['v_x' + pointNum] = parseInt(x);
    calibrations[seriesId]['v_y' + pointNum] = parseInt(y);
    console.log(calibrations[seriesId]);
    updateCalibrationUI();
}

var redrawUiPointList = function() {
    // redraw the list of points onto the ui
    let el = document.getElementById("series" + activeSeries);
    el.innerHTML = '';
    for (let i = 0; i < series[activeSeries].length; i++) {
        const pt = series[activeSeries][i];
        addPointToUiList(pt[0], pt[1]);
    }
}

var addPointToUiList = function (x, y) {
    // add the DOM structure required to allow deletion of a UI datapoint
    let div = document.createElement('div');
    div.classList.add("point")

    let p = transformPoint(x, y);
    let it = document.createElement('span');
    it.innerText = p.x.toFixed(showDecimals) + ", " + p.y.toFixed(showDecimals) + " - "
    div.appendChild(it);

    let a = document.createElement('a');
    a.classList.add("pointlink")
    a.setAttribute("data-x", x);
    a.setAttribute("data-y", y);
    a.href = "#"
    a.innerText = "X"
    var l = series[activeSeries].length;
    a.addEventListener('click', (e) => {
        console.log('click');
        // series[activeSeries].splice(l, 1);
        for (let i = 0; i < series[activeSeries].length; i++) {
            const element = series[activeSeries][i];
            if (element[0] == e.target.getAttribute("data-x") && element[1] == e.target.getAttribute("data-y")) {
                series[activeSeries].splice(i, 1);
                break;
            }
        }
        redrawUiPointList();
        clearGraph();
        redrawSeries();
    });
    a.addEventListener('mouseover', (e) => {
        redrawSeries();
        drawSquareMarker(e.target.getAttribute("data-x"), e.target.getAttribute("data-y"), "red");
    });
    // a.addEventListener('mouseout', (e) => { clearGraph(); });

    div.appendChild(a);
    document.getElementById('series' + activeSeries).appendChild(div);
}

var buildEquation = function(terms) {
    let out = "";
    console.log(terms[0]);
    if (isNaN(terms[0])) {
        return "Select two or more points first";
    }
    for (let i = terms.length - 1; i >= 0; i--) {
        out += terms[i].toFixed(2).toString();
        if (i > 1) {
            out += "x^" + i.toString();
        } else if (i == 1) {
            out += "x";
        }
        if (i > 0) {
            out += " + ";
        }
    }
    return out;

}

var recalcPoly = function() {
    // recalculate the polyonimal from the data and update the UI
    let data = new Array();
    for (let i = 0; i < series[activeSeries].length; i++) {
        const pt = series[activeSeries][i];
        data.push(transformPoint(pt[0], pt[1]));
    }
    console.log(data);
    var p = new window.poly(data, polyDegree);
    polyResult = p.getTerms();
    document.getElementById("deg3poly").innerText = buildEquation(polyResult);
    document.getElementById("prediction").innerText = "Y = " + p.predictY(polyResult, document.getElementById("predictInput").value).toFixed(2);
}

var markPoint = function (e) {
    // add a new point to the marked list
    let x = e.offsetX;
    let y = e.offsetY;
    console.log("x,y=" + x + "," + y);
    series[activeSeries].push([x, y])
    addPointToUiList(x, y);
    redrawSeries(); // redraw
    recalcPoly();
}

var drawSquareMarker = function (x, y, color, w = 10, h = 10) {
    // draw a single square marker at location
    let sq = canvas.getContext("2d");
    sq.fillStyle = color
    sq.fillRect(x - w / 2, y - h / 2, w, h);
}

// var seriesBtn = document.getElementById("addSeries");
// seriesBtn.addEventListener("click", e => {
//     alert("Multiple Series disabled for now");
//     return ;
//     activeSeries += 1;
//     series.push(new Array());
//     var pl = document.getElementById("pointlist");
//     var div = document.createElement('div');
//     div.id="series" + (series.length - 1);
//     pl.appendChild(div);
// }  );



function loadNewImage(el) {
    // read image from user and display it
    console.log("changing image");
    let fileobj = el.target.files[0];
    console.log(fileobj);
    let fr = new FileReader();
    fr.onload = function(e) {
        console.log("loaded image");
        image = new Image();
        console.log(e.target.result);
        image.src = e.target.result;
        image.onload = function () {
            canvas.height = image.naturalHeight / image.naturalWidth * canvas.width;
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        }

        clearGraph = function () {
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        }

        let ctx = document.getElementById('canvas').getContext("2d");
        ctx.drawImage(image, 0, 0);
    };
    fr.readAsDataURL(fileobj);
}

var setMode = function(newMode) {
    // sets the current clickmode for the canvas
    clearButtons();
    console.log("mode changed to " + newMode);
    mode = newMode;
    return;
}

var toggleClass = function(id, className) {
    /*
        toggle className on/off for elemetn with id "id"
        use +/- prefix for classname to force adding or removing the classes instead of toggling
    */
    var classList = document.getElementById(id).classList;
    var modifier = className.substring(0, 1);

    if (modifier == "+") {
        console.log("Adding " + className.substring(1, className.length - 1));
        classList.add(className.substring(1,className.length));
        return;
    } else if (modifier == "-") {
        classList.remove(className.substring(1,className.length));
        return;
    }

    if (classList.contains(className)) {
        classList.remove(className);
    } else {
        classList.add(className);
    }
    console.log(classList);

}

var clearButtons = function() {
    // clear the toggle status of all ui buttons
    let btns = new Array("setDatum0btn", "markPoints0", "selectPoint2");
    for (let index = 0; index < btns.length; index++) {
        toggleClass(btns[index], "-activeBtn");

    }

}

var handleClick = function (e) {
    // handler for canvas clicks
    switch (mode) {
        case 0: // 0 - nothing
            break;
        case 1: // 1 - mark points in series
            markPoint(e);
            // if (document.getElementById("showRegression").checked) {
            //     drawRegression();
            // }
            break;
        case 2: // 2 - set datum
            setDatum(e.offsetX, e.offsetY);
            toggleClass("point1status", "-missing");
            toggleClass("point1status", "+set");
            toggleClass("setDatum0btn", "-activeBtn");
            setMode(0);
            setCalibrationXYpixels(activeSeries, 0, e.offsetX, e.offsetY);
            redrawUiPointList();

            break;
        case 3: // 3 add calibration point 2
            toggleClass("selectPoint2", "-activeBtn");
            setCalibrationXYpixels(activeSeries, 1, e.offsetX, e.offsetY);
            break;
        case 4: // 4 calibrate x scale
            // toggleClass("calibrateXscale0", "activeBtn");
            break;

    }
}

// set all eventListners  up
canvas.addEventListener("mousemove", drawCrosshair);
canvas.addEventListener("mouseout", (e) => {
    clearGraph();
    if (document.getElementById("showRegression").checked) {
        drawRegression();
    }
});
canvas.addEventListener("click", handleClick)
document.getElementById('setDatum0div').addEventListener("click", () => { setMode(2); toggleClass("setDatum0btn", "+activeBtn")});
document.getElementById('markPoints0').addEventListener("click", (e) => {
    if (mode == 1) {
        setMode(0);
        clearButtons();
    } else {
        setMode(1); clearButtons(); toggleClass("markPoints0", "+activeBtn");
    }
    window.focus();

});
document.getElementById("setCalib1").addEventListener('click', (e) => {
    console.log(document.getElementById("calib1valueX").value);
    setCalibrationXYvalues(activeSeries, 0, document.getElementById("calib1valueX").value,  document.getElementById("calib1valueY").value);
});
document.getElementById("setCalib2").addEventListener('click', (e) => {
    console.log(document.getElementById("calib2valueX").value);
    setCalibrationXYvalues(activeSeries, 1, document.getElementById("calib2valueX").value,  document.getElementById("calib2valueY").value);
    toggleClass("calib2valueX", "-missing");
    toggleClass("calib2valueY", "-missing");
    toggleClass("point2status", "-missing");
    toggleClass("point2status", "+set");
});
document.getElementById("selectPoint2").addEventListener("click", (e) => {
    setMode(3);
    toggleClass("selectPoint2", "+activeBtn")
});
document.getElementById("showHideCalib").addEventListener('click', (e) => { toggleClass("calibrate", "hidden")});
document.getElementById('filebrowsed').addEventListener('change', loadNewImage, false);
document.getElementById("predictInput").addEventListener("keyup", (e) => { recalcPoly(); });
document.getElementById("increasePoly").addEventListener('click', () => {polyDegree += 1; recalcPoly(); document.getElementById("polyDegreeValue").innerText = polyDegree; clearGraph(); drawRegression()});
document.getElementById("decreasePoly").addEventListener('click', () => {polyDegree -= 1; recalcPoly(); document.getElementById("polyDegreeValue").innerText = polyDegree; clearGraph(); drawRegression()});
document.getElementById("showRegression").addEventListener("click", (e) => { if (e.target.checked) { recalcPoly(); drawRegression(); }});
document.getElementById("plotRegression").addEventListener("click", () => { recalcPoly(); drawRegression(); });
window.addEventListener("keydown", (e) => {

    if (e.key == "+") {
        console.log("zoom ratio increase");
        zoomRatio += 0.25;
        clearGraph();
        drawZoomBox(crossXY[0], crossXY[1]);

    } else if (e.key == "-") {
        console.log("zoom ratio decrease");
        if (zoomRatio <= 1)
            return;
        zoomRatio -= 0.25;
        clearGraph();
        drawZoomBox(crossXY[0], crossXY[1]);

    } else if (e.key == "ArrowUp") {
        crossXY[1] -= 1;
        e.preventDefault();
        drawZoomBox(crossXY[0], crossXY[1]);
        drawCrosshair(e, crossXY[0], crossXY[1]);
    } else if (e.key == "ArrowDown") {
        crossXY[1] += 1;
        e.preventDefault();
        drawZoomBox(crossXY[0], crossXY[1]);
        drawCrosshair(e, crossXY[0], crossXY[1]);
    } else if (e.key == "ArrowLeft") {
        crossXY[0] -= 1;
        e.preventDefault();
        drawZoomBox(crossXY[0], crossXY[1]);
        drawCrosshair(e, crossXY[0], crossXY[1]);
    } else if (e.key == "ArrowRight") {
        crossXY[0] += 1;
        e.preventDefault();
        drawZoomBox(crossXY[0], crossXY[1]);
        drawCrosshair(e, crossXY[0], crossXY[1]);
    } else if (e.key == "Enter") {
        if (mode == 1) {
            series[activeSeries].push([crossXY[0], crossXY[1]]);
            redrawSeries();
            redrawUiPointList();
        } else if (mode == 2) {
            setDatum(crossXY[0], crossXY[1]);
            toggleClass("point1status", "-missing");
            toggleClass("point1status", "+set");
            toggleClass("setDatum0btn", "-activeBtn");
            setMode(0);
            setCalibrationXYpixels(activeSeries, 0, crossXY[0], crossXY[1]);
            redrawUiPointList();
            drawDatum();

        } else if (mode == 3) {
            setCalibrationXYpixels(activeSeries, 1, crossXY[0], crossXY[1]);
        }
    }
    // console.log(e);

    }
    );

    window.onload = function() {
        document.getElementById("calib2valueX").value = calibrations[0].v_x1;
        document.getElementById("calib2valueY").value = calibrations[0].v_y1;
        document.getElementById("calibPoint2").innerText = calibrations[0].x1 + ", " + calibrations[0].y1;
        updateCalibrationUI();
    }
