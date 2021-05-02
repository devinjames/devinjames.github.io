/*
Copyright 2021 Devin Sawatzky
github.com/devinjames
*/

var canvas = document.getElementById("canvas"),
ctx = canvas.getContext("2d");
crosshairs = canvas.getContext("2d");

canvas.width = 940;
canvas.height = 552;

var prevCanvas = {height: canvas.height, width: canvas.width }; // for managing resizing

// var seriesColors = ["green", "pink", "blue", "red", "yellow"];
var activeSeries = 0;
var datum = {x: 36, y: 525 }  // careful with datum-Y, zero-val for Y is at the top of the chart so it needs to be subtracted from the height when doing calculations
// var chartWidth = window.width * 0.75;
// var chartHeight = window.height * 0.75;
var series = new Array(new Array());
var sigFigs = 2;
var calibrations = new Array({
    x0: 36,
    y0: 525,
    v_x0: 0,
    v_y0: 0,
    x1: 628,
    y1: 251,
    v_x1: 12,
    v_y1: 400
}); 

// defaults for ./data/poly-3rd-order.png
series[0] = [[84, 507], [283, 356], [478, 172], [679, 140], [877, 443]];

var polyResult = [];
var polyDegree = 3;
var mode = 0;   // clickmode for canvas
var zoomRatio = 3;
var crossXY = [];

var colors = {
    regressionPoint: "magenta",
    markedPoint: "darkgreen",
    hightlightedPoint: "red",
    crosshair: "black",
    zoomBox: "black",
    datum: "red",
    calib: "orange",
    prediction: "red"
}

const modes = {
    NOTHING: 0,
    MARK_POINT: 1,
    SET_DATUM: 2,
    SET_CALIB: 3
}


// initiate the default graph
var image = new Image();
image.src = "./data/poly-3rd-order.png";

// Draw the image on the canvas
image.onload = function () {
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
}

/*
#########################################
        MATH, SCALING and CHECKING
#########################################
*/

var getScale = function() {
    /*
        return the x and y scales on a per-pixel basis
    */
    let cal = calibrations[activeSeries]
    let dx = (cal.v_x1 - cal.v_x0) / (cal.x1 - cal.x0);
    let dy = (cal.v_y0 - cal.v_y1) / (cal.y1 - cal.y0); // note that y's are inverted due to x,y starting at top left of canvas instead of bottom-left
    return {x: dx, y: dy};
}

var recalculateLandedPoints = function() {
    /* 
        adjusts existing calibrations and datum for a resized canvas
    */
    let dh = canvas.height / prevCanvas.height;
    let dw = canvas.width / prevCanvas.width;

    prevCanvas.height = canvas.height;
    prevCanvas.width = canvas.width;


    setDatum(datum.x * dw, datum.y * dh);

    for (let i = 0; i < series[activeSeries].length; i++) {
        series[activeSeries][i][0] *= series[activeSeries][i][0]
        series[activeSeries][i][1] *= series[activeSeries][i][1]
    }

    calibrations.x0 = datum.x
    calibrations.y0 = datum.y

    calibrations.x1 *= dw
    calibrations.y1 *= dh

}

var buildEquation = function(terms) {
    let out = "Y = ";
    if (isNaN(terms[0])) {
        return "Select two or more points first";
    }
    for (let i = terms.length - 1; i >= 0; i--) {
        let term = parseFloat(terms[i]);

        // console.log("Term = ".concat(term));


        if (term < 1) {
            term = term.toExponential(2).toString();
            // console.log(term.toString());
        } else {
            term = term.toFixed(3);
        }

        // console.log("Formatted =".concat(term));
        // console.log("Str =".concat(term.toString()));

        out = out.concat(term);
        // console.log(out);


        if (i > 1) {
            out = out.concat("x^".concat(i.toString()));
        } else if (i == 1) {
            out = out.concat("x");
        }

        if (i > 0) {
            out = out.concat(" + ");
        }
    }
    // console.log(out);
    return out;

}

var recalcPoly = function() {
    // recalculate the polyonimal from the data and update the UI
    let data = new Array();
    for (let i = 0; i < series[activeSeries].length; i++) {
        const pt = series[activeSeries][i];
        data.push(transformPoint(pt[0], pt[1]));
    }
    // console.log(data);
    var p = new window.poly(data, polyDegree);
    polyResult = p.getTerms();
    document.getElementById("deg3poly").innerText = buildEquation(polyResult);
    document.getElementById("regressionPredictY").innerText = "Y = " + p.predictY(polyResult, document.getElementById("predictInput").value).toFixed(2);
}

