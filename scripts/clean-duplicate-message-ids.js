const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanDuplicateMessageIds() {
  try {
    // Find all messageIds that appear more than once
    const duplicateMessageIds = await prisma.$queryRaw`
      SELECT "messageId", COUNT(*) as count
      FROM "Email"
      GROUP BY "messageId"
      HAVING COUNT(*) > 1
    `;
    
    if (duplicateMessageIds.length === 0) {
      console.log('No duplicate messageIds found. It should be safe to add the unique constraint.');
      return;
    }
    
    console.log(`Found ${duplicateMessageIds.length} messageIds with duplicates.`);
    
    // For each duplicate messageId, keep the most recent one and delete the others
    for (const dup of duplicateMessageIds) {
      const messageId = dup.messageId;
      console.log(`\nProcessing duplicate messageId: ${messageId}`);
      
      // Get all emails with this messageId
      const emails = await prisma.email.findMany({
        where: { messageId },
        orderBy: { date: 'desc' }, // Order by date, most recent first
      });
      
      console.log(`Found ${emails.length} emails with this messageId`);
      
      // Keep the most recent one (index 0) and delete the rest
      if (emails.length > 1) {
        const idsToDelete = emails.slice(1).map(email => email.id);
        
        console.log(`Keeping email with id: ${emails[0].id}`);
        console.log(`Deleting ${idsToDelete.length} duplicate emails with ids: ${idsToDelete.join(', ')}`);
        
        // Delete the duplicates
        const deleteResult = await prisma.email.deleteMany({
          where: {
            id: { in: idsToDelete }
          }
        });
        
        console.log(`Deleted ${deleteResult.count} emails`);
      }
    }
    
    console.log('\nDuplicate cleanup complete!');
  } catch (error) {
    console.error('Error cleaning duplicates:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanDuplicateMessageIds(); 