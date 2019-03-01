import * as posenet from "@tensorflow-models/posenet";
import * as tf from "@tensorflow/tfjs";
import Stats from "stats.js";
import { saveAs } from "./FileSaver";
import { drawKeypoints, drawSkeleton, drawBoundingBox } from "./demo_util";

const videoWidth = 520;
const videoHeight = 680;
const stats = new Stats();
const dataLength = 500;
const noticeOK = "非常好！这个动作完成得非常标准。";

var currentPoses = [];
var dataCount = 0;
var poseData = [];
var notice;

/**
 * 先加载个镜头用
 */
async function setupCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error(
      "Browser API navigator.mediaDevices.getUserMedia not available"
    );
  }

  const video = document.getElementById("video");
  video.width = videoWidth;
  video.height = videoHeight;

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: "user",
      width: videoWidth,
      height: videoHeight
    }
  });
  video.srcObject = stream;

  return new Promise(resolve => {
    video.onloadedmetadata = () => {
      resolve(video);
    };
  });
}

/**
 * 加载视频
 */
async function loadVideo() {
  const video = await setupCamera();
  video.play();

  return video;
}

/**
 * 设置模型的基本参数
 */
const guiState = {
  algorithm: "single-pose",
  input: {
    mobileNetArchitecture: "0.75",
    outputStride: 16,
    imageScaleFactor: 0.5
  },
  singlePoseDetection: {
    minPoseConfidence: 0.1,
    minPartConfidence: 0.5
  },
  output: {
    showVideo: true,
    showSkeleton: true,
    showPoints: true,
    showBoundingBox: false
  },
  net: null
};

/**
 * 设置网页右上角的控制面板
 */
function setupGui(cameras, net) {
  guiState.net = net;
  if (cameras.length > 0) {
    guiState.camera = cameras[0].deviceId;
  }
  guiState.changeToArchitecture = 0.5;
}

/**
 * 展示匹配结果（正确时为绿色）
 */
const timeout = 24;
var count = timeout;
function showResult(poseVector, imageVector) {
  notice = noticeOK;
  //once the pose is true, the bgcolor will be green.
  let testSimilar = weightedDistanceMatching(poseVector, imageVector);
  let standard = 0.026;
  if (testSimilar < standard) {
    document.getElementById("judge_and_paint").style.backgroundColor =
      "#25C789";
    document.getElementById("noticeBox").className = "alert alert-success";
  } else {
    document.getElementById("judge_and_paint").style.backgroundColor =
      "#CD5555";
    if (count-- < timeout) {
      if (count < 0) count = timeout;
      return;
    }
    if (OnePartCorrection(poseVector, imageVector, standard)) {
      document.getElementById("noticeBox").className = "alert alert-info";
    } else if (TwoPartCheck(poseVector, imageVector, standard)) {
      document.getElementById("noticeBox").className = "alert alert-warning";
    } else {
      notice = "动作完全不对哦！请重新完成该动作";
      document.getElementById("noticeBox").className = "alert alert-danger";
    }
    count--;
  }
  document.getElementById("notice").innerText = notice;
}

/**
 * 传输一张图像进行处理识别，魔法发生的地方（video相当于图片，可以对video进行处理）
 */
