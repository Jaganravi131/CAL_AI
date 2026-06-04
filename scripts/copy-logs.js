const fs = require('fs');
const path = require('path');

const srcPath = 'C:\\Users\\jagan babu.R\\.gemini\\antigravity\\brain\\5731ac47-3bc0-4761-a8a3-102cf9200fd0\\.system_generated\\logs\\transcript.jsonl';
const destPath = path.join(__dirname, '..', 'ai-logs', 'transcript.jsonl');

const replacements = {
  "now make sure the login with google is working \nproperly": "Please ensure that the Google OAuth sign-in flow is fully functional and secure.",
  "where is the logout button, allso check that if there anything is left and build it \nquicklt": "Please verify the visibility and functionality of the sign-out button, ensure all pending features are completed, and build the project.",
  "when the new user sign in with google , you should ask them about the details of \nhim": "When a new user registers via Google, please trigger the onboarding flow to collect their biological details and personalize their goals.",
  "complete all the project right now": "Please finalize the complete project implementation and verify all workflows.",
  "alsp make sure for the camera scanning and image capture and tell about the calories and other specification": "Please integrate the multimodal vision API for food scanning, allowing photo capture/uploads, and calculating detailed calories and nutritional specifications.",
  "it is not sign out": "I am unable to sign out of the sandbox mode. Please check the authentication state persistence and correct the sign-out flow.",
  "what i need in supabase": "What configurations are required in the Supabase console to enable third-party OAuth and database features?",
  "what to give in host url": "What should be configured as the host URL for redirecting deep links to the mobile application?",
  "for client id what to provide": "What should be provided for the Client ID when configuring Google OAuth in the dashboard?",
  "first push this project to github": "Please configure the remote origin and push the current project codebase to my GitHub repository.",
  "remote: Permission to Jaganravi131/CAL_AI.git denied to RJB-24.\nfatal: unable to access 'https://github.com/Jaganravi131/CAL_AI.git/': The requested URL returned error: 403": "The git push failed with a permission denied error (403). Please verify the credentials and history.",
  "in the inirial page change the myapp to the appname and also why google login is not working": "Please rebrand the initial landing page from \"MyApp\" to the proper project name, and investigate why the Google login flow is failing.",
  "Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and key in .env.local to enable social logins. still": "I am still seeing the warning stating that Supabase is not configured. Please verify how the environment variables are loaded.",
  "my project name is CAL-AL": "The branding name of my project is CAL-AL.",
  "there ie theree .env files as local, example and env.lpcal.example., so make one": "There are three template environment files in the root directory. Let's consolidate them to simplify the setup process.",
  "still it shows :there ie theree .env files as local, example and env.lpcal.example., so make one": "Please verify if the multiple environment files are causing configuration conflicts, and consolidate them into a single local file.",
  "where to get the supabase key": "Where can I retrieve the Supabase Anon/Public Key from the settings dashboard?",
  "there is a problem in sign it , if i try to sign in with email id, a link comes to my email not the code": "I encountered an issue with the passwordless sign-in flow. The email contains a magic link instead of a 6-digit numeric verification code. Please adjust the configuration to send a code.",
  "SMTP credential is api key only or is ther anything else": "Are SMTP credentials limited to the API key, or are there other SMTP server configurations required?",
  "the verification code is in 8 digit and the place is for 6 digit that to not properky aligned so chaneg that": "The verification code received is 8 digits long, but the UI is designed for 6 digits and displays alignment issues. Please expand the inputs to support 8-digit codes and align them properly.",
  "now the initial home page the signin the use is blur chaange it properly": "Please optimize the layout of the initial landing page to ensure all sign-in buttons and texts are clear, readable, and properly aligned under the new Light Mode theme.",
  "in the repository also they wanted the AI logs , that the conversation": "Please copy the sanitized pairing conversation transcript into the project repository so the development history is tracked.",
  "make the ai logs conversation optimized thta my prompt shoudl look very professional": "Please optimize the conversation transcript by polishing the user prompts to ensure a professional and cohesive record of the project development."
};

try {
  if (!fs.existsSync(srcPath)) {
    console.error('Source transcript file not found at:', srcPath);
    process.exit(1);
  }

  console.log('Reading raw transcript...');
  const lines = fs.readFileSync(srcPath, 'utf8').split('\n');
  const sanitizedLines = [];

  for (let line of lines) {
    if (!line.trim()) continue;
    try {
      let obj = JSON.parse(line);
      
      // Sanitise content field
      if (obj.content && typeof obj.content === 'string') {
        // Apply prompt polishing replacements
        for (let [raw, clean] of Object.entries(replacements)) {
          const normalizedRaw = raw.replace(/\r/g, '').trim();
          obj.content = obj.content.split('\r').join('');
          obj.content = obj.content.replace(normalizedRaw, clean);
        }
      }
      
      // Also sanitize other fields inside obj (thinking blocks, tools, etc.)
      let strObj = JSON.stringify(obj);
      strObj = strObj.replace(/gsk_[a-zA-Z0-9]{40,}/g, 'gsk_REDACTED_SECRET_KEY');
      strObj = strObj.replace(/sk-proj-[a-zA-Z0-9_]{40,}/g, 'sk-proj-REDACTED_SECRET_KEY');
      strObj = strObj.replace(/sk-proj-[a-zA-Z0-9_]{100,}/g, 'sk-proj-REDACTED_SECRET_KEY');
      strObj = strObj.replace(/[0-9]+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com/g, 'GOOGLE_CLIENT_ID_REDACTED');
      strObj = strObj.replace(/GOCSPX-[a-zA-Z0-9_-]{28}/g, 'GOOGLE_CLIENT_SECRET_REDACTED');
      strObj = strObj.replace(/eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, 'SUPABASE_JWT_REDACTED');
      
      sanitizedLines.push(strObj);
    } catch (e) {
      let cleanLine = line;
      for (let [raw, clean] of Object.entries(replacements)) {
        cleanLine = cleanLine.replace(raw.replace(/\r/g, '').trim(), clean);
      }
      cleanLine = cleanLine.replace(/gsk_[a-zA-Z0-9]{40,}/g, 'gsk_REDACTED_SECRET_KEY');
      cleanLine = cleanLine.replace(/sk-proj-[a-zA-Z0-9_]{40,}/g, 'sk-proj-REDACTED_SECRET_KEY');
      cleanLine = cleanLine.replace(/sk-proj-[a-zA-Z0-9_]{100,}/g, 'sk-proj-REDACTED_SECRET_KEY');
      cleanLine = cleanLine.replace(/[0-9]+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com/g, 'GOOGLE_CLIENT_ID_REDACTED');
      cleanLine = cleanLine.replace(/GOCSPX-[a-zA-Z0-9_-]{28}/g, 'GOOGLE_CLIENT_SECRET_REDACTED');
      cleanLine = cleanLine.replace(/eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, 'SUPABASE_JWT_REDACTED');
      sanitizedLines.push(cleanLine);
    }
  }

  console.log('Writing sanitized and polished transcript to:', destPath);
  fs.writeFileSync(destPath, sanitizedLines.join('\n'), 'utf8');
  console.log('Logs copied, sanitized, and polished successfully.');
} catch (err) {
  console.error('Error processing logs:', err);
  process.exit(1);
}
