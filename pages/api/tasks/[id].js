// pages/api/tasks/[id].js
import prisma from "../../../lib/prisma";
import { getSession } from "next-auth/react";

export default async function handler(req, res) {
  console.log("Task API [id] called with method:", req.method);
  console.log("Request body:", req.body);
  console.log("Task ID:", req.query.id);

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
    try {
      const { title, description, dueDate, status, priority } = req.body;
      console.log("Updating task with data:", { title, description, dueDate, status, priority });

      // Validate required fields
      if (!title || status === undefined || priority === undefined) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const taskId = parseInt(id);
      if (isNaN(taskId)) {
        return res.status(400).json({ error: "Invalid task ID format" });
      }

      const task = await prisma.task.findUnique({ where: { id: taskId } });
      if (!task || task.userId !== user.id) {
        return res.status(404).json({ error: "Task not found" });
      }
      
      // Update the task with new values
      const updatedTask = await prisma.task.update({
        where: { id: taskId },
        data: {
          title,
          description,
          dueDate: dueDate ? new Date(dueDate) : null,
          status,
          priority,
          updatedAt: new Date() // Ensure updatedAt is set on every update
        }
      });
      
      console.log("Task updated successfully:", updatedTask);
      return res.status(200).json({ task: updatedTask });
    } catch (error) {
      console.error("Error updating task:", error);
      return res.status(500).json({ error: "Failed to update task", details: error.message });
    }
  } else if (req.method === "DELETE") {
    try {
      const taskId = parseInt(id);
      if (isNaN(taskId)) {
        return res.status(400).json({ error: "Invalid task ID format" });
      }
      
      const task = await prisma.task.findUnique({ where: { id: taskId } });
      if (!task || task.userId !== user.id) {
        return res.status(404).json({ error: "Task not found" });
      }
      
      await prisma.task.delete({ where: { id: taskId } });
      return res.status(200).json({ message: "Task deleted" });
    } catch (error) {
      console.error("Error deleting task:", error);
      return res.status(500).json({ error: "Failed to delete task", details: error.message });
    }
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }
}
