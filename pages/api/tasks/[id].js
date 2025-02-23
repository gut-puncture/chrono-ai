// pages/api/tasks/[id].js
import prisma from "../../../lib/prisma";
import { getSession } from "next-auth/react";

export default async function handler(req, res) {
  const { id } = req.query;
  const session = await getSession({ req });
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  const userEmail = session.user.email;
  const user = await prisma.user.findUnique({ where: { email: userEmail } });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  
  // Ensure that only tasks belonging to the authenticated user can be modified
  if (req.method === "PUT") {
    const { title, description, dueDate, status, priority } = req.body;
    const task = await prisma.task.findUnique({ where: { id: parseInt(id) } });
    if (!task || task.userId !== user.id) {
      return res.status(404).json({ error: "Task not found" });
    }
    // Update the task with new values
    const updatedTask = await prisma.task.update({
      where: { id: parseInt(id) },
      data: {
        title,
        description,
        dueDate: dueDate ? new Date(dueDate) : null,
        status,
        priority
      }
    });
    return res.status(200).json({ task: updatedTask });
  } else if (req.method === "DELETE") {
    const task = await prisma.task.findUnique({ where: { id: parseInt(id) } });
    if (!task || task.userId !== user.id) {
      return res.status(404).json({ error: "Task not found" });
    }
    await prisma.task.delete({ where: { id: parseInt(id) } });
    return res.status(200).json({ message: "Task deleted" });
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }
}
