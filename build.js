const { execSync } = require('child_process');

console.log('Building Chrome Extension...');

// background.ts는 webpack으로 번들링 (OpenAI SDK 포함)
console.log('  - Bundling background.ts with webpack...');
execSync('npx webpack --config webpack.config.js', { stdio: 'inherit' });

// 나머지 파일들은 ES6로 컴파일 (브라우저 모듈용)
console.log('  - Compiling other files as ES6 modules...');
execSync('tsc sidepanel.ts content.ts --target ES2020 --module ES2020 --lib ES2020,DOM --outDir ./dist --esModuleInterop --skipLibCheck --moduleResolution node', { stdio: 'inherit' });

console.log('Build complete!');
