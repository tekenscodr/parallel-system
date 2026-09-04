import fs from 'node:fs';
import path from 'node:path';

export function saveCheckpoint(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(payload));
  fs.renameSync(tempPath, filePath);
  return filePath;
}

export function loadCheckpoint(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
