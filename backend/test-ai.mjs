import axios from 'axios';

const JSON_ONLY_SYSTEM_PROMPT = `You are NEXUS_APEX_PRO, an expert AI coding system.

CRITICAL: You MUST respond with ONLY a single valid JSON object. No text before or after the JSON.

The JSON must have this EXACT structure:

{
  "project_files": [
    {"name":"index.html","content":"<complete HTML code here>"},
    {"name":"styles.css","content":"complete CSS code"},
    {"name":"script.js","content":"complete JavaScript code"}
  ],
  "metadata": {
    "language": "HTML/CSS/JS",
    "framework": "None"
  },
  "instructions": "How to run this project locally"
}

RULES:
- Output ONLY valid JSON (no markdown, no extra text, no code fences)
- Generate COMPLETE working code (no placeholders)
- NO comments like "// Rest of code..." or "// Add your code here"
- All files must be fully implemented
- Escape all special characters properly in JSON strings
- Use \\n for newlines in file content
- Use \\" for quotes inside strings
- Code should work on first run (95% success rate)
- Include ALL necessary files (package.json, config files, etc.)

For different stacks:
- HTML/CSS/JS: Complete standalone files
- React: Include package.json, App.tsx, index.html, vite.config.ts, etc.
- Node.js: Include package.json, server file, all route files
- Python: Include requirements.txt, complete app file, all modules

IMPORTANT: Validate your JSON output internally before responding. Ensure all quotes are escaped and structure is valid.`;

async function test() {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
        console.error('Missing DEEPSEEK_API_KEY. Set it in your environment (or .env) before running this test.');
        process.exit(1);
    }

    let baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
    baseUrl = baseUrl.replace(/\/+$/, '');
    if (!baseUrl.endsWith('/v1')) baseUrl = `${baseUrl}/v1`;

    const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
    const prompt = 'Create a simple HTML page with a button that changes color when clicked.';

    console.info('Testing AI provider...');
    console.info('Using API key:', apiKey.substring(0, 5) + '...');

    try {
        const response = await axios.post(
            `${baseUrl}/chat/completions`,
            {
                model: model,
                messages: [
                    { role: 'system', content: JSON_ONLY_SYSTEM_PROMPT },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 8000,
                stream: false
            },
            {
                timeout: 120000,
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const content = response.data.choices[0].message.content;
        console.info('Raw AI response:');
        console.info('---');
        console.info(content);
        console.info('---');

        // Try to parse JSON
        try {
            const parsed = JSON.parse(content);
            console.info('JSON parsed successfully');
            console.info('Keys:', Object.keys(parsed));
            if (parsed.project_files) {
                console.info(`Number of project files: ${parsed.project_files.length}`);
            }
        } catch (e) {
            console.error('JSON parse error:', e.message);
            // Try to extract JSON from text
            const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                console.info('Extracted JSON:', jsonMatch[0]);
                try {
                    const extracted = JSON.parse(jsonMatch[0]);
                    console.info('Extracted JSON parsed');
                } catch (e2) {
                    console.error('Extracted JSON also invalid');
                }
            }
        }
    } catch (error) {
        console.error('Request error:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

test();