import prisma from './prisma';
import axios from 'axios';

export async function syncEmails(accessToken: string, userId: number) {
  try {
    const lastEmail = await prisma.email.findFirst({
      where: { userId },
      orderBy: { date: 'desc' },
    });

    const after = lastEmail 
      ? new Date(lastEmail.date.getTime() + 1000).toISOString() 
      : new Date(Date.now() - 15 * 60 * 1000).toISOString(); // 15 minutes ago if no emails

    const response = await axios.get("https://gmail.googleapis.com/gmail/v1/users/me/messages", {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: {
        q: `after:${after}`,
        maxResults: 50
      }
    });

    const messages = response.data.messages || [];
    if (messages.length === 0) return;

    // Fetch full message details
    const detailedMessages = await Promise.all(messages.map(async (msg) => {
      const detailResponse = await axios.get(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { format: "full" }
        }
      );
      return detailResponse.data;
    }));

    // Process messages by thread
    const threadMap = new Map();
    detailedMessages.forEach(msg => {
      if (!threadMap.has(msg.threadId)) {
        threadMap.set(msg.threadId, []);
      }
      threadMap.get(msg.threadId).push(msg);
    });

    // Update database in transaction
    await prisma.$transaction(async (tx) => {
      for (const [threadId, messages] of threadMap.entries()) {
        // Upsert thread
        const subject = messages[0].payload.headers.find(h => h.name === "Subject")?.value;
        const lastEmailAt = new Date(Math.max(...messages.map(m => parseInt(m.internalDate))));
        
        await tx.emailThread.upsert({
          where: { threadId },
          create: {
            threadId,
            userId,
            subject,
            lastEmailAt
          },
          update: {
            subject,
            lastEmailAt
          }
        });

        // Create emails
        for (const msg of messages) {
          await tx.email.create({
            data: {
              messageId: msg.id,
              userId,
              threadId: msg.threadId,
              snippet: msg.snippet,
              subject: msg.payload.headers.find(h => h.name === "Subject")?.value,
              from: msg.payload.headers.find(h => h.name === "From")?.value,
              to: msg.payload.headers.find(h => h.name === "To")?.value,
              date: new Date(parseInt(msg.internalDate)),
              labels: msg.labelIds
            }
          });
        }
      }
    });

    return true;
  } catch (error) {
    console.error("Error syncing emails:", error);
    throw error;
  }
}
