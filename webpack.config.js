const path = require('path');
const webpack = require('webpack');
const dotenv = require('dotenv');

// .env 파일 로드
const envConfig = dotenv.config();
if (envConfig.error) {
  console.error('Error loading .env file:', envConfig.error);
  process.exit(1);
}

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('OPENAI_API_KEY not found in .env file');
  process.exit(1);
}

module.exports = {
  mode: 'production',
  entry: {
    background: './src/background/background.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    // Service Worker는 전역 스코프에서 실행되므로 모듈 시스템 불필요
    libraryTarget: 'self',
    chunkFormat: false,
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
          options: {
            // webpack용으로만 ES6 모듈 사용
            compilerOptions: {
              module: 'ES2020',
            },
          },
        },
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      '__OPENAI_API_KEY__': JSON.stringify(apiKey),
    }),
  ],
  target: 'webworker', // Chrome Service Worker용
  optimization: {
    minimize: false, // 디버깅을 위해 minify 끔
  },
};
