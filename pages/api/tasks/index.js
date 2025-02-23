// pages/api/tasks/index.js
import prisma from "../../../lib/prisma";
import { getSession } from "next-auth/react";

export default async function handler(req, res) {
  const session = await getSession({ req });
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userEmail = session.user.email;
  const user = await prisma.user.findUnique({ where: { email: userEmail } });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  if (req.method === "GET") {
    // Fetch tasks in ascending priority
    const tasks = await prisma.task.findMany({
      where: { userId: user.id },
      orderBy: { priority: "asc" }
    });
    return res.status(200).json({ tasks });
  } else if (req.method === "POST") {
    // Create a new task
    const { title, description, dueDate, status, priority, sourceMessageId } = req.body;
    const newTask = await prisma.task.create({
      data: {
        userId: user.id,
        title,
        description: description || "",
        dueDate: dueDate ? new Date(dueDate) : null,
        status: status || "YET_TO_BEGIN",
        priority: priority || 2, // default medium priority
        sourceMessageId: sourceMessageId || null
      }
    });
    return res.status(201).json({ task: newTask });
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }
}