var readDatum = function() {
    // adjusted datum
    // very important for the transformation function. don't delete ;)
    return {x: datum.x, y: canvas.height - datum.y};
}

var transformPoint = function(x,y, reverse=false) {
    // transform a pixel-based x,y into a scaled x,y using the chart axis scales
    if (reverse) {
        // convert graph points to pixel x,y
        var ox = ((x- calibrations[activeSeries]["v_x0"])/getScale().x) + readDatum().x;          // TODO: scale this based on datum y-value
        var oy = (canvas.height - readDatum().y - (y - calibrations[activeSeries]["v_y0"])/getScale().y);
        return { x: ox, y: oy };

    }
    // convert pixel x,y to graph points
    var ox = (x - readDatum().x) * getScale().x + calibrations[activeSeries]["v_x0"];
    var oy = (canvas.height - y - readDatum().y) * getScale().y + calibrations[activeSeries]["v_y0"];
    return {x: ox, y: oy};
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

/*
#########################################
        DRAWING FUNCTIONS
#########################################
*/

var refreshGraph = function(regression=true, markedPoints=true, datumMarker=true, calibMarker=true, higlightPoint=null) {
    /*
        TODO:  Populate all the show/hide logic in one place
    */
   clearGraph();
   if (regression) {
       drawRegression()
   }
   if (markedPoints) {
       drawSeries();
   }
   if (datumMarker) {
       drawDatum();
   }
   if (calibMarker) {
       drawCalibMarker();
   }
   if (hightlightedPoint) {
       // TODO: not complete
   }


}

var drawRegression = function(zoomX, zoomY) {
    /*
        Graphs the regression formulated from the marked points
        zoomX and zoomY will be defined if the zoombox is shown
    */
    for (let x = datum.x; x < canvas.width; x++) {
        let y = new window.poly(polyResult, polyDegree).predictY(polyResult, transformPoint(x, 0).x);
        let pt = transformPoint(x, y, true);
        if (pt.y > datum.y) {
            break;
        }
        
        drawSquareMarker(x, pt.y, colors.regressionPoint, 2, 2);
    }
}

var drawLineAtUserX = function() {
    let x = transformPoint(document.getElementById("predictInput").value, 1, true).x;
    drawVerticalLine(x)
}

var drawTriangle = function(x, y, h, alpha, color) {
    // console.log('triangle x,y=' + x + ',' + y);
    var c = canvas.getContext("2d");
    c.globalAlpha = alpha;
    c.strokeStyle = color;
    c.fillStyle = color;
    let dx = h / 2;
    let dy = h / 2;
    c.beginPath();
    
    c.moveTo(x - dx, y + dy);   // bottom-left
    c.lineTo(x, y - dy);          // top
    c.lineTo(x + dx, y + dy);   // bottom-right
    c.lineTo(x - dx, y + dy);   // bottom-left
    
    c.stroke();
    c.fill();
    c.globalAlpha = 1;


}

var drawVerticalLine = function(x) {
    // console.log("DRQA");
    var c = canvas.getContext("2d")
    c.globalAlpha = 0.2;
    c.strokeStyle = colors.prediction;
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x, canvas.height);
    c.stroke();
    c.globalAlpha = 1;
    // c.fill();


}

var clearGraph = function () {
    // resets the canvas to show only the image
    // ctx.scale(1,1);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    drawDatum(datum.x, datum.y);
    drawCalibMarker(calibrations[activeSeries].x1, calibrations[activeSeries].y1);
}