function detectPoseInRealTime(video, net) {
  const canvas2 = document.getElementById("input");
  const canvas = document.getElementById("output");
  const ctx = canvas.getContext("2d");
  const flipHorizontal = true;
  const noflip = false;
  // 因为前置摄像头，需要反转图像

  canvas.width = videoWidth;
  canvas.height = videoHeight;
  canvas2.width = videoWidth;
  canvas2.height = videoHeight;

  // 按帧处理图像
  async function poseDetectionFrame() {
    // GUI参数设置
    if (guiState.changeToArchitecture) {
      guiState.net.dispose();
      guiState.net = await posenet.load(+guiState.changeToArchitecture);
      guiState.changeToArchitecture = null;
    }

    // 按秒逐帧处理
    stats.begin();

    // 缩放图像
    const imageScaleFactor = guiState.input.imageScaleFactor;
    const outputStride = +guiState.input.outputStride;

    // 开始处理图像
    let inputImage = document.getElementById("input_image");
    // console.log("Process input image");
    const imagePose = await guiState.net.estimateSinglePose(
      // 单姿态监测模型，处理输入图像（实时）
      inputImage,
      imageScaleFactor,
      noflip,
      outputStride
    );
    let imageFormattedPoints = formatKeypoints(imagePose.keypoints);
    let imageBoundingPoints = posenet.getBoundingBoxPoints(imagePose.keypoints);
    let imageVector = PoseVector(imageFormattedPoints, imageBoundingPoints);

    let poses = [];
    let minPoseConfidence;
    let minPartConfidence;

    switch (guiState.algorithm) {
      // 仅仅进行单姿态的比较
      case "single-pose":
        const pose = await guiState.net.estimateSinglePose(
          video,
          imageScaleFactor,
          flipHorizontal,
          outputStride
        );

        poses.push(pose);

        if (poses[0]) {
          currentPoses = poses;
          var temppose = poses[0];
          var formatedPoints = formatKeypoints(temppose.keypoints); // 获得的是一个17维的数组
          var boundingBoxPoint = posenet.getBoundingBoxPoints(
            temppose.keypoints
          ); // 获得四个点的坐标boundingbox
          let poseVector = PoseVector(formatedPoints, boundingBoxPoint);
          // let testSimilar = weightedDistanceMatching(poseVector, imageVector);
          // showResult(testSimilar); // 呈现比较结果
          showResult(poseVector, imageVector);
        }
        minPoseConfidence = +guiState.singlePoseDetection.minPoseConfidence;
        minPartConfidence = +guiState.singlePoseDetection.minPartConfidence;
        break;
    }

    ctx.clearRect(0, 0, videoWidth, videoHeight);

    if (guiState.output.showVideo) {
      ctx.save();
      ctx.scale(-1, 1);
      ctx.translate(-videoWidth, 0);
      ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
      ctx.restore();
    }

    // 将模型识别的结果进行作图（包含多姿态）
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

    // 结束模型
    stats.end();

    // 输出最后的帧图像，组成视频
    requestAnimationFrame(poseDetectionFrame);
  }
  poseDetectionFrame();
}

/**
 * 加载模型，设置网页显示的内容（整个应用的初始化函数）
 */
export async function bindPage() {
  // 加载posenet模型
  const net = await posenet.load(0.75);
  let video;

  document.getElementById("loading").style.display = "none";
  document.getElementById("main").style.display = "block";
  document.getElementById("img_box").value = 1;

  // 检测镜头
  try {
    video = await loadVideo();
  } catch (e) {
    let info = document.getElementById("info");
    info.textContent =
      "this browser does not support video capture," +
      "or this device does not have a camera";
    info.style.display = "block";
    throw e;
  }

  // Magic
  setupGui([], net);
  detectPoseInRealTime(video, net);
}

navigator.getUserMedia =
  navigator.getUserMedia ||
  navigator.webkitGetUserMedia ||
  navigator.mozGetUserMedia;
// 开始！
bindPage();

/**
 * 格式化关键点
 */
function formatKeypoints(keypoints) {
  // sort keypoints by part name
  let newKeys = [];
  for (let i = 0; i < keypoints.length; i++) {
    newKeys.push(keypoints[i]);
  }
  newKeys.sort(function(a, b) {
    var x = a.part.toLowerCase();
    var y = b.part.toLowerCase();
    return x < y ? -1 : x > y ? 1 : 0;
  });

  return newKeys;
}

/**
 * 加权距离匹配
 */
