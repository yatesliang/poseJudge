// modules are defined as an array
// [ module function, map of requires ]
//
// map of requires is short require name -> numeric require
//
// anything defined in a previous bundle is accessed via the
// orig method which is the require for previous bundles

// eslint-disable-next-line no-global-assign
require = (function (modules, cache, entry) {
  // Save the require from previous bundle to this closure if any
  var previousRequire = typeof require === "function" && require;

  function newRequire(name, jumped) {
    if (!cache[name]) {
      if (!modules[name]) {
        // if we cannot find the module within our internal map or
        // cache jump to the current global require ie. the last bundle
        // that was added to the page.
        var currentRequire = typeof require === "function" && require;
        if (!jumped && currentRequire) {
          return currentRequire(name, true);
        }

        // If there are other bundles on this page the require from the
        // previous one is saved to 'previousRequire'. Repeat this as
        // many times as there are bundles until the module is found or
        // we exhaust the require chain.
        if (previousRequire) {
          return previousRequire(name, true);
        }

        var err = new Error('Cannot find module \'' + name + '\'');
        err.code = 'MODULE_NOT_FOUND';
        throw err;
      }

      localRequire.resolve = resolve;

      var module = cache[name] = new newRequire.Module(name);

      modules[name][0].call(module.exports, localRequire, module, module.exports);
    }

    return cache[name].exports;

    function localRequire(x){
      return newRequire(localRequire.resolve(x));
    }

    function resolve(x){
      return modules[name][1][x] || x;
    }
  }

  function Module(moduleName) {
    this.id = moduleName;
    this.bundle = newRequire;
    this.exports = {};
  }

  newRequire.isParcelRequire = true;
  newRequire.Module = Module;
  newRequire.modules = modules;
  newRequire.cache = cache;
  newRequire.parent = previousRequire;

  for (var i = 0; i < entry.length; i++) {
    newRequire(entry[i]);
  }

  // Override the current require with this new one
  return newRequire;
})({7:[function(require,module,exports) {
// here're functions

var count = 0;

changeImg = function (flag) {
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

signIn = function () {
  window.location.href = "intro.html";
};

settings = function () {
  // account settings
};
},{}]},{},[7])
//# sourceMappingURL=/dist/27d5686c43b831a717058f05a7399b54.map