var drawCalibMarker = function(x, y) {
    // draw the datum on the canvas
    if (x === null || y === null)  {
        // console.log("datum not yet set");
        return;
    }

    var c = canvas.getContext("2d")
    let r = 5;

    // draw circle
    c.beginPath();
    c.globalAlpha = 0.45;
    c.strokeStyle = colors.calib;
    c.fillStyle = colors.calib;
    c.arc(x, y, r, 0, Math.PI * 2);
    c.stroke();
    c.fill();

    // // draw se arc
    // c.beginPath();
    // c.fillStyle = colors.datum;
    // c.moveTo(x,y);
    // c.lineTo(x + r, y);
    // c.arc(x, y, r, 0, Math.PI/2);
    // c.moveTo(x, y);
    // c.lineTo(x, y+r)
    // c.fill();

    // // draw nw arc
    // c.beginPath();
    // c.fillStyle = colors.datum;
    // c.moveTo(x, y);
    // c.lineTo(x - r, y);
    // c.arc(x, y, r, Math.PI , Math.PI * 2 * 0.75);
    // c.moveTo(x, y)
    // c.lineTo(x, y + r);
    // c.fill();


    // return to black?
    c.globalAlpha = 1.0;
    c.strokeStyle = "black";
    c.fillStyle = "black";
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
    c.strokeStyle = colors.datum;
    c.arc(x, y, r, 0, Math.PI * 2);
    c.stroke();

    // draw se arc
    c.beginPath();
    c.fillStyle = colors.datum;
    c.moveTo(x,y);
    c.lineTo(x + r, y);
    c.arc(x, y, r, 0, Math.PI/2);
    c.moveTo(x, y);
    c.lineTo(x, y+r)
    c.fill();

    // draw nw arc
    c.beginPath();
    c.fillStyle = colors.datum;
    c.moveTo(x, y);
    c.lineTo(x - r, y);
    c.arc(x, y, r, Math.PI , Math.PI * 2 * 0.75);
    c.moveTo(x, y)
    c.lineTo(x, y + r);
    c.fill();


    // return to black?
    c.strokeStyle = "black";
    c.fillStyle = "black";
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

    c.strokeStyle = colors.zoomBox;


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
    crosshairs.strokeStyle = colors.crosshair;

    // vertical line
    crosshairs.moveTo(x, 0);
    crosshairs.lineTo(x, canvas.height);

    // horizontal line
    crosshairs.moveTo(0, y);
    crosshairs.lineTo(canvas.width, y);

    crosshairs.stroke();

    // redraw everything else as the cursor moves
    drawSeries();
    drawDatum(datum.x, datum.y);
    drawCalibMarker(calibrations[activeSeries].x1, calibrations[activeSeries].y1)
    drawZoomBox(crossXY[0], crossXY[1]);
}

var drawSeries = function () {
    // draw all the marked datapoints
    for (i=0; i < series.length; i++) {
        for (ii = 0; ii < series[i].length; ii++) {
            drawSquareMarker(series[i][ii][0], series[i][ii][1], colors.markedPoint)
        }
    }
}

var drawSquareMarker = function (x, y, color, w = 10, h = 10) {
    // draw a single square marker at location
    let sq = canvas.getContext("2d");
    sq.fillStyle = color
    sq.fillRect(x - w / 2, y - h / 2, w, h);
}

var markPoint = function (e) {
    // add a new point to the marked list
    let x = e.offsetX;
    let y = e.offsetY;
    // console.log("Marking new point x,y=" + x + "," + y);
    series[activeSeries].push([x, y])
    addPointToUiList(x, y);
    drawSeries(); // redraw
    recalcPoly();
    checkStepOK();
}


/*
#########################################
    CALIBRATION FUNCTIONS
#########################################
*/

var setDatum = function(x, y) {
    //set the datum vars
    // console.log("Setting datum")
    datum.x = x;
    datum.y = y;
    // document.getElementById("datum0").innerText = x + ", " + y;
    return;

}

var setCalibrationXYpixels = function(seriesId, pointNum, x, y) {
    // store the pixels for calibration points
    calibrations[seriesId]['x' + pointNum] = x;
    calibrations[seriesId]['y' + pointNum] = y;
    // console.log(calibrations[seriesId]);
    updateCalibrationUI();
}

var setCalibrationXYvalues = function(seriesId, pointNum, x, y) {
    // store the user entered values for calibration points
    calibrations[seriesId]['v_x' + pointNum] = parseInt(x);
    calibrations[seriesId]['v_y' + pointNum] = parseInt(y);
    // console.log(calibrations[seriesId]);
    updateCalibrationUI();
}

/*
#########################################
    UI UPDATING 
#########################################
*/


