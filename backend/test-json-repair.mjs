import { validateAndRepairJSON } from './src/utils/jsonRepair.js';

const raw = `\`\`\`json
{
    "project_files": [
        {
            "name": "index.html",
            "content": "<!DOCTYPE html>\\n<html lang=\\"en\\">\\n<head>\\n    <meta charset=\\"UTF-8\\">\\n    <meta name=\\"viewport\\" content=\\"width=device-width, initial-scale=1.0\\">\\n    <title>Color Changing Button</title>\\n    <link rel=\\"stylesheet\\" href=\\"styles.css\\">\\n</head>\\n<body>\\n    <div class=\\"container\\">\\n        <h1>Color Changing Button</h1>\\n        <p>Click the button to change its color!</p>\\n        <button id=\\"colorButton\\" class=\\"button\\">Click Me!</button>\\n        <p class=\\"counter\\">Color changes: <span id=\\"changeCount\\">0</span></p>\\n    </div>\\n    <script src=\\"script.js\\"></script>\\n</body>\\n</html>"
        },
        {
            "name": "styles.css",
            "content": "body {\\n    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;\\n    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);\\n    margin: 0;\\n    padding: 0;\\n    display: flex;\\n    justify-content: center;\\n    align-items: center;\\n    min-height: 100vh;\\n}\\n\\n.container {\\n    background-color: rgba(255, 255, 255, 0.95);\\n    border-radius: 20px;\\n    padding: 40px;\\n    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);\\n    text-align: center;\\n    max-width: 500px;\\n    width: 90%;\\n}\\n\\nh1 {\\n    color: #333;\\n    margin-bottom: 10px;\\n    font-size: 2.5rem;\\n}\\n\\np {\\n    color: #666;\\n    font-size: 1.2rem;\\n    margin-bottom: 30px;\\n}\\n\\n.button {\\n    background-color: #4CAF50;\\n    border: none;\\n    color: white;\\n    padding: 20px 40px;\\n    text-align: center;\\n    text-decoration: none;\\n    display: inline-block;\\n    font-size: 1.5rem;\\n    font-weight: bold;\\n    margin: 20px 0;\\n    cursor: pointer;\\n    border-radius: 50px;\\n    transition: all 0.3s ease;\\n    box-shadow: 0 10px 20px rgba(76, 175, 80, 0.3);\\n}\\n\\n.button:hover {\\n    transform: translateY(-5px);\\n    box-shadow: 0 15px 30px rgba(76, 175, 80, 0.4);\\n}\\n\\n.button:active {\\n    transform: translateY(0);\\n    box-shadow: 0 5px 15px rgba(76, 175, 80, 0.3);\\n}\\n\\n.counter {\\n    font-size: 1.3rem;\\n    color: #333;\\n    margin-top: 30px;\\n    font-weight: bold;\\n}\\n\\n#changeCount {\\n    color: #4CAF50;\\n    font-size: 1.5rem;\\n}"
        },
        {
            "name": "script.js",
            "content": "document.addEventListener('DOMContentLoaded', function() {\\n    const colorButton = document.getElementById('colorButton');\\n    const changeCountElement = document.getElementById('changeCount');\\n    \\n    let changeCount = 0;\\n    \\n    const colors = [\\n        '#4CAF50', // Green\\n        '#2196F3', // Blue\\n        '#FF9800', // Orange\\n        '#9C27B0', // Purple\\n        '#F44336', // Red\\n        '#00BCD4', // Cyan\\n        '#FFC107', // Amber\\n        '#3F51B5', // Indigo\\n        '#E91E63', // Pink\\n        '#009688'  // Teal\\n    ];\\n    \\n    function getRandomColor() {\\n        const randomIndex = Math.floor(Math.random() * colors.length);\\n        return colors[randomIndex];\\n    }\\n    \\n    function changeButtonColor() {\\n        const newColor = getRandomColor();\\n        colorButton.style.backgroundColor = newColor;\\n        colorButton.style.boxShadow = \`0 10px 20px \${newColor}4D\`;\\n        \\n        changeCount++;\\n        changeCountElement.textContent = changeCount;\\n        \\n        colorButton.textContent = \`Changed \${changeCount} time\${changeCount !== 1 ? 's' : ''}\`;\\n    }\\n    \\n    colorButton.addEventListener('click', changeButtonColor);\\n});"
        }
    ],
    "metadata": {
        "language": "HTML/CSS/JS",
        "framework": "None"
    },
    "instructions": "1. Save all three files (index.html, styles.css, script.js) in the same folder\\n2. Open index.html in any modern web browser\\n3. Click the button to see it change colors\\n4. The counter will track how many times you've changed the color"
}
\`\`\``;

console.info('Testing validation...');
const result = validateAndRepairJSON(raw);
console.info('Result:', JSON.stringify(result, null, 2));