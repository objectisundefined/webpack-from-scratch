// @flow

const fs = require('fs')

type DependenciesM = { [string]: string[] }
type CodesM = { [string]: string }
type CompleteCall = (err: Error | null, dependenciesM: DependenciesM, codesM: CodesM) => void
type Options = { entry: string, output: string }

const { parse, transformFromAst, traverse, types } = require('@babel/core')

export const flow = (entry: string, done: CompleteCall) => {
  const fn = (file: string, dependenciesM: DependenciesM, codesM: CodesM, done: CompleteCall) => {
    fs.readFile(file, 'utf-8', (err, res) => {
      if (err) {
        return done(Error('read file err: ' + err.message), {}, {})
      }

      // parse
      const ast = parse(res, {
        sourceType: 'module'
      })

      const dependencies = analysis(ast)

      dependenciesM[file] = dependencies

      // analysis
      const cycled = cycle(entry, dependenciesM)

      if (cycled.length) {
        return done(Error('cycle dependency: ' + cycled.map(x => x.join(' -> ')).join(' & ')), {}, {})
      }

      // transform
      // this should be done after analysis
      // because extname maybe have been appended
      const { code } = transformFromAst(ast, null, {
        presets: ['@babel/preset-env']
      })

      codesM[file] = code

      const l = dependencies.length

      const next = i => {
        if (i === l) {
          return done(null, dependenciesM, codesM)
        }

        if (codesM[dependencies[i]]) {
          return next(i + 1)
        }

        fn(dependencies[i], dependenciesM, codesM, (err) => {
          if (err) {
            return done(err, {}, {})
          }

          next(i + 1)
        })
      }

      next(0)
    })
  }

  return fn(entry, {}, {}, done)
}

export const analysis = ast => {
  const dependencies = []

  traverse(ast, {
    StringLiteral: (path) => {
      // case require('./b') and require('./b.js') were same
      if (path.parentPath.node.type === 'ImportDeclaration') {
        if (!path.node.value.match(/\.js[x]?$/)) {
          path.replaceWith(types.expressionStatement(types.stringLiteral(path.node.value + '.js')))

          // early return, traverse from the start of replaced part again
          return
        }

        dependencies.push(path.node.value)
      }
    }
  })

  return dependencies
}

export const cycle = (file: string, dependenciesM: DependenciesM) => {
  const fn = (arr, file, dependenciesM) => {
    const dependencies = dependenciesM[file] || []

    return dependencies.reduce((acc, x) => {
      if (arr.indexOf(x) > -1) {
        const idx = arr.indexOf(x)

        return [...acc, [...arr.slice(idx), x]]
      }

      const n = fn([...arr, x], x, dependenciesM)

      if (n.length) {
        return [...acc, ...n]
      }

      return acc
    }, [])
  }

  return fn([file], file, dependenciesM)
}

export const generate = (entry: string, codesM: CodesM) => {
  const moduels = Object.keys(codesM)

  const arr = moduels.map(x => {
    let code = codesM[x]

    return `"${x}": (function (module, exports, require) {
    ${code}
  })`})

  const str = arr.join(',\n')

  return (`(function (modules) {
    var installedModules = {};

    function __webpack_require__(moduleId) {
      if (installedModules[moduleId]) {
        return installedModules[moduleId].exports;
      }

      var module = installedModules[moduleId] = {
        i: moduleId,
        l: false,
        exports: {}
      };

      modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
      // Flag the module as loaded
      module.l = true;
      // Return the exports of the module
      return module.exports;
    }

    // expose the modules object (__webpack_modules__)
    __webpack_require__.m = modules;
    // expose the module cache
    __webpack_require__.c = installedModules;
    // define getter function for harmony exports
    __webpack_require__.d = function (exports, name, getter) {
      if (!__webpack_require__.o(exports, name)) {
        Object.defineProperty(exports, name, {enumerable: true, get: getter});
      }
    };
    // define __esModule on exports
    __webpack_require__.r = function (exports) {
      if (typeof Symbol !== 'undefined' && Symbol.toStringTag) {
        Object.defineProperty(exports, Symbol.toStringTag, {value: 'Module'});
      }
      Object.defineProperty(exports, '__esModule', {value: true});
    };
    // create a fake namespace object
    // mode & 1: value is a module id, require it
    // mode & 2: merge all properties of value into the ns
    // mode & 4: return value when already ns object
    // mode & 8|1: behave like require
    __webpack_require__.t = function (value, mode) {
      /******/
      if (mode & 1) value = __webpack_require__(value);
      if (mode & 8) return value;
      if ((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
      var ns = Object.create(null);
      __webpack_require__.r(ns);
      Object.defineProperty(ns, 'default', {enumerable: true, value: value});
      if (mode & 2 && typeof value != 'string') for (var key in value) __webpack_require__.d(ns, key, function (key) {
        return value[key];
      }.bind(null, key));
      return ns;
    };
    // getDefaultExport function for compatibility with non-harmony modules
    __webpack_require__.n = function (module) {
      var getter = module && module.__esModule ?
        function getDefault() {
          return module['default'];
        } :
        function getModuleExports() {
          return module;
        };
      __webpack_require__.d(getter, 'a', getter);
      return getter;
    };
    // Object.prototype.hasOwnProperty.call
    __webpack_require__.o = function (object, property) {
      return Object.prototype.hasOwnProperty.call(object, property);
    };
    // __webpack_public_path__
    __webpack_require__.p = "";
    // Load entry module and return exports
    return __webpack_require__(__webpack_require__.s = '${entry}');
  })({
   ${str}
  });
  `)
}

const webpack = (options: Options, done: (err?: Error) => void) => {
  const { entry, output } = options

  flow(entry, (err, dependenciesM, codesM) => {
    if (err) {
      return done(Error('flow error: ' + err.message))
    }

    fs.writeFile(output, generate(entry, codesM), (err) => {
      if (err) {
        return done(Error('write file error: ' + err.message))
      }

      done()
    })
  })
}

export default webpack
