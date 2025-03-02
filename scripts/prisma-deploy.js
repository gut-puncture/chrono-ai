const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function prismaDeploy() {
  try {
    console.log('Starting Prisma deployment...');
    
    try {
      // First try a normal deploy
      console.log('Attempting normal migration...');
      await execAsync('npx prisma migrate deploy');
      console.log('Migration successful!');
      return;
    } catch (error) {
      console.log('Normal migration failed. Error:', error.message);
      
      // Check if it's a unique constraint issue with messageId
      if (error.message.includes('messageId') && error.message.includes('unique constraint')) {
        console.log('Detected messageId unique constraint issue. Cleaning up...');
        
        // Find and log duplicates
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        
        // Find all messageIds that appear more than once
        const duplicateMessageIds = await prisma.$queryRaw`
          SELECT "messageId", COUNT(*) as count
          FROM "Email"
          GROUP BY "messageId"
          HAVING COUNT(*) > 1
        `;
        
        console.log(`Found ${duplicateMessageIds.length} messageIds with duplicates.`);
        
        if (duplicateMessageIds.length > 0) {
          // For each duplicate messageId, keep the most recent one and delete the others
          for (const dup of duplicateMessageIds) {
            const messageId = dup.messageId;
            console.log(`Processing duplicate messageId: ${messageId}`);
            
            // Get all emails with this messageId
            const emails = await prisma.email.findMany({
              where: { messageId },
              orderBy: { date: 'desc' }, // Order by date, most recent first
            });
            
            // Keep the most recent one (index 0) and delete the rest
            if (emails.length > 1) {
              const idsToDelete = emails.slice(1).map(email => email.id);
              
              // Delete the duplicates
              await prisma.email.deleteMany({
                where: {
                  id: { in: idsToDelete }
                }
              });
              
              console.log(`Deleted ${idsToDelete.length} duplicate emails`);
            }
          }
          
          await prisma.$disconnect();
        }
        
        // Now try migration with --accept-data-loss flag
        console.log('Running migration with --accept-data-loss flag...');
        await execAsync('npx prisma migrate deploy --accept-data-loss');
        console.log('Migration with --accept-data-loss successful!');
      } else {
        // If it's not a messageId issue, re-throw the error
        throw error;
      }
    }
  } catch (error) {
    console.error('Prisma deployment failed:', error.message);
    process.exit(1);
  }
}

prismaDeploy(); 