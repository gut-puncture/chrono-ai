const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Checking Google account tokens...');
  
  // Get all Google accounts
  const accounts = await prisma.account.findMany({
    where: {
      provider: 'google',
    },
    include: {
      user: true,
    },
  });
  
  console.log(`Found ${accounts.length} Google accounts`);
  
  // Check each account
  for (const account of accounts) {
    console.log(`\nUser: ${account.user.email || 'Unknown'}`);
    console.log(`Provider: ${account.provider}`);
    console.log(`Has access token: ${!!account.access_token}`);
    console.log(`Has refresh token: ${!!account.refresh_token}`);
    
    const expiryDate = account.expires_at 
      ? new Date(account.expires_at * 1000).toISOString()
      : 'Not set';
    
    console.log(`Token expires at: ${expiryDate}`);
    
    // Mark the token as expired
    const now = Math.floor(Date.now() / 1000);
    const oneHourAgo = now - 3600;
    
    await prisma.account.update({
      where: {
        id: account.id,
      },
      data: {
        expires_at: oneHourAgo,
      },
    });
    
    console.log(`Marked token as expired (set to 1 hour ago)`);
  }
  
  console.log('\nAll tokens have been marked as expired. Users will need to re-authenticate.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 