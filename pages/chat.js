// pages/chat.js
import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  Container,
  Grid,
  Box,
  TextField,
  Button,
  Typography,
  Paper
} from "@mui/material";
import axios from "axios";

// *** ADD THIS LINE ***
axios.defaults.withCredentials = true; // Set globally for all axios requests

export default function Chat() {
  // ... (rest of your component code remains the same) ...
  const { data: session } = useSession();
  const [input, setInput] = useState("");
  // Initialize chatHistory as an empty array
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [tasks, setTasks] = useState([]); // <--- We'll store tasks here
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Fetch chat history on mount
    const fetchChatHistory = async () => {
      try {
        await ensureAuthenticated();
        const response = await axios.get("/api/chat/history"); // Removed: withCredentials: true
        const dbMessages = response.data.messages;

        // Map DB messages to the shape we need for display
        const mapped = dbMessages.map((msg) => {
          if (msg.role === "user") {
            return { role: "user", text: msg.messageText };
          } else {
            // role === "llm"
            // Use llmResponse if present, otherwise fallback
            return { role: "llm", text: msg.llmResponse || "" };
          }
        });

        setChatHistory(mapped);
      } catch (error) {
        console.error("Error fetching chat history:", error);
      }
    };

    // Fetch tasks on mount (so we see them in the right-hand panel)
    const fetchTasks = async () => {
      try {
        await ensureAuthenticated();
        const response = await axios.get("/api/tasks"); // Removed: withCredentials: true
        setTasks(response.data.tasks);
      } catch (error) {
        console.error("Error fetching tasks:", error);
      }
    };

    if (session) {
      fetchChatHistory();
      fetchTasks();
    }

    setIsMounted(true);
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session]);

  // Quick helper to ensure we have a valid session
  const ensureAuthenticated = async () => {
    if (!session) {
      throw new Error("User not authenticated");
    }
  };

  if (!session) {
    return (
      <Container sx={{ mt: 4 }}>
        <Typography variant="h6">Please sign in to access the chat.</Typography>
      </Container>
    );
  }

  // Convert string priority to numeric
  const convertPriority = (priorityStr) => {
    switch (priorityStr?.toLowerCase()) {
      case "low":
        return 1;
      case "medium":
        return 2;
      case "high":
        return 3;
      default:
        return 2; // default to medium
    }
  };

  // Persist a message to the DB
  const saveMessageToDB = async (messageData) => {
    try {
      await axios.post("/api/chat/save", messageData); // Removed: withCredentials: true
    } catch (error) {
      console.error("Error saving message:", error.response?.data || error.message);
    }
  };

  // Create tasks in the DB from LLM tasks array
  const createTasksFromLLM = async (tasksFromLLM) => {
    for (const task of tasksFromLLM) {
      try {
        // If your LLM uses "inferred_due_date" instead of "due_date",
        // adjust accordingly:
        const dueDateValue = task.inferred_due_date || null;

        await axios.post("/api/tasks", {
          title: task.title,
          description: "", // or add a field if your LLM provides one
          dueDate: dueDateValue,
          status: "YET_TO_BEGIN",
          priority: convertPriority(task.priority),
          sourceMessageId: null
        });  // Removed: withCredentials: true
      } catch (error) {
        console.error("Error creating task:", error.response?.data || error.message);
      }
    }

    // Refresh tasks after creating them
    const updatedTasks = await axios.get("/api/tasks"); // Removed: withCredentials: true
    setTasks(updatedTasks.data.tasks);
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    // Add user message to local chat state
    const userMessage = { role: "user", text: input };
    setChatHistory((prev) => [...prev, userMessage]);

    // Save to DB
    await saveMessageToDB({ messageText: input, role: "user" });
    setIsLoading(true);

    // Build context from the last 15 messages
    const context = chatHistory.slice(-15).map((msg) => msg.text);

    try {
      // Call your LLM API
      const response = await axios.post("/api/llm", { message: input, context }); // Removed: withCredentials: true
      const llmData = response.data;

      // Only show the "acknowledgment" to the user
      const llmMessage = {
        role: "llm",
        text: llmData.acknowledgment,
        details: llmData
      };
      setChatHistory((prev) => [...prev, llmMessage]);

      // Save LLM response in DB
      await saveMessageToDB({
        messageText: input,   // Original user prompt
        role: "llm",
        llmResponse: llmData.acknowledgment,
        tags: llmData.tags
      });

      // If LLM returned tasks, create them in DB
      if (llmData.tasks && llmData.tasks.length > 0) {
        await createTasksFromLLM(llmData.tasks);
      }
    } catch (error) {
      console.error("LLM API error:", error.response?.data || error.message);
      const errorMessage = { role: "llm", text: "Error processing message" };
      setChatHistory((prev) => [...prev, errorMessage]);
      await saveMessageToDB({
        messageText: input,
        role: "llm",
        llmResponse: "Error processing message"
      });
    } finally {
      setInput("");
      setIsLoading(false);
    }
  };

  return (
    <Container sx={{ mt: 4 }}>
      <Grid container spacing={2}>
        {/* --- CHAT PANEL --- */}
        <Grid item xs={8}>
          <Typography variant="h4" gutterBottom>
            Chat Interface
          </Typography>
          <Paper variant="outlined" sx={{ height: "60vh", overflowY: "auto", p: 2 }}>
            {chatHistory.map((msg, index) => (
              <Box
                key={index}
                sx={{
                  display: "flex",
                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                  mb: 1
                }}
              >
                <Paper
                  sx={{
                    p: 1,
                    maxWidth: "80%",
                    backgroundColor: msg.role === "user" ? "#DCF8C6" : "#FFFFFF"
                  }}
                >
                  <Typography variant="body1">{msg.text}</Typography>
                </Paper>
              </Box>
            ))}
            <div ref={messagesEndRef} />
          </Paper>
          <Box sx={{ mt: 2, display: "flex" }}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Type your message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendMessage();
              }}
            />
            <Button
              variant="contained"
              color="primary"
              onClick={sendMessage}
              disabled={isLoading}
              sx={{ ml: 2 }}
            >
              Send
            </Button>
          </Box>
        </Grid>

        {/* --- TASK LIST PANEL --- */}
        {isMounted && (
          <Grid item xs={4}>
            <Typography variant="h5" gutterBottom>
              Task List
            </Typography>
            <Paper variant="outlined" sx={{ height: "60vh", overflowY: "auto", p: 2 }}>
              {tasks.length === 0 ? (
                <Typography variant="body2" color="textSecondary">
                  (Tasks auto-created from LLM responses will appear here.)
                </Typography>
              ) : (
                tasks.map((task) => (
                  <Box key={task.id} sx={{ mb: 1 }}>
                    <Typography variant="body1" sx={{ fontWeight: "bold" }}>
                      {task.title}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Due:{" "}
                      {task.dueDate
                        ? new Date(task.dueDate).toLocaleDateString()
                        : "No due date"}
                    </Typography>
                    <Typography variant="body2">
                      Priority: {task.priority}
                    </Typography>
                  </Box>
                ))
              )}
            </Paper>
          </Grid>
        )}
      </Grid>
    </Container>
  );
}
