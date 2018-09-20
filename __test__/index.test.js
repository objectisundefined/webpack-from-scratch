// import library
const { parse } = require('@babel/core')
const fs = require('fs')

import webpack, { analysis, cycle, generate, flow } from '../src'

describe('analysis works', () => {
  test('analysis should work on normal case', () => {
    const source = `
      import a from './a.js'
      import b from './b.js'
    `

    expect(analysis(parse(source))).toEqual(['./a.js', './b.js'])
  })

  test('analysis should work on no extesion cases', () => {
    const source = `
      import a from './a'
      import b from './b.js'
    `

    expect(analysis(parse(source))).toEqual(['./a.js', './b.js'])
  })
})

describe('cycle works', () => {
  test('cycle shoule work on no cycled case', () => {
    const dependenciesM = { './a.js': ['./b.js', './c.js'] }

    expect(cycle('./a.js', dependenciesM)).toEqual([])
  })

  test('cycle shoule work on directly cycled case', () => {
    const dependenciesM = { './a.js': ['./b.js'], './b.js': ['./a.js'] }

    expect(cycle('./a.js', dependenciesM)).toContainEqual(['./a.js', './b.js', './a.js'])
  })

  test('cycle shoule work on indirect cycled case', () => {
    const dependenciesM = { './a.js': ['./b.js'], './b.js': ['./c.js'], './c.js': ['./a.js'] }

    expect(cycle('./a.js', dependenciesM)).toContainEqual(['./a.js', './b.js', './c.js', './a.js'])
  })
})

describe('generate works', () => {
  test('generate should work on normal case', () => {
    const codesM = {
      './a.js': 'require(\'./b.js\')',
      './b.js': 'module.exports = \'b\''
    }

    const code = generate('./a.js', codesM)

    expect(() => parse(code)).not.toThrow()
  })
})

describe('flow works', () => {
  test('flow should work on readFile error case', () => {
    fs.readFile = (file, encoding, done) => {
      done(Error(file + ' not found'))
    }

    flow('./a.js', (err) => {
      expect(err).toBeInstanceOf(Error)
    })
  })

  test('flow should work on normal case', () => {
    const dependenciesM = {
      './a.js': ['./b.js', './c.js'],
      './b.js': ['./c.js', './d.js'],
      './c.js': [],
      './d.js': []
    }

    fs.readFile = (file, encoding, done) => {
      return done(null, dependenciesM[file].map(x => `import ${x.match(/\/(.*)?.js$/)[1]} from '${x}'`).join('\n') +
        `\nexport default '${file}'`
      )
    }

    flow('./a.js', (err) => {
      expect(err).toBe(null)
    })
  })

  test('flow should work on cycled analysis case', () => {
    const dependenciesM = { './a.js': ['./b.js'], './b.js': ['./c.js'], './c.js': ['./a.js'] }

    fs.readFile = (file, encoding, done) => {
      return done(null, dependenciesM[file].map(x => `import ${x.match(/\/(.*)?.js$/)[1]} from '${x}'`).join('\n') +
        `\nexport default '${file}'`
      )
    }

    flow('./a.js', (err) => {
      expect(err).toBeInstanceOf(Error)
    })
  })
})

describe('webpack works', () => {
  test('webpack should work on flow error case', () => {
    fs.readFile = (file, encoding, done) => {
      done(Error(file + ' not found'))
    }

    webpack({ entry: './a.js', output: './bundle.js' }, (err) => {
      expect(err).toBeInstanceOf(Error)
    })
  })

  test('webpack should work on writeFile error case', () => {
    const dependenciesM = {
      './a.js': []
    }

    fs.readFile = (file, encoding, done) => {
      return done(null, dependenciesM[file].map(x => `import ${x.match(/\/(.*)?.js$/)[1]} from '${x}'`).join('\n') +
        `\nexport default '${file}'`
      )
    }

    fs.writeFile = (file, data, done) => {
      return done(Error('write file error'))
    }

    webpack({ entry: './a.js', output: './bundle.js' }, (err) => {
      expect(err).toBeInstanceOf(Error)
    })
  })

  test('webpack should work on normal case', () => {
    const dependenciesM = {
      './a.js': ['./b.js', './c.js'],
      './b.js': ['./c.js', './d.js'],
      './c.js': [],
      './d.js': []
    }

    fs.readFile = (file, encoding, done) => {
      return done(null, dependenciesM[file].map(x => `import ${x.match(/\/(.*)?.js$/)[1]} from '${x}'`).join('\n') +
        `\nexport default '${file}'`
      )
    }

    let code

    fs.writeFile = (file, data, done) => {
      code = data
      done()
    }

    webpack({ entry: './d.js', output: './bundle.js' }, (err) => {
      expect(() => parse(code)).not.toThrow()
    })
  })
})
