"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.generate = exports.cycle = exports.analysis = exports.flow = void 0;

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

var fs = require('fs');

var _require = require('@babel/core'),
    parse = _require.parse,
    transformFromAst = _require.transformFromAst,
    traverse = _require.traverse,
    types = _require.types;

var flow = function flow(entry, done) {
  var fn = function fn(file, dependenciesM, codesM, done) {
    fs.readFile(file, 'utf-8', function (err, res) {
      if (err) {
        return done(Error('read file err: ' + err.message), {}, {});
      } // parse


      var ast = parse(res, {
        sourceType: 'module'
      });
      var dependencies = analysis(ast);
      dependenciesM[file] = dependencies; // analysis

      var cycled = cycle(entry, dependenciesM);

      if (cycled.length) {
        return done(Error('cycle dependency: ' + cycled.map(function (x) {
          return x.join(' -> ');
        }).join(' & ')), {}, {});
      } // transform
      // this should be done after analysis
      // because extname maybe have been appended


      var _transformFromAst = transformFromAst(ast, null, {
        presets: ['@babel/preset-env']
      }),
          code = _transformFromAst.code;

      codesM[file] = code;
      var l = dependencies.length;

      var next = function next(i) {
        if (i === l) {
          return done(null, dependenciesM, codesM);
        }

        if (codesM[dependencies[i]]) {
          return next(i + 1);
        }

        fn(dependencies[i], dependenciesM, codesM, function (err) {
          if (err) {
            return done(err, {}, {});
          }

          next(i + 1);
        });
      };

      next(0);
    });
  };

  return fn(entry, {}, {}, done);
};

exports.flow = flow;

var analysis = function analysis(ast) {
  var dependencies = [];
  traverse(ast, {
    StringLiteral: function StringLiteral(path) {
      // case require('./b') and require('./b.js') were same
      if (path.parentPath.node.type === 'ImportDeclaration') {
        if (!path.node.value.match(/\.js[x]?$/)) {
          path.replaceWith(types.expressionStatement(types.stringLiteral(path.node.value + '.js'))); // early return, traverse from the start of replaced part again

          return;
        }

        dependencies.push(path.node.value);
      }
    }
  });
  return dependencies;
};

exports.analysis = analysis;

var cycle = function cycle(file, dependenciesM) {
  var fn = function fn(arr, file, dependenciesM) {
    var dependencies = dependenciesM[file] || [];
    return dependencies.reduce(function (acc, x) {
      if (arr.indexOf(x) > -1) {
        var idx = arr.indexOf(x);
        return _toConsumableArray(acc).concat([_toConsumableArray(arr.slice(idx)).concat([x])]);
      }

      var n = fn(_toConsumableArray(arr).concat([x]), x, dependenciesM);

      if (n.length) {
        return _toConsumableArray(acc).concat(_toConsumableArray(n));
      }

      return acc;
    }, []);
  };

  return fn([file], file, dependenciesM);
};

exports.cycle = cycle;

var generate = function generate(entry, codesM) {
  var moduels = Object.keys(codesM);
  var arr = moduels.map(function (x) {
    var code = codesM[x];
    return "\"".concat(x, "\": (function (module, exports, require) {\n    ").concat(code, "\n  })");
  });
  var str = arr.join(',\n');
  return "(function (modules) {\n    var installedModules = {};\n\n    function __webpack_require__(moduleId) {\n      if (installedModules[moduleId]) {\n        return installedModules[moduleId].exports;\n      }\n\n      var module = installedModules[moduleId] = {\n        i: moduleId,\n        l: false,\n        exports: {}\n      };\n\n      modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);\n      // Flag the module as loaded\n      module.l = true;\n      // Return the exports of the module\n      return module.exports;\n    }\n\n    // expose the modules object (__webpack_modules__)\n    __webpack_require__.m = modules;\n    // expose the module cache\n    __webpack_require__.c = installedModules;\n    // define getter function for harmony exports\n    __webpack_require__.d = function (exports, name, getter) {\n      if (!__webpack_require__.o(exports, name)) {\n        Object.defineProperty(exports, name, {enumerable: true, get: getter});\n      }\n    };\n    // define __esModule on exports\n    __webpack_require__.r = function (exports) {\n      if (typeof Symbol !== 'undefined' && Symbol.toStringTag) {\n        Object.defineProperty(exports, Symbol.toStringTag, {value: 'Module'});\n      }\n      Object.defineProperty(exports, '__esModule', {value: true});\n    };\n    // create a fake namespace object\n    // mode & 1: value is a module id, require it\n    // mode & 2: merge all properties of value into the ns\n    // mode & 4: return value when already ns object\n    // mode & 8|1: behave like require\n    __webpack_require__.t = function (value, mode) {\n      /******/\n      if (mode & 1) value = __webpack_require__(value);\n      if (mode & 8) return value;\n      if ((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;\n      var ns = Object.create(null);\n      __webpack_require__.r(ns);\n      Object.defineProperty(ns, 'default', {enumerable: true, value: value});\n      if (mode & 2 && typeof value != 'string') for (var key in value) __webpack_require__.d(ns, key, function (key) {\n        return value[key];\n      }.bind(null, key));\n      return ns;\n    };\n    // getDefaultExport function for compatibility with non-harmony modules\n    __webpack_require__.n = function (module) {\n      var getter = module && module.__esModule ?\n        function getDefault() {\n          return module['default'];\n        } :\n        function getModuleExports() {\n          return module;\n        };\n      __webpack_require__.d(getter, 'a', getter);\n      return getter;\n    };\n    // Object.prototype.hasOwnProperty.call\n    __webpack_require__.o = function (object, property) {\n      return Object.prototype.hasOwnProperty.call(object, property);\n    };\n    // __webpack_public_path__\n    __webpack_require__.p = \"\";\n    // Load entry module and return exports\n    return __webpack_require__(__webpack_require__.s = '".concat(entry, "');\n  })({\n   ").concat(str, "\n  });\n  ");
};

exports.generate = generate;

var webpack = function webpack(options, done) {
  var entry = options.entry,
      output = options.output;
  flow(entry, function (err, dependenciesM, codesM) {
    if (err) {
      return done(Error('flow error: ' + err.message));
    }

    fs.writeFile(output, generate(entry, codesM), function (err) {
      if (err) {
        return done(Error('write file error: ' + err.message));
      }

      done();
    });
  });
};

var _default = webpack;
exports.default = _default;