var checkStepOK = function() {
    /* 
        check the status of each input step to give visual feedback to the user
    */

        // check datum pixel x,y
        if (calibrations[activeSeries].x0 > 0 && calibrations[activeSeries].y0 > 0 && datum.x != null && datum.y != null) {
            toggleClass('calib1bad', "+hide");
            toggleClass('calib1ok', "-hide");
            toggleClass('step1status', "+set");
            toggleClass('step1status', "-missing");
            
        } else {
            toggleClass('calib1bad', "-hide");
            toggleClass('calib1ok', "+hide");
            toggleClass('step1status', "-set");
            toggleClass('step1status', "+missing");            
        }


        // check datum actual x,y
        let x = calibrations[activeSeries].v_x0;
        let y = calibrations[activeSeries].v_y0;

        if (!parseInt(x).isNaN & !parseInt(y).isNaN) {
            toggleClass('calib2bad', "+hide");
            toggleClass('calib2ok', "-hide");
            toggleClass('step2status', "+set");
            toggleClass('step2status', "-missing");            
        } else {
            toggleClass('calib2bad', "-hide");
            toggleClass('calib2ok', "+hide");
            toggleClass('step2status', "-set");
            toggleClass('step2status', "+missing");            
        }            

        // check calibration pixel x,y
        if (calibrations[activeSeries].x1 > 0 &&
            calibrations[activeSeries].y1 > 0 &&
            (calibrations[activeSeries].x1 - calibrations[activeSeries].x0) > 10 &&
            (calibrations[activeSeries].y0 - calibrations[activeSeries].y1) > 10
            ) {
            // good
            toggleClass('calib3bad', "+hide");
            toggleClass('calib3ok', "-hide");
            toggleClass('step3status', "+set");
            toggleClass('step3status', "-missing");                
        } else {
            // bad
            toggleClass('calib3bad', "-hide");
            toggleClass('calib3ok', "+hide");
            toggleClass('step3status', "-set");
            toggleClass('step3status', "+missing");              
        }            

        // check calibration actual x,y
        x = calibrations[activeSeries].v_x1;
        y = calibrations[activeSeries].v_y1;

        if (!parseInt(x).isNaN && !parseInt(y).isNaN &&
            (calibrations[activeSeries].v_x1 - calibrations[activeSeries].v_x0) > 0 &&
            (calibrations[activeSeries].v_y1 - calibrations[activeSeries].v_y0) > 0        
        ) {
            toggleClass('calib4bad', "+hide");
            toggleClass('calib4ok', "-hide");
            toggleClass('step4status', "+set");
            toggleClass('step4status', "-missing");              
       
        } else {
            toggleClass('calib4bad', "-hide");
            toggleClass('calib4ok', "+hide");
            toggleClass('step4status', "-set");
            toggleClass('step4status', "+missing");              
        }                  

        // check marked points
        if (series[activeSeries].length > 1) {
            toggleClass('calib5bad', "+hide");
            toggleClass('calib5ok', "-hide");
            toggleClass('step5status', "+set");
            toggleClass('step5status', "-missing");              
        } else {
            toggleClass('calib5bad', "-hide");
            toggleClass('calib5ok', "+hide");
            toggleClass('step5status', "-set");
            toggleClass('step5status', "+missing");                    
            
        }
}

