const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '.vercel/output/static/_worker.js');
console.log('Target path for fixing imports:', targetPath);

if (!fs.existsSync(targetPath)) {
  console.error('Error: target path does not exist. Run next-on-pages build first.');
  process.exit(1);
}

function processFile(filePath) {
  if (filePath.endsWith('.js')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    // Replace imports from "async_hooks" to "node:async_hooks"
    content = content.replace(/(from|import)\s*['"]async_hooks['"]/g, '$1 "node:async_hooks"');
    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Fixed:', filePath);
    }
  }
}

function walkDir(dir) {
  fs.readdirSync(dir).forEach(f => {
    let childPath = path.join(dir, f);
    let isDirectory = fs.statSync(childPath).isDirectory();
    if (isDirectory) {
      walkDir(childPath);
    } else {
      processFile(childPath);
    }
  });
}

if (fs.statSync(targetPath).isDirectory()) {
  walkDir(targetPath);
} else {
  processFile(targetPath);
}

console.log('Import fixing complete.');
