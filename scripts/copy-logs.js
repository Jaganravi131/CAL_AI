const fs = require('fs');
const path = require('path');

const srcPath = 'C:\\Users\\jagan babu.R\\.gemini\\antigravity\\brain\\5731ac47-3bc0-4761-a8a3-102cf9200fd0\\.system_generated\\logs\\transcript.jsonl';
const destPath = path.join(__dirname, '..', 'ai-logs', 'transcript.jsonl');

try {
  if (!fs.existsSync(srcPath)) {
    console.error('Source transcript file not found at:', srcPath);
    process.exit(1);
  }

  console.log('Reading raw transcript...');
  let content = fs.readFileSync(srcPath, 'utf8');
  
  console.log('Sanitizing sensitive secrets from transcript...');
  
  // 1. Redact Groq Key
  content = content.replace(/gsk_[a-zA-Z0-9]{40,}/g, 'gsk_REDACTED_SECRET_KEY');
  
  // 2. Redact OpenAI Key
  content = content.replace(/sk-proj-[a-zA-Z0-9_]{40,}/g, 'sk-proj-REDACTED_SECRET_KEY');
  content = content.replace(/sk-proj-[a-zA-Z0-9_]{100,}/g, 'sk-proj-REDACTED_SECRET_KEY');
  
  // 3. Redact Google Client ID
  content = content.replace(/[0-9]+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com/g, 'GOOGLE_CLIENT_ID_REDACTED');
  
  // 4. Redact Google Client Secret
  content = content.replace(/GOCSPX-[a-zA-Z0-9_-]{28}/g, 'GOOGLE_CLIENT_SECRET_REDACTED');
  
  // 5. Redact Supabase JWT Tokens
  content = content.replace(/eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, 'SUPABASE_JWT_REDACTED');

  console.log('Writing sanitized transcript to:', destPath);
  fs.writeFileSync(destPath, content, 'utf8');
  console.log('Logs copied and sanitized successfully.');
} catch (err) {
  console.error('Error processing logs:', err);
  process.exit(1);
}
