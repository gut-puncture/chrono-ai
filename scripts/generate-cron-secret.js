const crypto = require('crypto');

const secret = crypto.randomBytes(32).toString('hex');
console.log('\nGenerated CRON_SECRET:\n');
console.log(secret);
console.log('\nAdd this to your .env file and Vercel environment variables as CRON_SECRET\n');
