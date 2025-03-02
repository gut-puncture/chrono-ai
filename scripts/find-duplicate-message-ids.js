const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findDuplicateMessageIds() {
  try {
    // Find all messageIds that appear more than once
    const duplicateMessageIds = await prisma.$queryRaw`
      SELECT "messageId", COUNT(*) as count
      FROM "Email"
      GROUP BY "messageId"
      HAVING COUNT(*) > 1
    `;
    
    console.log('Duplicate messageIds:');
    console.log(duplicateMessageIds);
    
    if (duplicateMessageIds.length === 0) {
      console.log('No duplicate messageIds found. It should be safe to add the unique constraint.');
    } else {
      console.log(`Found ${duplicateMessageIds.length} messageIds with duplicates.`);
      
      // For each duplicate messageId, get the full records
      for (const dup of duplicateMessageIds) {
        const emails = await prisma.email.findMany({
          where: { messageId: dup.messageId },
        });
        
        console.log(`\nDetails for duplicate messageId: ${dup.messageId}`);
        console.log(emails);
      }
    }
  } catch (error) {
    console.error('Error finding duplicates:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findDuplicateMessageIds(); 