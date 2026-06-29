const fs = require('node:fs')
const path = require('node:path')

const envPath = path.join(process.cwd(), '.env.local')
const env = fs.readFileSync(envPath, 'utf8')
const keyLine = env.split(/\r?\n/).find((line) => line.startsWith('VITE_GEMINI_API_KEY='))
const key = keyLine?.replace('VITE_GEMINI_API_KEY=', '').trim()
console.log("Key loaded:", key ? `${key.substring(0, 8)}...` : "NO KEY");
if (!key) {
  console.error(JSON.stringify({ ok: false, error: 'VITE_GEMINI_API_KEY missing' }, null, 2))
  process.exit(1)
}

const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`

async function main() {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: 'Say "Hello from Gemini".' }],
        },
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 32,
      },
    }),
  })

  const bodyText = await response.text()
  let body
  try {
    body = JSON.parse(bodyText)
  } catch {
    body = bodyText
  }

  console.log(JSON.stringify({
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    body,
  }, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2))
  process.exit(1)
})
