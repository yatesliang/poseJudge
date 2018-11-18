import * as posenet from '@tensorflow-models/posenet';
import * as tf from '@tensorflow/tfjs';
import dat from 'dat.gui';
import Stats from 'stats.js';
import { drawKeypoints, drawSkeleton, drawBoundingBox } from './demo_util';


const videoWidth = 500;
const videoHeight = 600;
const stats = new Stats();
var currentPoses = []

function isAndroid() {
  return /Android/i.test(navigator.userAgent);
}

function isiOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isMobile() {
  return isAndroid() || isiOS();
}

/**
 * Loads a the camera to be used in the demo
 * 先加载个镜头用
 */
async function setupCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error(
      'Browser API navigator.mediaDevices.getUserMedia not available');
  }

  const video = document.getElementById('video');
  video.width = videoWidth;
  video.height = videoHeight;

  const mobile = isMobile();
  const stream = await navigator.mediaDevices.getUserMedia({
    'audio': false,
    'video': {
      facingMode: 'user',
      width: mobile ? undefined : videoWidth,
      height: mobile ? undefined : videoHeight,
    },
  });
  video.srcObject = stream;

  return new Promise((resolve) => {
    video.onloadedmetadata = () => {
      resolve(video);
    };
  });
}

async function loadVideo() {
  const video = await setupCamera();
  video.play();

  return video;
}

const guiState = {
  algorithm: 'single-pose',
  input: {
    mobileNetArchitecture: isMobile() ? '0.50' : '0.75',
    outputStride: 16,
    imageScaleFactor: 0.5,
  },
  singlePoseDetection: {
    minPoseConfidence: 0.1,
    minPartConfidence: 0.5,
  },
  multiPoseDetection: {
    maxPoseDetections: 5,
    minPoseConfidence: 0.15,
    minPartConfidence: 0.1,
    nmsRadius: 30.0,
  },
  output: {
    showVideo: true,
    showSkeleton: true,
    showPoints: true,
    showBoundingBox: false,
  },
  net: null,
};

/**
 * Sets up dat.gui controller on the top-right of the window
 * 设置网页右上角的控制面板
 */
function setupGui(cameras, net) {
  guiState.net = net;

  if (cameras.length > 0) {
    guiState.camera = cameras[0].deviceId;
  }

  // const gui = new dat.GUI({ width: 300 });

  // The single-pose algorithm is faster and simpler but requires only one
  // person to be in the frame or results will be innaccurate. Multi-pose works
  // for more than 1 person
  // const algorithmController =
  //   gui.add(guiState, 'algorithm', ['single-pose', 'multi-pose']);

  // The input parameters have the most effect on accuracy and speed of the
  // network
  // let input = gui.addFolder('Input');
  // Architecture: there are a few PoseNet models varying in size and
  // accuracy. 1.01 is the largest, but will be the slowest. 0.50 is the
  // fastest, but least accurate.
  // const architectureController = input.add(
  //   guiState.input, 'mobileNetArchitecture',
  //   ['1.01', '1.00', '0.75', '0.50']);
  // Output stride:  Internally, this parameter affects the height and width of
  // the layers in the neural network. The lower the value of the output stride
  // the higher the accuracy but slower the speed, the higher the value the
  // faster the speed but lower the accuracy.
  /*
  input.add(guiState.input, 'outputStride', [8, 16, 32]);
  // Image scale factor: What to scale the image by before feeding it through
  // the network.
  input.add(guiState.input, 'imageScaleFactor').min(0.2).max(1.0);
  //input.open();

  // Pose confidence: the overall confidence in the estimation of a person's
  // pose (i.e. a person detected in a frame)
  // Min part confidence: the confidence that a particular estimated keypoint
  // position is accurate (i.e. the elbow's position)
  let single = gui.addFolder('Single Pose Detection');
  single.add(guiState.singlePoseDetection, 'minPoseConfidence', 0.0, 1.0);
  single.add(guiState.singlePoseDetection, 'minPartConfidence', 0.0, 1.0);

  let multi = gui.addFolder('Multi Pose Detection');
  multi.add(guiState.multiPoseDetection, 'maxPoseDetections')
    .min(1)
    .max(20)
    .step(1);
  multi.add(guiState.multiPoseDetection, 'minPoseConfidence', 0.0, 1.0);
  multi.add(guiState.multiPoseDetection, 'minPartConfidence', 0.0, 1.0);
  // nms Radius: controls the minimum distance between poses that are returned
  // defaults to 20, which is probably fine for most use cases
  multi.add(guiState.multiPoseDetection, 'nmsRadius').min(0.0).max(40.0);
  //multi.open();

  let output = gui.addFolder('Output');
  output.add(guiState.output, 'showVideo');
  output.add(guiState.output, 'showSkeleton');
  output.add(guiState.output, 'showPoints');
  output.add(guiState.output, 'showBoundingBox');
  //output.open();
  */

  // architectureController.onChange(function (architecture) {
  //   guiState.changeToArchitecture = architecture;
  // });
  guiState.changeToArchitecture = 0.5;

  // algorithmController.onChange(function (value) {
  //   switch (guiState.algorithm) {
  //     case 'single-pose':
  //       multi.close();
  //       single.open();
  //       break;
  //     case 'multi-pose':
  //       single.close();
  //       multi.open();
  //       break;
  //   }
  // });
}

