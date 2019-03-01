// here're functions

var count = 0;

changeImg = function(flag) {
  document.getElementById("img_box").value = 0;
  console.log(document.getElementById("img_box").value);
  document.getElementById("judge_and_paint").style.backgroundColor = "#CD5555";
  var imgs = document.getElementById("img_box").getElementsByTagName("img");
  if (flag == 1) {
    if (++count == imgs.length) count = 0;
  } else {
    if (--count == -1) count = imgs.length - 1;
  }
  for (i = 0; i < imgs.length; i++) {
    if (i == count) {
      imgs[i].style.display = "inline";
      imgs[i].id = "input_image";
    } else {
      imgs[i].style.display = "none";
      imgs[i].id = "standby_image";
    }
  }
};

signIn = function() {
  window.location.href = "intro.html";
};

settings = function() {
  // account settings
};
