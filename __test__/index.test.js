// import library
const { parse } = require('@babel/core')
const fs = require('fs')

import { analysis, cycle, generate, flow } from '../src'

describe('library works', () => {
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

describe('cycle shoule work', () => {
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

describe('generate should work', () => {
  test('generate should work on normal case', () => {
    const codesM = {
      './a.js': 'require(\'./b.js\')',
      './b.js': 'module.exports = \'b\''
    }

    const code = generate('./a.js', Object.entries(codesM))

    expect(() => parse(code)).not.toThrow()
  })

  test('generate should work when receive none [string, string] tuple', () => {
    const code = generate('./a.js', Object.entries({ './a.js': {} }))

    expect(() => parse(code)).not.toThrow()
  })
})

describe('flow should work', () => {
  test('flow should work on readFile error case', () => {
    fs.readFile = jest.fn((file, encoding, done) => {
      done(Error(file + ' not found'))
    })

    flow('./d.js', {}, {}, (err) => {
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

    flow('./a.js', {}, {}, (err) => {
      expect(err).toBe(null)
    })
  })

  test('flow should work on cycled analysis case', () => {
    const dependenciesM = { './a.js': ['./b.js'], './b.js': ['./c.js'], './c.js': ['./a.js'] }

    fs.readFile = (file, encoding, done) => {
      return dependenciesM[file].map(x => `import ${x.match(/\/(.*)?.js$/)[1]} from ${file}}`).join('\n') +
        `\nexport default '${file}'`
    }

    flow('./a.js', {}, {}, (err) => {
      expect(err).toBeInstanceOf(err)
    })
  })
})

// describe('webpack shoule work', () => {})
