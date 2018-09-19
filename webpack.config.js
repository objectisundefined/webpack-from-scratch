const path = require('path')

module.exports = {
  // mode: 'development',
  mode: 'production',
  entry: path.resolve(__dirname, './src/a.js'),
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
    path: path.resolve(__dirname, './dist'),
    filename: 'fun.js',
    library: 'fun',
    libraryTarget: 'umd'
  }
}