function weightedDistanceMatching(poseVector1, poseVector2) {
  typeof poseVector1;
  let vector1PoseXY = poseVector1.slice(0, 34);
  let vector1Confidences = poseVector1.slice(34, 51);
  let vector1ConfidenceSum = poseVector1.slice(51, 52);
  let vector2PoseXY = poseVector2.slice(0, 34);

  // First summation
  let summation1 = 1 / vector1ConfidenceSum;

  // Second summation
  let summation2 = 0;
  for (let i = 0; i < vector1PoseXY.length; i++) {
    let tempConf = Math.floor(i / 2);
    let tempSum =
      vector1Confidences[tempConf] *
      Math.abs(vector1PoseXY[i] - vector2PoseXY[i]);
    summation2 = summation2 + tempSum;
  }
  // 输出比较结果
  // console.log(summation * summation2);

  // 拿到训练数据、实时数据
  // dataCount++;
  // if (dataCount < dataLength && dataCount > 0) {
  //   var jsonObj = {
  //     imageVector: vector1PoseXY,
  //     videoVector: vector2PoseXY,
  //     result: summation1 * summation2
  //   };
  //   poseData.push(jsonObj);
  //   // console.log(poseData);
  // } else if (dataCount == dataLength) {
  //   var blob = new Blob([JSON.stringify(poseData)], { type: "" });
  //   saveAs(blob, "poseData.json");
  //   console.log("保存数据");
  // }
  return summation1 * summation2;
}

/**
 * 姿势向量
 */
function PoseVector(keypoints, boudingBoxpoints) {
  let boxWidth = boudingBoxpoints[1].x - boudingBoxpoints[0].x;
  let boxHeight = boudingBoxpoints[3].y - boudingBoxpoints[0].y;
  let x0 = boudingBoxpoints[0].x;
  let y0 = boudingBoxpoints[0].y;
  var vectorTemp = [];
  for (let i = 0; i < keypoints.length; i++) {
    const { x, y } = keypoints[i].position;

    let x1 = ((x - x0) * 400) / boxWidth;
    vectorTemp.push(x1);
    let y1 = ((y - y0) * 400) / boxHeight;
    vectorTemp.push(y1);
  }

  let PoseVector = l2_normalize(vectorTemp);
  var sum = 0;
  for (let j = 0; j < keypoints.length; j++) {
    sum += keypoints[j].score;
    PoseVector.push(keypoints[j].score);
  }
  PoseVector.push(sum);
  return PoseVector;
}

/**
 * 归一化
 */
function l2_normalize(vectorList, dim) {
  for (let i = 0; i < vectorList.length; i++) {
    vectorList[i] = vectorList[i] * vectorList[i];
  }
  const data = tf.tensor1d(vectorList);
  const sum = tf.variable(tf.sum(data).toFloat()).get();
  // sum.print();
  for (let i = 0; i < vectorList.length; i++) {
    vectorList[i] = tf.variable(tf.sqrt(vectorList[i] / sum)).get();
  }
  return vectorList;
}

/**
 * 纠正建议部分
 */
function HeadReplace(poseVector1, poseVector2) {
  poseVector1[8] = poseVector2[8]; // nose
  poseVector1[1] = poseVector2[1]; // leftEar
  poseVector1[10] = poseVector2[10]; // rightEar
  poseVector1[3] = poseVector2[3]; // leftEye
  poseVector1[12] = poseVector2[12]; // rightEye
  return poseVector1;
}

function LeftArmReplace(poseVector1, poseVector2) {
  poseVector1[2] = poseVector2[2]; // leftElbow
  poseVector1[6] = poseVector2[6]; // leftShoulder
  poseVector1[7] = poseVector2[7]; // leftWrist
  return poseVector1;
}

function RightArmReplace(poseVector1, poseVector2) {
  poseVector1[11] = poseVector2[11]; // rightElbow
  poseVector1[15] = poseVector2[15]; // rightShoulder
  poseVector1[16] = poseVector2[16]; // righttWrist
  return poseVector1;
}

