import dotenv from 'dotenv';
import { createServer } from './server';
import { statsStore } from './state/statsStore';

dotenv.config();

const PORT = parseInt(process.env.PORT || '8080', 10);
const app = createServer();

app.listen(PORT, () => {
  console.log('\n' + '='.repeat(65));
  console.log('  🛡️  LOCAL AI TOKEN OPTIMIZER (TokenGuard MVP)  ');
  console.log('='.repeat(65));
  console.log(`\n  🟢 Local Proxy Active on:  http://localhost:${PORT}`);
  console.log(`  📊 Web Dashboard URL:      http://localhost:${PORT}/dashboard`);
  console.log('\n  ⚡ QUICK SETUP GUIDE FOR YOUR TOOLS:');
  console.log('  -------------------------------------------------------------');
  console.log('  1. Claude Code CLI:');
  console.log(`     export ANTHROPIC_BASE_URL="http://localhost:${PORT}"`);
  console.log('     claude\n');
  console.log('  2. Cursor / Antigravity / Cline IDE:');
  console.log(`     Base URL: http://localhost:${PORT}/v1`);
  console.log('     API Key:  (Any string / Your OpenAI Key)\n');
  console.log('  3. Python / Node.js OpenAI SDK:');
  console.log(`     client = OpenAI(base_url="http://localhost:${PORT}/v1")`);
  console.log('  -------------------------------------------------------------');
  console.log('  💡 Live Dashboard listening for incoming AI requests...\n');
});
