import * as posenet from '@tensorflow-models/posenet';
const imageScaleFactor = 0.5;
const outputStride = 16;
const flipHorizontal = false;

async function estimatePoseOnImage(imageElement) {
    // load the posenet model from a checkpoint
    const net = await posenet.load();

    const pose = await net.estimateSinglePose(imageElement, imageScaleFactor, flipHorizontal, outputStride);

    return pose;
}

const imageElement = document.getElementById('demo_pic');

const pose = estimatePoseOnImage(imageElement);

console.log(pose);