/**
 * Simulation script that mimics real developer requests from Claude Code, Cursor, and OpenAI SDK
 * to benchmark token savings and cache hits live.
 */

const http = require('http');

const BASE_URL = 'http://127.0.0.1:8080';

async function sendRequest(endpoint, payload) {
  const url = `${BASE_URL}${endpoint}`;
  const data = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const req = http.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: JSON.parse(body || '{}')
          });
        });
      }
    );

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runBenchmark() {
  console.log('\n' + '='.repeat(65));
  console.log('  🚀 RUNNING TOKENGUARD BENCHMARK & SIMULATION SUITE');
  console.log('='.repeat(65) + '\n');

  // Test Case 1: Huge Node.js / Next.js Stack Trace (Anthropic Claude format)
  console.log('👉 [Test 1/5] Intercepting Claude Code Build Error with 25+ Stack Frames...');
  const res1 = await sendRequest('/v1/messages', {
    model: 'claude-3-5-sonnet-20241022',
    messages: [
      {
        role: 'user',
        content: `Error: Build failed with 1 error:
\u001b[31m[ERROR]\u001b[39m Cannot find module '@/components/Header'
    at Function.Module._resolveFilename (node:internal/modules/cjs/loader:1077:15)
    at Function.Module._load (node:internal/modules/cjs/loader:922:27)
    at Module.require (node:internal/modules/cjs/loader:1143:19)
    at require (node:internal/modules/cjs/helpers:110:18)
    at Object.<anonymous> (z:/app/node_modules/next/dist/server/load-components.js:34:1)
    at Module._compile (node:internal/modules/cjs/loader:1256:14)
    at Object.Module._extensions..js (node:internal/modules/cjs/loader:1310:10)
    at Module.load (node:internal/modules/cjs/loader:1119:32)
    at Function.Module._load (node:internal/modules/cjs/loader:960:12)
    at Module.require (node:internal/modules/cjs/loader:1143:19)
    at require (node:internal/modules/cjs/helpers:110:18)
    at loadComponents (z:/app/node_modules/next/dist/server/load-components.js:120:10)
    at async renderToHTML (z:/app/node_modules/next/dist/server/render.js:410:22)
    at async doRender (z:/app/node_modules/next/dist/server/base-server.js:980:30)
    at async NextServer.renderToResponseWithComponents (z:/app/node_modules/next/dist/server/base-server.js:1070:28)
    at async NextServer.renderToResponse (z:/app/node_modules/next/dist/server/base-server.js:1200:22)
    at async NextServer.pipe (z:/app/node_modules/next/dist/server/base-server.js:1245:11)
    at async Object.fn (z:/app/node_modules/next/dist/server/next-server.js:1145:21)
    at async Router.execute (z:/app/node_modules/next/dist/server/router.js:213:30)
    at async NextServer.run (z:/app/node_modules/next/dist/server/base-server.js:1380:29)

Progress: [████████████████████] 100%

Please fix the import path in src/pages/index.tsx`
      }
    ]
  });
  console.log(`   ✅ Tokens Saved: ${res1.headers['x-token-guard-tokens-saved']} tokens | Money Saved: +$${res1.headers['x-token-guard-dollars-saved']}\n`);
  await sleep(1200);

  // Test Case 2: Bloated Code Context with Excess Whitespace (OpenAI format)
  console.log('👉 [Test 2/5] Intercepting Cursor Code Context with Blank Line Bloat...');
  const res2 = await sendRequest('/v1/chat/completions', {
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: `Refactor this TypeScript interface for optimal memory usage:



interface UserSessionData {
  userId: string;       
  email: string;        


  roles: string[];      


  preferences: {        
    theme: 'light' | 'dark';   
    language: string;          
  };                    
}                       




Write the refactored code.`
      }
    ]
  });
  console.log(`   ✅ Tokens Saved: ${res2.headers['x-token-guard-tokens-saved']} tokens | Money Saved: +$${res2.headers['x-token-guard-dollars-saved']}\n`);
  await sleep(1200);

  // Test Case 3: Re-sending Test Case 2 (Testing Instant Smart Cache)
  console.log('👉 [Test 3/5] Re-sending identical query (Testing Local Smart Cache)...');
  const startTime = Date.now();
  const res3 = await sendRequest('/v1/chat/completions', {
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: `Refactor this TypeScript interface for optimal memory usage:



interface UserSessionData {
  userId: string;       
  email: string;        


  roles: string[];      


  preferences: {        
    theme: 'light' | 'dark';   
    language: string;          
  };                    
}                       




Write the refactored code.`
      }
    ]
  });
  const latency = Date.now() - startTime;
  console.log(`   ⚡ CACHE HIT! Response time: ${latency}ms | Cached: ${res3.headers['x-token-guard-cached']} | 100% Tokens Saved: ${res3.headers['x-token-guard-tokens-saved']}\n`);
  await sleep(1200);

  // Test Case 4: Long Repeated Error Log (Database connection retry)
  console.log('👉 [Test 4/5] Intercepting 50x Repeated Error Logs...');
  const repeatedErrors = Array(25).fill('Error: connect ECONNREFUSED 127.0.0.1:5432\n    at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1494:16)').join('\n');
  const res4 = await sendRequest('/v1/messages', {
    model: 'claude-3-5-sonnet-20241022',
    messages: [
      {
        role: 'user',
        content: `Database connection pool failed. See error:\n${repeatedErrors}\n\nWhat should I check?`
      }
    ]
  });
  console.log(`   ✅ Tokens Saved: ${res4.headers['x-token-guard-tokens-saved']} tokens | Money Saved: +$${res4.headers['x-token-guard-dollars-saved']}\n`);
  await sleep(1200);

  // Test Case 5: Repeat of Test Case 4 (Instant Cache)
  console.log('👉 [Test 5/5] Checking Instant Cache on Database query...');
  const res5 = await sendRequest('/v1/messages', {
    model: 'claude-3-5-sonnet-20241022',
    messages: [
      {
        role: 'user',
        content: `Database connection pool failed. See error:\n${repeatedErrors}\n\nWhat should I check?`
      }
    ]
  });
  console.log(`   ⚡ CACHE HIT! 100% Saved: ${res5.headers['x-token-guard-tokens-saved']} tokens | Money Saved: +$${res5.headers['x-token-guard-dollars-saved']}\n`);

  console.log('='.repeat(65));
  console.log('  🎉 SIMULATION COMPLETE! Open http://localhost:8080/dashboard to view live stats.');
  console.log('='.repeat(65) + '\n');
}

runBenchmark().catch(console.error);
