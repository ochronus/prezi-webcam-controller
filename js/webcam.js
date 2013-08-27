navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia || undefined;
var cameraElement;

function initWebcamHandler() {
    if (navigator.getUserMedia === undefined) {
        if (console !== undefined) {
            console.log("Browser doesn't support getUserMedia");
            return;
        }
    }

    navigator.getUserMedia({
        video: true,
        audio: false
    }, function (stream) {
        window.webcamSwiperStream = stream;


        cameraElement = document.createElement("video");
        cameraElement.style.display = "none";
        document.getElementsByTagName("body")[0].appendChild(cameraElement);
        if (window.URL === undefined) {
            window.URL = window.webkitURL;
        }

        if (cameraElement.mozSrcObject !== undefined) {
            cameraElement.mozSrcObject = stream;
        } else {
            cameraElement.src = window.URL.createObjectURL(stream);
        }
        cameraElement.play();


        cameraElement.addEventListener("loadeddata", processCameraFrame);
    }, function (err) {
        console('Something went wrong in getUserMedia');
    });
}

function processCameraFrame() {

    var hRes = cameraElement.videoWidth;
    var vRes = cameraElement.videoHeight;

    if (hRes < 1 || hRes > 4000) {
        setTimeout(processCameraFrame, 100);
        console.log('Trying again');
        return;
    }

    var canvasWidth = hRes > 320 ? 320 : hRes;
    var canvasHeight = vRes > 240 ? 240 : vRes;


    var greyScaleCanvas = document.createElement("canvas");
    greyScaleCanvas.width = canvasWidth;
    greyScaleCanvas.height = canvasHeight;
    var greyscaleCtx = greyScaleCanvas.getContext("2d");
    var currentImageData = greyscaleCtx.createImageData(canvasWidth, canvasHeight);


    var isActive = false;
    var remainingFrames = 14;
    var PIXEL_CHANGE_MIN = 30;
    var FRAME_MIN_CHANGE = 15000;
    var originalWeight = 0;
    var previousImageData;
    var lightLevel = 0;
    var scanCount = 0;
    var frameAnalysisTime = 36;


    window.webcamSwiperInterval = setInterval(analyzeCurrentFrame, 1000 / 28);

    function analyzeCurrentFrame() {

        var startTime = new Date().getTime();
        scanCount++;
        previousImageData = currentImageData;
        greyscaleCtx.drawImage(cameraElement, 0, 0, hRes, vRes, 0, 0, canvasWidth, canvasHeight);

        currentImageData = toGreyScale(greyscaleCtx.getImageData(0, 0, canvasWidth, canvasHeight));

        if (scanCount % 50 === 0) {

            lightLevel = getLightLevel(currentImageData);
            if (lightLevel > 0 && lightLevel <= 1) {
                PIXEL_CHANGE_MIN = 25;
                FRAME_MIN_CHANGE = 3000;
            } else if (lightLevel > 1 && lightLevel < 3) {
                PIXEL_CHANGE_MIN = 28;
                FRAME_MIN_CHANGE = 6000;
            } else {
                PIXEL_CHANGE_MIN = 30;
                FRAME_MIN_CHANGE = 15000;
            }


            if (frameAnalysisTime > 36) {
                clearInterval(window.webcamSwiperInterval);
                window.webcamSwiperInterval = setInterval(analyzeCurrentFrame, 1000 / (frameAnalysisTime * 2));
            }
        }


        var currentWeight = getMotionAmount(previousImageData, currentImageData);


        if (!isActive) {
            if (Math.abs(currentWeight) > FRAME_MIN_CHANGE) {
                isActive = true;
                remainingFrames = 8;
                originalWeight = currentWeight;
            }
        }


        if (isActive) {
            if (remainingFrames <= 0) {
                isActive = false;
            } else {
                remainingFrames--;
                if (originalWeight > 0) {
                    if (currentWeight < -FRAME_MIN_CHANGE) {
                        fireSwipeEvent("webcamSwipeRight");
                        isActive = false;
                    }
                } else {
                    if (currentWeight > FRAME_MIN_CHANGE) {
                        fireSwipeEvent("webcamSwipeLeft");
                        isActive = false;
                    }
                }
            }
        }


        var endTime = new Date().getTime();
        frameAnalysisTime = endTime - startTime;
    }

    function fireSwipeEvent(eventName) {
        var swipeLeftEvent = document.createEvent("UIEvents");
        swipeLeftEvent.initEvent(eventName, false, false);
        document.getElementsByTagName("body")[0].dispatchEvent(swipeLeftEvent);
    }

    function getMotionAmount(previous, current) {
        var motionWeight = 0;
        var previousData = previous.data;
        var currentData = current.data;
        var dataLength = previousData.length;
        for (var i = 0; i < dataLength; i += 4) {
            if (Math.abs(previousData[i] - currentData[i]) > PIXEL_CHANGE_MIN) {
                motionWeight += ((i / 4) % canvasWidth) - (canvasWidth / 2);
            }
        }
        return motionWeight;
    }


    function toGreyScale(imageData) {
        var theData = imageData.data;
        var newImageData = greyscaleCtx.createImageData(imageData);
        var newData = newImageData.data;

        var dataLength = theData.length;
        for (var i = 0; i < dataLength; i += 4) {

            var average = (theData[i] + theData[i + 1] + theData[i + 2]) / 3;
            newData[i] = newData[i + 1] = newData[i + 2] = average;

            newData[i + 3] = 255;
        }

        return newImageData;
    }


    function getLightLevel(imageData) {
        var theData = imageData.data;
        var dataLength = theData.length;

        var value = 0;
        for (var i = 0; i < dataLength; i += 4) {
            value += theData[i];
        }

        return value / theData.length;
    }
}

function unloadWebcamHandler() {
    if (window.webcamSwiperInterval !== undefined) {
        clearInterval(window.webcamSwiperInterval);
        window.webcamSwiperInterval = undefined;
    }
    if (window.webcamSwiperStream !== undefined) {
        window.webcamSwiperStream.stop();
        window.webcamSwiperStream = undefined;
    }
}
