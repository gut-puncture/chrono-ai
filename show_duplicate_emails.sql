SELECT messageId, COUNT(*) as count FROM "Email" GROUP BY messageId HAVING COUNT(*) > 1;
