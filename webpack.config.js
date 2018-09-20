const path = require('path')

module.exports = {
  // mode: 'development',
  mode: 'production',
  entry: path.resolve(__dirname, './src'),
  target: 'node',
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        loader: 'babel-loader',
        exclude: ['node_modules']
      }
    ]
  },
  output: {
    filename: 'index.js'
  }
}
