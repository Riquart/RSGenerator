const fs = require('fs');
const path = require('path');

const file = '.next/standalone/server.js';
if (!fs.existsSync(file)) {
  console.error(`Error: Standalone server file not found at ${file}`);
  process.exit(1);
}

console.log(`Patching ${file}...`);
let content = fs.readFileSync(file, 'utf8');

// Prepend environment logging logic to the very top of server.js
const prependCode = `
try {
  const fs = require('fs');
  const path = require('path');
  fs.writeFileSync(path.join(__dirname, 'debug_env.log'), JSON.stringify({
    date: new Date().toISOString(),
    env: {
      PORT: process.env.PORT,
      NODE_ENV: process.env.NODE_ENV,
      NODE_OPTIONS: process.env.NODE_OPTIONS,
      PATH: process.env.PATH,
      PassengerAppRoot: process.env.PassengerAppRoot
    },
    argv: process.argv
  }, null, 2) + '\\n', { flag: 'a' });
} catch (e) {}
`;

content = prependCode + content;

// Patch server.js to support Passenger Unix domain socket routing
const targetString = 'const currentPort = parseInt(process.env.PORT, 10) || 3000';
const replacementString = 'const currentPort = process.env.PORT && isNaN(process.env.PORT) ? process.env.PORT : (parseInt(process.env.PORT, 10) || 3000)';

if (content.includes(targetString)) {
  content = content.replace(targetString, replacementString);
  console.log('Successfully replaced port binding logic.');
} else {
  console.warn('Warning: Could not find target port binding string to replace. It might be already patched or Next.js changed format.');
}

fs.writeFileSync(file, content, 'utf8');
console.log('Patch complete.');
