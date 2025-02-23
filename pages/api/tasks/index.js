// pages/api/tasks/index.js
import prisma from "../../../lib/prisma";
import { getSession } from "next-auth/react";

export default async function handler(req, res) {
  // Ensure the user is authenticated
  const session = await getSession({ req });
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  // Retrieve the user from the database using the email from the session
  const userEmail = session.user.email;
  const user = await prisma.user.findUnique({ where: { email: userEmail } });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  
  if (req.method === "GET") {
    // List tasks ordered by numeric priority (ascending)
    const tasks = await prisma.task.findMany({
      where: { userId: user.id },
      orderBy: { priority: "asc" }
    });
    return res.status(200).json({ tasks });
  } else if (req.method === "POST") {
    // Create a new task with provided fields
    const { title, description, dueDate, status, priority, sourceMessageId } = req.body;
    const newTask = await prisma.task.create({
      data: {
        userId: user.id,
        title,
        description,
        dueDate: dueDate ? new Date(dueDate) : null,
        status,
        priority,
        sourceMessageId: sourceMessageId || null
      }
    });
    return res.status(201).json({ task: newTask });
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }
}
