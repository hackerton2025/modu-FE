const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
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

console.log('Building TypeScript files...');

// background.ts는 CommonJS로 컴파일 (Service Worker용)
console.log('  - Compiling background.ts as CommonJS...');
execSync('tsc background.ts --target ES2020 --module CommonJS --lib ES2020,DOM --outDir ./dist --esModuleInterop --skipLibCheck', { stdio: 'inherit' });

// 나머지 파일들은 ES6로 컴파일 (브라우저 모듈용)
console.log('  - Compiling other files as ES6 modules...');
execSync('tsc sidepanel.ts content.ts --target ES2020 --module ES2020 --lib ES2020,DOM --outDir ./dist --esModuleInterop --skipLibCheck --moduleResolution node', { stdio: 'inherit' });

console.log('Injecting API key into background.js...');
const backgroundPath = path.join(__dirname, 'dist', 'background.js');
let content = fs.readFileSync(backgroundPath, 'utf8');

// API 키 플레이스홀더를 실제 값으로 교체
content = content.replace(
  /'__OPENAI_API_KEY_PLACEHOLDER__'/g,
  `'${apiKey}'`
);

fs.writeFileSync(backgroundPath, content, 'utf8');
console.log('Build complete!');
