const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// dist 디렉토리 정리
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true, force: true });
}
fs.mkdirSync('dist', { recursive: true });

// background.ts는 webpack으로 번들링 (OpenAI SDK 포함)
execSync('npx webpack --config webpack.config.js', { stdio: 'inherit' });

// 나머지 파일들은 ES6로 컴파일 (브라우저 모듈용)
execSync('npx tsc', { stdio: 'inherit' });

// public/ 디렉토리를 dist/로 복사
function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

copyRecursiveSync('public', 'dist');

// sidepanel.html과 sidepanel.css를 dist로 복사
fs.copyFileSync('src/sidepanel/sidepanel.html', 'dist/sidepanel.html');
fs.copyFileSync('src/sidepanel/sidepanel.css', 'dist/sidepanel.css');