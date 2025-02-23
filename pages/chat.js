// pages/chat.js
import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { Container, Grid, Box, TextField, Button, Typography, Paper } from "@mui/material";
import axios from "axios";

export default function Chat() {
  const { data: session } = useSession();
  const [input, setInput] = useState("");
  // Initialize chatHistory as an empty array
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const fetchChatHistory = async () => {
      try {
        const response = await axios.get("/api/chat/history");
        setChatHistory(response.data.messages);
      } catch (error) {
        console.error("Error fetching chat history:", error);
      }
    };

    if (session) {
      fetchChatHistory();
    }

    setIsMounted(true);
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session]);

  if (!session) {
    return (
      <Container sx={{ mt: 4 }}>
        <Typography variant="h6">Please sign in to access the chat.</Typography>
      </Container>
    );
  }

  // Helper function to convert string priority to a numeric value
  const convertPriority = (priorityStr) => {
    switch (priorityStr?.toLowerCase()) {
      case "low":
        return 1;
      case "medium":
        return 2;
      case "high":
        return 3;
      default:
        return 2; // default to medium if not provided
    }
  };

  // Function to persist a message via the backend
  const saveMessageToDB = async (messageData) => {
    try {
      await axios.post("/api/chat/save", messageData);
    } catch (error) {
      console.error("Error saving message:", error.response?.data || error.message);
    }
  };

  // Function to create tasks in the DB from LLM response
  const createTasksFromLLM = async (tasks) => {
    for (const task of tasks) {
      try {
        await axios.post("/api/tasks", {
          title: task.title,
          description: "", // you can add more details if available
          dueDate: task.due_date, // may be null
          status: "YET_TO_BEGIN", // default status
          priority: convertPriority(task.priority),
          sourceMessageId: null
        });
      } catch (error) {
        console.error("Error creating task:", error.response?.data || error.message);
      }
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: "user", text: input };
    setChatHistory((prev) => [...prev, userMessage]);
    await saveMessageToDB({ messageText: input, role: "user" });
    setIsLoading(true);

    // Build context from the last 15 messages
    const context = chatHistory.slice(-15).map((msg) => msg.text);

    try {
      const response = await axios.post("/api/llm", { message: input, context });
      const llmData = response.data;
      
      // Only display the acknowledgment message to the user
      const llmMessage = { role: "llm", text: llmData.acknowledgment, details: llmData };
      setChatHistory((prev) => [...prev, llmMessage]);

      await saveMessageToDB({
        messageText: input,
        role: "llm",
        llmResponse: llmData.acknowledgment,
        tags: llmData.tags
      });

      // Create tasks from LLM response if any exist
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
        {/* Chat and Task List Panel */}
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

        {/* Task List Panel */}
        {isMounted && (
          <Grid item xs={4}>
            <Typography variant="h5" gutterBottom>
              Task List
            </Typography>
            <Paper variant="outlined" sx={{ height: "60vh", overflowY: "auto", p: 2 }}>
              <Typography variant="body2" color="textSecondary">
                (Tasks auto-created from LLM responses will appear here.)
              </Typography>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Container>
  );
}
