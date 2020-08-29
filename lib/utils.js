const path = require('path');
const net = require('net');
const cv = require('opencv4nodejs');

exports.cv = cv;

const dataPath = path.resolve(__dirname, '../data');
exports.dataPath = dataPath;
exports.getDataFilePath = fileName => path.resolve(dataPath, fileName);

const grabFrames = (videoFile, delay, onFrame) => {
    const cap = new cv.VideoCapture(videoFile, cv.CAP_FFMPEG);
    cap.set(cv.CAP_PROP_BUFFERSIZE, 1);
    const intvl = setInterval(() => {
        let frame = cap.read();
        if (!frame.empty) {
            onFrame(frame);
        } else {
            // cap.reset()
        }

    }, 10);
};
exports.grabFrames = grabFrames;

exports.runVideoDetection = (src, detect) => {
    grabFrames(src, 1, frame => {
        detect(frame);
    });
};

exports.drawRectAroundBlobs = (binaryImg, dstImg, minPxSize, fixedRectWidth) => {
    const {
        centroids,
        stats
    } = binaryImg.connectedComponentsWithStats();

    // pretend label 0 is background
    for (let label = 1; label < centroids.rows; label += 1) {
        const [x1, y1] = [stats.at(label, cv.CC_STAT_LEFT), stats.at(label, cv.CC_STAT_TOP)];
        const [x2, y2] = [
            x1 + (fixedRectWidth || stats.at(label, cv.CC_STAT_WIDTH)),
            y1 + (fixedRectWidth || stats.at(label, cv.CC_STAT_HEIGHT))
        ];
        const size = stats.at(label, cv.CC_STAT_AREA);
        const blue = new cv.Vec(255, 0, 0);
        if (minPxSize < size) {
            dstImg.drawRectangle(
                new cv.Point(x1, y1),
                new cv.Point(x2, y2), {
                    color: blue,
                    thickness: 2
                }
            );
        }
    }
};

const drawRect = (image, rect, color, opts = {
        thickness: 2
    }) =>
    image.drawRectangle(
        rect,
        color,
        opts.thickness,
        cv.LINE_8
    );

exports.drawRect = drawRect;
exports.drawBlueRect = (image, rect, opts = {
        thickness: 2
    }) =>
    drawRect(image, rect, new cv.Vec(255, 0, 0), opts);
exports.drawGreenRect = (image, rect, opts = {
        thickness: 2
    }) =>
    drawRect(image, rect, new cv.Vec(0, 255, 0), opts);
exports.drawRedRect = (image, rect, opts = {
        thickness: 2
    }) =>
    drawRect(image, rect, new cv.Vec(0, 0, 255), opts);