function LeftLegReplace(poseVector1, poseVector2) {
  poseVector1[4] = poseVector2[4]; // leftHip
  poseVector1[5] = poseVector2[5]; // leftKnee
  poseVector1[0] = poseVector2[0]; // leftAnkle
  return poseVector1;
}

function RightLegReplace(poseVector1, poseVector2) {
  poseVector1[13] = poseVector2[13]; // leftHip
  poseVector1[14] = poseVector2[14]; // leftKnee
  poseVector1[9] = poseVector2[9]; // leftAnkle
  return poseVector1;
}

// 替换一个部位或者替换两个部位
function OnePartCorrection(poseVector1, poseVector2, standard) {
  let poseVector = HeadReplace(poseVector1, poseVector2);
  let confidence = weightedDistanceMatching(poseVector, poseVector2);
  if (confidence < standard) {
    // 头部替换后动作合格
    notice = "请调整您的头部动作。";
    // console.log("请调整您的头部动作");
    return true;
  }

  poseVector = LeftArmReplace(poseVector1, poseVector2);
  confidence = weightedDistanceMatching(poseVector, poseVector2);
  if (confidence < standard) {
    // 左臂动作替换后合格
    notice = "请调整您的左臂姿势。";
    // console.log("请调整您的左臂姿势");
    return true;
  }

  poseVector = RightArmReplace(poseVector1, poseVector2);
  confidence = weightedDistanceMatching(poseVector, poseVector2);
  if (confidence < standard) {
    // 右臂动作替换后合格
    notice = "请调整您的右臂姿势。";
    // console.log("请调整您的右臂姿势");
    return true;
  }

  poseVector = LeftLegReplace(poseVector1, poseVector2);
  confidence = weightedDistanceMatching(poseVector, poseVector2);
  if (confidence < standard) {
    // 左腿动作替换后合格
    notice = "请调整您的左腿动作。";
    // notice = console.log("请调整您的左腿动作");
    return true;
  }

  poseVector = RightLegReplace(poseVector1, poseVector2);
  confidence = weightedDistanceMatching(poseVector, poseVector2);
  if (confidence < standard) {
    // 右腿动作替换后合格
    notice = "请调整您的右腿动作。";
    // console.log("请调整您的右腿动作");
    return true;
  }
  return false;
}

function TwoPartCheck(poseVector1, poseVector2, standard) {
  // 对部分部位进行两两检查：左臂和右臂，左腿和右腿，左臂和左腿，右臂和右腿
  let poseVector = LeftArmReplace(poseVector1, poseVector2);
  poseVector = RightArmReplace(poseVector, poseVector2);
  let confidence = weightedDistanceMatching(poseVector, poseVector2);
  if (confidence < standard) {
    notice = "请注意您的左右臂是否协调。";
    // console.log("请注意您的左右臂是否协调");
    return true;
  }

  poseVector = LeftLegReplace(poseVector1, poseVector2);
  poseVector = RightLegReplace(poseVector, poseVector2);
  confidence = weightedDistanceMatching(poseVector, poseVector2);
  if (confidence < standard) {
    notice = "请注意您的左右腿是否协调。";
    // console.log("请注意您的左右腿是否协调");
    return true;
  }

  poseVector = LeftArmReplace(poseVector1, poseVector2);
  poseVector = LeftLegReplace(poseVector, poseVector2);
  confidence = weightedDistanceMatching(poseVector, poseVector2);
  if (confidence < standard) {
    notice = "请注意您的左臂和左腿是否协调。";
    // console.log("请注意您的左臂和左腿是否协调");
    return true;
  }

  poseVector = RightArmReplace(poseVector1, poseVector2);
  poseVector = RightLegReplace(poseVector, poseVector2);
  confidence = weightedDistanceMatching(poseVector, poseVector2);
  if (confidence < standard) {
    notice = "请注意您的右臂和右腿是否协调。";
    // console.log("请注意您的右臂和右腿是否协调");
    return true;
  }
  return false;
}