/**
 * Sets up a frames per second panel on the top-left of the window
 * 设置网页左上角的面板（竟然是不断输出图像？？？）
 */
function setupFPS() {
  stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
  document.body.appendChild(stats.dom);
}

/**
 * Feeds an image to posenet to estimate poses - this is where the magic
 * happens. This function loops with a requestAnimationFrame method.
 * 传输一张图像进行处理识别，魔法发生的地方
 * video相当于图片，可以对video进行处理
 */
function detectPoseInRealTime(video, net) {
  // for test ouput the video
  // console.log(video)
  const canvas2 = document.getElementById('input');
  const canvas = document.getElementById('output');
  const ctx = canvas.getContext('2d');
  const ctx2 = canvas2.getContext('2d');
  // since images are being fed from a webcam
  const flipHorizontal = true;

  canvas.width = videoWidth;
  canvas.height = videoHeight;
  canvas2.width = videoWidth;
  canvas2.height = videoHeight;

  async function poseDetectionFrame() {
    if (guiState.changeToArchitecture) {
      // Important to purge variables and free up GPU memory
      guiState.net.dispose();

      // Load the PoseNet model weights for either the 0.50, 0.75, 1.00, or 1.01
      // version
      guiState.net = await posenet.load(+guiState.changeToArchitecture);

      guiState.changeToArchitecture = null;
    }

    // Begin monitoring code for frames per second
    stats.begin();

    // Scale an image down to a certain factor. Too large of an image will slow
    // down the GPU
    const imageScaleFactor = guiState.input.imageScaleFactor;
    const outputStride = +guiState.input.outputStride;
    /**
     * process the image
     */


    let images = document.getElementById('demo_pic1');
    const imagePose = await guiState.net.estimateSinglePose(
      images, imageScaleFactor, flipHorizontal, outputStride);
    // console.log(imagePose);
    let imageFormattedPoints = formatKeypoints(imagePose.keypoints);
    let imageBoundingPoints = posenet.getBoundingBoxPoints(imagePose.keypoints);
    let imageVector = PoseVector(imageFormattedPoints, imageBoundingPoints);


    let poses = [];
    let minPoseConfidence;
    let minPartConfidence;
    switch (guiState.algorithm) {
      case 'single-pose':
        // test the video
        // console.log(video);
        const pose = await guiState.net.estimateSinglePose(
          video, imageScaleFactor, flipHorizontal, outputStride);
        if (pose.hasOwnProperty('score')) {
          poses.push(pose);
        } else {
          poses = pose;
        }
        if (poses[0]) {
          currentPoses = poses;
          var temppose = poses[0];
          var formatedPoints = formatKeypoints(temppose.keypoints); // 获得的是一个17维的数组
          var boundingBoxPoint = posenet.getBoundingBoxPoints(temppose.keypoints);  // 获得四个点的坐标boundingbox
          let poseVector = PoseVector(formatedPoints, boundingBoxPoint);
          // console.log(typeof(poseVector));
          let testSimilar = weightedDistanceMatching(poseVector, imageVector);
          // console.log(testSimilar);
          // console.log(formatedPoints);
          // console.log(boundingBoxPoint);
        }
        minPoseConfidence = +guiState.singlePoseDetection.minPoseConfidence;
        minPartConfidence = +guiState.singlePoseDetection.minPartConfidence;
        break;
      case 'multi-pose':
        poses = await guiState.net.estimateMultiplePoses(
          video, imageScaleFactor, flipHorizontal, outputStride,
          guiState.multiPoseDetection.maxPoseDetections,
          guiState.multiPoseDetection.minPartConfidence,
          guiState.multiPoseDetection.nmsRadius);

        minPoseConfidence = +guiState.multiPoseDetection.minPoseConfidence;
        minPartConfidence = +guiState.multiPoseDetection.minPartConfidence;
        break;
    }

    ctx.clearRect(0, 0, videoWidth, videoHeight);
    // ctx2.clearRect(0, 0, videoWidth, videoHeight);

    if (guiState.output.showVideo) {
      ctx.save();
      ctx.scale(-1, 1);
      ctx.translate(-videoWidth, 0);
      ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
      ctx.restore();
      // ctx2.save();
      // ctx2.scale(-1, 1);
      // ctx2.translate(-videoWidth, 0);
      // ctx2.drawImage(images, 0, 0, videoWidth, videoHeight);
      // ctx2.restore();
    }

    // For each pose (i.e. person) detected in an image, loop through the poses
    // and draw the resulting skeleton and keypoints if over certain confidence
    // scores
    poses.forEach(({ score, keypoints }) => {
      if (score >= minPoseConfidence) {
        if (guiState.output.showPoints) {
          drawKeypoints(keypoints, minPartConfidence, ctx);
        }
        if (guiState.output.showSkeleton) {
          drawSkeleton(keypoints, minPartConfidence, ctx);
        }
        if (guiState.output.showBoundingBox) {
          drawBoundingBox(keypoints, ctx);
        }
      }
    });

    // End monitoring code for frames per second
    stats.end();

    requestAnimationFrame(poseDetectionFrame);
  }

  poseDetectionFrame();
}