var updateCalibrationUI = function() {
    // update the calibration pointss on the ui
    // document.getElementById("point1pixel").innerText =  datum.x + ", " + datum.y;
    // document.getElementById("point2pixel").innerText = calibrations[activeSeries].x1 + ", " + calibrations[activeSeries].y1;
    // document.getElementById("calibdx").innerText = getScale().x;
    // document.getElementById("calibdy").innerText = getScale().y;
    redrawUiPointList();
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
    let wrapper = document.createElement('div');
    wrapper.classList.add("pointWrapper")

    let pointDiv = document.createElement('div');
    pointDiv.classList.add("point")

    let p = transformPoint(x, y);
    let it = document.createElement('span');
    it.innerText = p.x.toFixed(sigFigs) + ", " + p.y.toFixed(sigFigs); // + " - "
    pointDiv.appendChild(it);
        

    let a = document.createElement('a');
    a.classList.add("pointlink")
    a.setAttribute("data-x", x);
    a.setAttribute("data-y", y);
    a.href = "#"
    a.innerText = "X"
    var l = series[activeSeries].length;

    
    a.addEventListener('click', (e) => {
        // series[activeSeries].splice(l, 1);
        for (let i = 0; i < series[activeSeries].length; i++) {
            const element = series[activeSeries][i];
            if (element[0] == e.target.getAttribute("data-x") && element[1] == e.target.getAttribute("data-y")) {
                series[activeSeries].splice(i, 1);
                break;
            }
        }
        redrawUiPointList();
        recalcPoly()
        clearGraph();
        drawSeries();
        drawRegression();
    });
    a.addEventListener('mouseover', (e) => {
        drawSeries();
        if (document.getElementById("showRegression").checked)
            drawRegression();
        drawSquareMarker(e.target.getAttribute("data-x"), e.target.getAttribute("data-y"), "red");

    });
    // a.addEventListener('mouseout', (e) => { clearGraph(); });

    let closeDiv = document.createElement('div');
    closeDiv.classList.add('pointclose')
    closeDiv.appendChild(a);
    wrapper.appendChild(pointDiv);
    wrapper.appendChild(closeDiv);
    document.getElementById('series' + activeSeries).appendChild(wrapper);
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



function loadNewImageFromFile(el) {
    /* 
        read image selected from user upload and display it
     */
    let fileobj = el.target.files[0];
    let fr = new FileReader();
    fr.onload = function(e) {
        resetEverything();
        image = new Image();
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

}

var resetEverything = function () {
    series[activeSeries] = [];
    setDatum(null, null);
    setCalibrationXYpixels(0,0,null, null);
    setCalibrationXYpixels(0,1,null, null);
    clearButtons();
    setMode(modes.NOTHING);
    recalcPoly();
    clearGraph();    
    // drawDatum();
    setCalibrationXYvalues(activeSeries, 0, 0, 0);
    setCalibrationXYvalues(activeSeries, 1, 0, 0);
    // toggleClass("calib1ok", "+hide");
    // toggleClass("calib1bad", "-hide");
    // toggleClass("calib3ok", "+hide");
    // toggleClass("calib3bad", "-hide");
    // toggleClass("calib5ok", "+hide");
    // toggleClass("calib5bad", "-hide");
    // toggleClass("step1status", "-set");    
    // toggleClass("step2status", "+missing");
    // toggleClass("step2status", "-set");    
    // toggleClass("step3status", "+missing");
    // toggleClass("step3status", "-set");    
    // toggleClass("step4status", "+missing");
    // toggleClass("step4status", "-set");    
    // toggleClass("step5status", "+missing");
    // toggleClass("step5status", "-set");    
    updateCalibrationUI();
    checkStepOK();
}

var clearButtons = function() {
    // clear the toggle status of all ui buttons
    let btns = new Array("setDatum0btn", "markPoints0", "selectPoint2");
    for (let index = 0; index < btns.length; index++) {
        toggleClass(btns[index], "-activeBtn");
    }
}

/*
#########################################
    RESIZING FUNCTIONS
#########################################
*/
    let resizeCanvas = function(e) {
        console.log('resizing');
        canvas.height = e.clientY - canvas.offsetTop;
        // canvas.width = e.clientX - canvas.offsetLeft;

    }

    // document.getElementById("canvasBorder").addEventListener("mousedown", (e) => {
    //     console.log('mousedown in border');

    //     console.log("clientY = " + e.clientY);
    //     console.log("offsetHeight = " + e.target.offsetHeight);

    //     if (e.clientY >= e.target.offsetHeight - parseInt(getComputedStyle(e.target)["border-width"]) * 2 && e.clientX >= e.target.offsetWidth - parseInt(getComputedStyle(e.target)["border-width"]) * 2) { // 4 for border pixels
    //         console.log("caught the click!")
    //         setMode(4);
    //         window.addEventListener('mousemove', resizeCanvas);
    //         canvas.addEventListener('mousemove', resizeCanvas);
    //     } else if (e.clientY >= e.target.offsetHeight - parseInt(getComputedStyle(e.target)["border-width"]) * 2) { // 4 for border pixels
    //         console.log("caught the click!")
    //         setMode(4);
    //         window.addEventListener('mousemove', resizeCanvas);
    //         canvas.addEventListener('mousemove', resizeCanvas);
    //     } else if (e.clientX >= e.target.offsetWidth - parseInt(getComputedStyle(e.target)["border-width"]) * 2) { // 4 for border pixels
    //         console.log("caught the click!")
    //         setMode(4);
    //         window.addEventListener('mousemove', resizeCanvas);
    //         canvas.addEventListener('mousemove', resizeCanvas);
    //     }
    //     //  else {
    //         //     // console.log('remove resize');
    //         //     // toggleClass("canvasBorder", "-nsresize")
    //         // }
    //     });

    // document.getElementById("canvasBorder").addEventListener("mouseout", (e) => {
    //     toggleClass('canvasBorder', "-nsresize");
    //     toggleClass('canvasBorder', "-ewresize");
    // });

    // document.getElementById("canvasBorder").addEventListener("mousemove", (e) => {
    //     if (e.clientY >= e.target.offsetHeight - parseInt(getComputedStyle(e.target)["border-width"]) && e.clientX >= e.target.offsetWidth - parseInt(getComputedStyle(e.target)["border-width"])) { // 4 for border pixels
    //         toggleClass("canvasBorder", "+seresize");
    //     } else if (e.clientY >= e.target.offsetHeight - parseInt(getComputedStyle(e.target)["border-width"]) * 2) { // 4 for border pixels
    //         toggleClass("canvasBorder", "+nsresize");
    //     } else if (e.clientX >= e.target.offsetWidth - parseInt(getComputedStyle(e.target)["border-width"]) * 2) {
    //         toggleClass("canvasBorder", "+ewresize")
    //     }
    // });



    // document.getElementById("canvasBorder").addEventListener("mouseup", (e) => {
        //     console.log('mouseup in border');
        //     console.log("finalized resize");
//     window.removeEventListener('mousemove', resizeCanvas);
//     canvas.removeEventListener('mousemove', resizeCanvas);
//     recalculateLandedPoints();

// });

// document.getElementById("canvasBorder").addEventListener("mousemove", (e) => {
    //     console.log('mousemove in border');

    //     // TODO: se quadrant must go first
    //     console.log(e.offsetX)
    //     if (e.offsetX > canvas.width) {
        //         console.log("east edge")
        //     } else if (e.offsetY > canvas.height) {
            //         console.log("bottom edge")
            //     }
            // });
/*
#########################################
        INTERFACE INTERACTIONS
#########################################
*/

var handleClick = function (e) {
    // handler for canvas clicks
    e.target.blur()
    switch (mode) {
        case 0: // 0 - nothing
            document.getElementById("predictInput").value = transformPoint(e.offsetX, e.offsetY).x.toFixed(2);
            recalcPoly();
            break;
        case 1: // 1 - mark points in series
            markPoint(e);
            // toggleClass("step5status", "-missing");
            // toggleClass("step5status", "+set");          
            // if (document.getElementById("showRegression").checked) {
            //     drawRegression();
            // }
            break;
        case 2: // 2 - set datum
            setDatum(e.offsetX, e.offsetY);
            // toggleClass("step1status", "-missing");
            // toggleClass("step1status", "+set");
            toggleClass("setDatum0btn", "-activeBtn");
            setMode(modes.NOTHING);
            setCalibrationXYpixels(activeSeries, 0, e.offsetX, e.offsetY);
            document.getElementById("calibPoint1").innerText = calibrations[0].x0 + ", " + calibrations[0].y0;
            redrawUiPointList();
            drawDatum(datum.x, datum.y);
            recalcPoly();
            checkStepOK();
            // e.target.blur();
            break;
        case 3: // 3 add calibration point 2
            toggleClass("selectPoint2", "-activeBtn");
            setCalibrationXYpixels(activeSeries, 1, e.offsetX, e.offsetY);
            document.getElementById("calibPoint2").innerText = calibrations[0].x1 + ", " + calibrations[0].y1;
            recalcPoly();
            drawCalibMarker(calibrations[activeSeries].x1, calibrations[activeSeries].y1);
            setMode(modes.NOTHING);
            checkStepOK();
            // toggleClass("step3status", "-missing")
            // toggleClass("step3status", "+set")            
            // e.target.blur();
            break;
        case 4: // 4 resizing canvas
            // toggleClass("calibrateXscale0", "activeBtn");
            break;

    }
}


// draw when mouse is over canvas
canvas.addEventListener("mousemove", (e) => {


        drawCrosshair(e);

        // TODO: add this, however regression shouldn't be shown where the crosshair is.
        // if (document.getElementById("showRegression").checked)
        //     drawRegression(e.offsetX, e.offsetY);        
        e.stopPropagation();
        if (mode == modes.SET_DATUM) {
            drawDatum(e.offsetX, e.offsetY)
            
        } else if (mode == modes.SET_CALIB) {
            drawCalibMarker(e.offsetX, e.offsetY)
        }

        if (document.getElementById("showPrediction").checked && mode == modes.NOTHING && e.offsetX > calibrations[activeSeries].x0) {
            
            let p = new window.poly(polyResult);
            let t = transformPoint(e.offsetX, e.offsetY);
            let predictedY = p.predictY(polyResult, t.x);
            if (predictedY < calibrations[activeSeries].v_y0) {
                return;
            }
            drawTriangle(e.offsetX, transformPoint(t.x, predictedY, true).y, 10, 0.8, '#eb34d5');
        }
        
        // drawLineAtUserX();
    });

// draw when mouse leaves canvas
canvas.addEventListener("mouseout", (e) => {
    clearGraph();
    if (mode == modes.MARK_POINT) {
        // redraw the series if
        drawSeries();
    }
    if (document.getElementById("showRegression").checked) {
        drawRegression();
    }
    // setMode(modes.NOTHING);
    // clearButtons();
});

// handle all canvas clicks
// uses the 'mode' global variable to determine what happens
canvas.addEventListener("click", handleClick)

// set datum button click
document.getElementById('setDatum0div').addEventListener("click", (e) => {
    setMode(modes.SET_DATUM);
    toggleClass("setDatum0btn", "+activeBtn");
    e.target.blur();
});

// click mark points button
document.getElementById('markPoints0').addEventListener("click", (e) => {
    if (mode == modes.MARK_POINT) {
        setMode(modes.NOTHING);
        clearGraph();
        clearButtons();
        if (document.getElementById("showRegression").checked)
            drawRegression();

    } else {
        setMode(modes.MARK_POINT);
        clearButtons();
        toggleClass("markPoints0", "+activeBtn");
        drawSeries();
    }
    e.target.blur();

});

// // set calibration point button
// document.getElementById("setCalib1").addEventListener('click', (e) => {
//     console.log(document.getElementById("calib1valueX").value);
//     setCalibrationXYvalues(activeSeries, 0, document.getElementById("calib1valueX").value,  document.getElementById("calib1valueY").value);
//     recalcPoly();
//     e.target.blur();
// });

// set calibration point 2 button
// document.getElementById("setCalib2").addEventListener('click', (e) => {
//     console.log(document.getElementById("calib2valueX").value);
//     setCalibrationXYvalues(activeSeries, 1, document.getElementById("calib2valueX").value,  document.getElementById("calib2valueY").value);
//     recalcPoly();
//     toggleClass("calib2valueX", "-missing");
//     toggleClass("calib2valueY", "-missing");
//     toggleClass("point2status", "-missing");
//     toggleClass("point2status", "+set");
//     e.target.blur();
// });

// selection second point button
document.getElementById("selectPoint2").addEventListener("click", (e) => {
    // console.log("Setting pt2 by click");
    toggleClass("selectPoint2", "+activeBtn")
    setMode(modes.SET_CALIB);
    e.target.blur();
});


// document.getElementById("showHideCalib").addEventListener('click', (e) => { toggleClass("calibrate", "hidden")});
document.getElementById('filebrowsed').addEventListener('change', loadNewImageFromFile, false);
document.getElementById("predictInput").addEventListener("keyup", (e) => { recalcPoly(); });
document.getElementById("increasePoly").addEventListener('click', () => {polyDegree += 1; recalcPoly(); document.getElementById("polyDegreeValue").innerText = polyDegree; clearGraph(); drawRegression()});
document.getElementById("decreasePoly").addEventListener('click', () => {polyDegree -= 1; recalcPoly(); document.getElementById("polyDegreeValue").innerText = polyDegree; clearGraph(); drawRegression()});
document.getElementById("showRegression").addEventListener("click", (e) => { if (e.target.checked) { recalcPoly(); drawRegression(); } else { clearGraph(); } } );
// document.getElementById("plotRegression").addEventListener("click", () => { recalcPoly(); drawRegression(); });

// handle all keypresses
window.addEventListener("keydown", (e) => {

    if (e.key == "+" || e.key == "=") {
        // console.log("zoom ratio increase");
        zoomRatio += 0.25;
        clearGraph();
        drawZoomBox(crossXY[0], crossXY[1]);

    } else if (e.key == "-") {
        // console.log("zoom ratio decrease");
        if (zoomRatio <= 1)
            return;
        zoomRatio -= 0.25;
        clearGraph();
        drawZoomBox(crossXY[0], crossXY[1]);
    } else if (e.key == "z" || e.key == 'Z') {
        document.getElementById('showZoom').checked = !document.getElementById('showZoom').checked;
    } else if (e.key == "s" || e.key == 'S') {
        if (colors.crosshair == 'black') {
            colors.crosshair = "red";
            colors.zoomBox = "red";
        } else {
            colors.crosshair = "black";
            colors.zoomBox = "black";
        }
        // refreshGraph();
        
    } else if (e.key == "ArrowUp") {
        crossXY[1] -= 1;
        e.preventDefault();
        drawZoomBox(crossXY[0], crossXY[1]);
        drawCrosshair(e, crossXY[0], crossXY[1]);
        if (mode == modes.SET_DATUM) {
            drawDatum(crossXY[0], crossXY[1]);
            
        } else if (mode == modes.SET_CALIB) {
            drawCalibMarker(crossXY[0], crossXY[1]);
        }        
    } else if (e.key == "ArrowDown") {
        crossXY[1] += 1;
        e.preventDefault();
        drawZoomBox(crossXY[0], crossXY[1]);
        drawCrosshair(e, crossXY[0], crossXY[1]);
        if (mode == modes.SET_DATUM) {
            drawDatum(crossXY[0], crossXY[1]);
            
        } else if (mode == modes.SET_CALIB) {
            drawCalibMarker(crossXY[0], crossXY[1]);
        }        
    } else if (e.key == "ArrowLeft") {
        crossXY[0] -= 1;
        e.preventDefault();
        drawZoomBox(crossXY[0], crossXY[1]);
        drawCrosshair(e, crossXY[0], crossXY[1]);
        if (mode == modes.SET_DATUM) {
            drawDatum(crossXY[0], crossXY[1]);
            
        } else if (mode == modes.SET_CALIB) {
            drawCalibMarker(crossXY[0], crossXY[1]);
        }        
    } else if (e.key == "ArrowRight") {
        crossXY[0] += 1;
        e.preventDefault();
        drawZoomBox(crossXY[0], crossXY[1]);
        drawCrosshair(e, crossXY[0], crossXY[1]);
        if (mode == modes.SET_DATUM) {
            drawDatum(crossXY[0], crossXY[1]);
            
        } else if (mode == modes.SET_CALIB) {
            drawCalibMarker(crossXY[0], crossXY[1]);
        }        
    } else if (e.key == "Enter") {
        // console.log("Enter pressed, mode = ".concat(mode));
        if ( mode == modes.NOTHING) {
            document.getElementById("predictInput").value = transformPoint(crossXY[0], crossXY[1]).x.toFixed(2)
            recalcPoly();
        } else if (mode == modes.MARK_POINT) {
            series[activeSeries].push([crossXY[0], crossXY[1]]);
            drawSeries();
            redrawUiPointList();
        } else if (mode == modes.SET_DATUM) {
            setDatum(crossXY[0], crossXY[1]);
            // toggleClass("step1status", "-missing");
            // toggleClass("step1status", "+set");
            toggleClass("setDatum0btn", "-activeBtn");
            setMode(modes.NOTHING);
            setCalibrationXYpixels(activeSeries, 0, crossXY[0], crossXY[1]);
            redrawUiPointList();
            drawDatum();
            
        } else if (mode == modes.SET_CALIB) {
            setMode(modes.NOTHING);
            setCalibrationXYpixels(activeSeries, 1, crossXY[0], crossXY[1]);
            toggleClass("selectPoint2", "-activeBtn");
            drawCalibMarker();
            // toggleClass("step3status", "-missing");
            // toggleClass("step3status", "+set");
        }
    } else if (e.key == "Escape") {
        setMode(modes.NOTHING);
        clearButtons();
    }
});

document.getElementById("calib1valueX").addEventListener('keyup', (e) => {
    setCalibrationXYvalues(activeSeries, 0, e.target.value,  document.getElementById("calib1valueY").value);
    recalcPoly();
    checkStepOK();
    // e.target.blur();
});

document.getElementById("calib1valueY").addEventListener('keyup', (e) => {
    setCalibrationXYvalues(activeSeries, 0, document.getElementById("calib1valueX").value,  e.target.value);
    recalcPoly();
    checkStepOK();
    // e.target.blur();
});

document.getElementById("calib2valueX").addEventListener('keyup', (e) => {
    setCalibrationXYvalues(activeSeries, 1, e.target.value,  document.getElementById("calib2valueY").value);
    recalcPoly();
    checkStepOK();
    // e.target.blur();
});

document.getElementById("calib2valueY").addEventListener('keyup', (e) => {
    setCalibrationXYvalues(activeSeries, 1, document.getElementById("calib2valueX").value,  e.target.value);
    recalcPoly();
    checkStepOK();
    // e.target.blur();
});

document.getElementById("clearPoints").addEventListener("click", (e) => {
    series[activeSeries] = [];
    document.getElementById("series0").innerHTML = "";
    clearButtons();
    setMode(modes.NOTHING);
    recalcPoly();
    clearGraph();
    // toggleClass("step5status", "+missing");
    toggleClass("step5status", "-set");    
    checkStepOK();
});


window.addEventListener('paste', (event) => {
    /* 
        Draw pasted image onto the canvas
     */
    let paste = event.clipboardData.items;
 
    for (let i=0; i < paste.length; i++) {
        // console.log(paste[i]);
        if (paste[i].type.indexOf("image") !== -1) {
            event.preventDefault();
            // console.log("found image: " + paste[i].type);

            let imageBlob = paste[i].getAsFile(); // creates the blob

            image = new Image(); 

            image.onload = function () {
                resetEverything();
                // canvas and ctx are globally defined
                canvas.height = image.naturalHeight / image.naturalWidth * canvas.width;
                ctx.drawImage(image, 0, 0, canvas.width, canvas.height);  // draw this image onto the canvas.
            }

            let URLObj = window.URL || window.webkitURL;
            let urlBlob = URLObj.createObjectURL(imageBlob);  
            image.src = urlBlob;

        }
    }
});


    // keep this at the bottom, this is init stuff for the sample chart
    window.onload = function() {
        document.getElementById("calib2valueX").value = calibrations[0].v_x1;
        document.getElementById("calib2valueY").value = calibrations[0].v_y1;
        document.getElementById("calibPoint2").innerText = calibrations[0].x1 + ", " + calibrations[0].y1;
        document.getElementById("calibPoint1").innerText = calibrations[0].x0 + ", " + calibrations[0].y0;
        updateCalibrationUI();
        recalcPoly();
        drawRegression();
        // resetEverything();
    }

