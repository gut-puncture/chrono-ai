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

export default function Chat() {
  const { data: session, status } = useSession();
  const [input, setInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [tasks, setTasks] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      if (status === "authenticated") {
        try {
          // Fetch chat history
          const chatResponse = await axios.get("/api/chat/history");
          const dbMessages = chatResponse.data.messages;
          
          const mapped = dbMessages.map((msg) => ({
            role: msg.role,
            text: msg.role === "user" ? msg.messageText : (msg.llmResponse || msg.messageText)
          }));
          
          setChatHistory(mapped);

          // Fetch tasks
          const taskResponse = await axios.get("/api/tasks");
          setTasks(taskResponse.data.tasks);
        } catch (error) {
          console.error("Error fetching initial data:", error);
        }
      }
    };

    fetchInitialData();
    setIsMounted(true);
  }, [status]);

  // Scroll to bottom whenever chat history updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const saveMessageToDB = async (messageData) => {
    try {
      const response = await axios.post("/api/chat/save", messageData);
      return response.data.savedMessage;
    } catch (error) {
      console.error("Error saving message:", error.response?.data || error.message);
      throw error;
    }
  };

  const createTasksFromLLM = async (tasksFromLLM) => {
    try {
      for (const task of tasksFromLLM) {
        const dueDateValue = task.inferred_due_date || task.due_date || null;
        
        await axios.post("/api/tasks", {
          title: task.title,
          description: task.description || "",
          dueDate: dueDateValue,
          status: "YET_TO_BEGIN",
          priority: convertPriority(task.priority),
          sourceMessageId: null
        });
      }

      const updatedTasks = await axios.get("/api/tasks");
      setTasks(updatedTasks.data.tasks);
    } catch (error) {
      console.error("Error creating tasks:", error);
    }
  };

  const convertPriority = (priorityStr) => {
    switch (priorityStr?.toLowerCase()) {
      case "low": return 1;
      case "high": return 3;
      default: return 2; // medium
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !session || status !== "authenticated") return;

    try {
      setIsLoading(true);
      
      // Add user message to local chat state
      const userMessage = { role: "user", text: input };
      setChatHistory(prev => [...prev, userMessage]);

      // Save user message to DB
      await saveMessageToDB({ 
        messageText: input, 
        role: "user" 
      });

      // Get context from recent messages
      const context = chatHistory
        .slice(-15)
        .map(msg => msg.text)
        .filter(text => text); // This removes null, undefined, empty strings, etc.


      // Call LLM API
      const response = await axios.post("/api/llm", { 
        message: input,
        context 
      });

      if (response.data) {
        const llmMessage = {
          role: "llm",
          text: response.data.acknowledgment || response.data.message,
          details: response.data
        };

        // Update chat history with LLM response
        setChatHistory(prev => [...prev, llmMessage]);

        // Save LLM response to DB
        await saveMessageToDB({
          messageText: input,
          role: "llm",
          llmResponse: llmMessage.text,
          tags: response.data.tags
        });

        // Create any tasks from LLM response
        if (response.data.tasks?.length > 0) {
          await createTasksFromLLM(response.data.tasks);
        }
      }

    } catch (error) {
      console.error("Error in sendMessage:", error);
      setChatHistory(prev => [...prev, {
        role: "llm",
        text: "Sorry, there was an error processing your message."
      }]);
    } finally {
      setInput("");
      setIsLoading(false);
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  if (status === "loading") {
    return (
      <Container sx={{ mt: 4 }}>
        <Typography>Loading...</Typography>
      </Container>
    );
  }

  if (status === "unauthenticated") {
    return (
      <Container sx={{ mt: 4 }}>
        <Typography variant="h6">Please sign in to access the chat.</Typography>
      </Container>
    );
  }

  return (
    <Container sx={{ mt: 4 }}>
      <Grid container spacing={2}>
        {/* Chat Panel */}
        <Grid item xs={8}>
          <Typography variant="h4" gutterBottom>
            Chat Interface
          </Typography>
          <Paper 
            variant="outlined" 
            sx={{ 
              height: "60vh", 
              overflowY: "auto", 
              p: 2,
              bgcolor: "background.paper" 
            }}
          >
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
                    backgroundColor: msg.role === "user" ? "#DCF8C6" : "#FFFFFF",
                    boxShadow: 1
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
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              disabled={isLoading}
              multiline
              maxRows={4}
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
            <Paper 
              variant="outlined" 
              sx={{ 
                height: "60vh", 
                overflowY: "auto", 
                p: 2 
              }}
            >
              {tasks.length === 0 ? (
                <Typography variant="body2" color="textSecondary">
                  No tasks available
                </Typography>
              ) : (
                tasks.map((task) => (
                  <Box 
                    key={task.id} 
                    sx={{ 
                      mb: 2,
                      p: 2,
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1
                    }}
                  >
                    <Typography variant="body1" sx={{ fontWeight: "bold" }}>
                      {task.title}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Due: {task.dueDate
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
