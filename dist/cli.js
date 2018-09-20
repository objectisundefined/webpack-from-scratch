const { default: webpack } = require('./index.js')

const argv = process.argv.slice(2)

// node ./cli ./a.js --output bundle.js
// node ./cli a.js -o bundle.js

const entry = argv[0]

if (argv[1] !== '--output') {
  console.error('command: [entry] --output [output]')
  process.exit(1)
}

const output = argv[2]

const options = { entry, output }

webpack(options, (err) => {
  if (err) {
    return console.error(err)
  }

  console.log('completed')
})