/**
 * Kicks off the demo by loading the posenet model, finding and loading
 * available camera devices, and setting off the detectPoseInRealTime function.
 * 加载模型，设置网页显示的内容
 */
export async function bindPage() {
  // Load the PoseNet model weights with architecture 0.75
  const net = await posenet.load(0.75);

  document.getElementById('loading').style.display = 'none';
  document.getElementById('main').style.display = 'block';

  let video;

  try {
    video = await loadVideo();
  } catch (e) {
    let info = document.getElementById('info');
    info.textContent = 'this browser does not support video capture,' +
      'or this device does not have a camera';
    info.style.display = 'block';
    throw e;
  }
  // Magic
  setupGui([], net);
  // setupFPS();
  detectPoseInRealTime(video, net);
}

navigator.getUserMedia = navigator.getUserMedia ||
  navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
// kick off the demo
bindPage();


 function formatKeypoints(keypoints) {
  // sort keypoints by part name
  keypoints.sort(function (a, b) {
    var x = a.part.toLowerCase();
    var y = b.part.toLowerCase();
    return x < y ? -1 : x > y ? 1 : 0;
  });

  return keypoints;
};


function weightedDistanceMatching(poseVector1, poseVector2) {
  typeof(poseVector1);
  // let vector1 = tf.tensor1d(poseVector1);
  // let vector2 = tf.tensor1d(poseVector2);
  let vector1PoseXY = poseVector1.slice(0, 34);
  let vector1Confidences = poseVector1.slice(34, 51);
  let vector1ConfidenceSum =poseVector1.slice(51, 52);
  let vector2PoseXY = poseVector2.slice(0, 34);

  // console.log(vector1PoseXY);
  // First summation
  let summation1 = 1 / vector1ConfidenceSum;

  // Second summation
  let summation2 = 0;
  for (let i = 0; i < vector1PoseXY.length; i++) {
    let tempConf = Math.floor(i / 2);
    let tempSum = vector1Confidences[tempConf] * Math.abs(vector1PoseXY[i] - vector2PoseXY[i]);
    summation2 = summation2 + tempSum;
  }
  console.log(summation1 * summation2);
  return summation1 * summation2;
}

function PoseVector(keypoints, boudingBoxpoints) {
  let boxWidth = boudingBoxpoints[1].x - boudingBoxpoints[0].x;
  let boxHeight = boudingBoxpoints[3].y - boudingBoxpoints[0].y;
  let x0 = boudingBoxpoints[0].x;
  let y0 = boudingBoxpoints[0].y;
  var vectorTemp = [];
  // console.log(x0);
  for (let i = 0; i < keypoints.length; i++) {
    const {x, y} = keypoints[i].position;
    
    let x1 = (x - x0) * 400 / boxWidth;
    // console.log(x1);
    vectorTemp.push(x1);
    let y1 = (y - y0) * 400 / boxHeight;
    vectorTemp.push(y1);
  }
  
  // let PoseVector = tf.Math.l2_normalize(vectorTemp, dim = 0);
  // let PoseVector = tf.nn.l2_normalize(vectorTemp, dim = 0);
  // console.log(vectorTemp);
  let PoseVector = l2_normalize(vectorTemp);
  var sum = 0;
  for (let j = 0; j < keypoints.length; j++) {
    sum += keypoints[j].score;
    PoseVector.push(keypoints[j].score);
  }
  PoseVector.push(sum);
  // console.log(PoseVector);
  return PoseVector;
}

function l2_normalize(vectorList, dim) {
  for (let i = 0; i < vectorList.length; i++) {
    vectorList[i] = vectorList[i] * vectorList[i];
  }
  const data = tf.tensor1d(vectorList);
  const sum = tf.variable(tf.sum(data).toFloat()).get();
  // console.log(sum.get());
  // sum.print();
  for (let i = 0; i < vectorList.length; i++) {
    vectorList[i] = tf.variable(tf.sqrt(vectorList[i]/sum)).get();
  }
  // console.log(vectorList);
  return vectorList;
}
