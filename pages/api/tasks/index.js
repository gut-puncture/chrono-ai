// pages/api/tasks/index.js
import prisma from "../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/authOptions";

export default async function handler(req, res) {
  console.log("Tasks API called with method:", req.method);
  
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    console.log("No session found in server");
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userEmail = session.user.email;
  console.log("Processing request for user:", userEmail);
  
  const user = await prisma.user.findUnique({ where: { email: userEmail } });
  if (!user) {
    console.log("User not found in database:", userEmail);
    return res.status(404).json({ error: "User not found" });
  }

  if (req.method === "GET") {
    try {
      console.log("Fetching tasks for user ID:", user.id);
      
      // Get the last update timestamp from the request header
      const lastUpdate = req.headers['last-update'];
      let whereClause = { userId: user.id };
      
      // If lastUpdate is provided, only fetch tasks updated after that timestamp
      if (lastUpdate) {
        whereClause.updatedAt = {
          gt: new Date(parseInt(lastUpdate))
        };
      }
      
      // Fetch tasks with the where clause
      const tasks = await prisma.task.findMany({
        where: whereClause,
        orderBy: [
          { status: 'asc' },
          { priority: 'desc' },
          { createdAt: 'desc' }
        ]
      });
      
      // Get the current server timestamp
      const serverTimestamp = Date.now();
      
      console.log(`Found ${tasks.length} tasks for user`);
      return res.status(200).json({ 
        tasks,
        timestamp: serverTimestamp
      });
    } catch (error) {
      console.error('Error fetching tasks:', error);
      return res.status(500).json({ error: 'Failed to fetch tasks', details: error.message });
    }
  } else if (req.method === "POST") {
    try {
      const { title, description, dueDate, status, priority } = req.body;
      
      console.log('Creating new task with data:', {
        userId: user.id,
        title,
        description,
        dueDate,
        status,
        priority
      });
      
      const newTask = await prisma.task.create({
        data: {
          userId: user.id,
          title: title || "New Task",
          description: description || "",
          dueDate: dueDate ? new Date(dueDate) : null,
          status: status || "YET_TO_BEGIN",
          priority: priority || 2,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      
      console.log('Successfully created task:', newTask);
      return res.status(201).json({ task: newTask });
    } catch (error) {
      console.error('Error creating task:', error);
      return res.status(500).json({ 
        error: 'Failed to create task', 
        details: error.message,
        stack: error.stack 
      });
    }
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }
}
