/**
 * Antigravity IDE Agent Simulator
 * Mimics an Antigravity Subagent analyzing the workspace and running through TokenGuard
 */

const http = require('http');

async function askAgent(taskDescription, contextCode) {
  console.log(`\n🤖 [Antigravity Agent] Executing Task: "${taskDescription}"`);
  
  const payload = JSON.stringify({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are Antigravity Coding Assistant. Analyze the codebase and fix any issues.'
      },
      {
        role: 'user',
        content: `Task: ${taskDescription}\n\nWorkspace Context:\n${contextCode}`
      }
    ]
  });

  return new Promise((resolve, reject) => {
    const req = http.request(
      'http://127.0.0.1:8080/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          const data = JSON.parse(body || '{}');
          const tokensSaved = res.headers['x-token-guard-tokens-saved'] || '0';
          const isCached = res.headers['x-token-guard-cached'] === 'true';

          console.log(`   ⚡ Status: ${isCached ? '🔥 INSTANT CACHE HIT (0ms)' : '✅ CLEANED & OPTIMIZED'}`);
          console.log(`   ✂️  Tokens Stripped: ${tokensSaved} tokens`);
          console.log(`   💡 Agent Response:\n      "${data.choices?.[0]?.message?.content?.split('\n')[0]}"\n`);
          resolve(data);
        });
      }
    );

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function run() {
  console.log('='.repeat(65));
  console.log('  🪐 TESTING ANTIGRAVITY IDE WORKSPACE WITH TOKENGUARD');
  console.log('='.repeat(65));

  // Round 1: Agent reads bloated code with node_modules errors
  const heavyContext = `
// File: src/components/PaymentModal.tsx
import React from 'react';



export function PaymentModal() {
  // TODO: Implement Stripe integration    
  return (
    <div>
      <h1>Checkout</h1>
    </div>
  );
}



// Build Error Log from Terminal:
\u001b[31m[ERROR]\u001b[39m Failed to load stripe SDK
    at node_modules/@stripe/stripe-js/dist/index.js:45:12
    at node_modules/@stripe/stripe-js/dist/index.js:46:12
    at node_modules/@stripe/stripe-js/dist/index.js:47:12
    at node_modules/@stripe/stripe-js/dist/index.js:48:12
    at node_modules/@stripe/stripe-js/dist/index.js:49:12
`;

  console.log('\n--- Round 1: Antigravity Subagent Scanning Workspace for Errors ---');
  await askAgent('Review PaymentModal and fix Stripe import error', heavyContext);

  // Round 2: Antigravity Subagent repeats the scan (Testing Cache)
  console.log('--- Round 2: Antigravity Subagent Re-verifying Code (Cache Check) ---');
  await askAgent('Review PaymentModal and fix Stripe import error', heavyContext);

  console.log('='.repeat(65));
  console.log('  🎉 Antigravity Agent Test Complete! Check http://localhost:8080/dashboard');
  console.log('='.repeat(65));
}

run().catch(console.error);
