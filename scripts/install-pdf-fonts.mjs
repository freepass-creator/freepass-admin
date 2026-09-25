import { copyFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const sourceDir = path.join(root, 'node_modules', 'pretendard', 'dist', 'web', 'static', 'woff2');
const targetDir = path.join(root, 'public', 'fonts');
const files = [
  'Pretendard-Regular.woff2',
  'Pretendard-Medium.woff2',
  'Pretendard-SemiBold.woff2',
  'Pretendard-Bold.woff2',
];

await mkdir(targetDir, { recursive: true });
for (const file of files) {
  const source = path.join(sourceDir, file);
  const target = path.join(targetDir, file);
  const info = await stat(source);
  if (!info.isFile() || info.size < 10_000) {
    throw new Error('Invalid Pretendard font asset: ' + file);
  }
  await copyFile(source, target);
}
