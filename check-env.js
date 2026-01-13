// Check environment variables for debugging
require('dotenv').config();

console.log('🔍 Environment Variables Check\n');
console.log('CSB_API_KEY:');
console.log('- Value exists:', !!process.env.CSB_API_KEY);
console.log('- Length:', process.env.CSB_API_KEY?.length || 0);
console.log('- Starts with csb_v1:', process.env.CSB_API_KEY?.startsWith('csb_v1'));
console.log('- First 10 chars:', process.env.CSB_API_KEY?.slice(0, 10) + '...');
console.log('- Last 4 chars:', '...' + process.env.CSB_API_KEY?.slice(-4));

// Check for common issues
const key = process.env.CSB_API_KEY;
if (!key) {
  console.log('\n❌ ERROR: CSB_API_KEY is not set');
} else if (key.includes('REPLACE_ME')) {
  console.log('\n❌ ERROR: CSB_API_KEY contains placeholder text');
} else if (key.length < 20) {
  console.log('\n❌ ERROR: CSB_API_KEY is too short');
} else if (!key.startsWith('csb_v1')) {
  console.log('\n⚠️ WARNING: CSB_API_KEY should start with csb_v1');
} else {
  console.log('\n✅ CSB_API_KEY appears to be valid');
}

console.log('\n📋 Other relevant env vars:');
console.log('- PREVIEW_PROVIDER:', process.env.PREVIEW_PROVIDER);
console.log('- PORT:', process.env.PORT || 3001);
console.log('- NODE_ENV:', process.env.NODE_ENV || 'development');
