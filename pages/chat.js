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
          // 1) Fetch chat history from DB
          const chatResponse = await axios.get("/api/chat/history");
          const dbMessages = chatResponse.data.messages;

          // 2) Map DB messages into a format for chatHistory
          const mapped = dbMessages.map((msg) => ({
            role: msg.role,
            // For "user" role, use msg.messageText
            // For "llm" role, use llmResponse if present, else messageText
            text:
              msg.role === "user"
                ? msg.messageText
                : msg.llmResponse || msg.messageText
          }));

          setChatHistory(mapped);

          // 3) Fetch tasks
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

  // Save a message (user or llm) to the DB
  const saveMessageToDB = async (messageData) => {
    try {
      const response = await axios.post("/api/chat/save", messageData);
      return response.data.savedMessage;
    } catch (error) {
      console.error("Error saving message:", error.response?.data || error.message);
      throw error;
    }
  };

  // Create tasks from LLM output
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

      // Re-fetch tasks to update the UI
      const updatedTasks = await axios.get("/api/tasks");
      setTasks(updatedTasks.data.tasks);
    } catch (error) {
      console.error("Error creating tasks:", error);
    }
  };

  // Convert string priority to numeric priority
  const convertPriority = (priorityStr) => {
    switch (priorityStr?.toLowerCase()) {
      case "low":
        return 1;
      case "high":
        return 3;
      default:
        return 2; // medium
    }
  };

  // Send a message to the LLM
  const sendMessage = async () => {
    if (!input.trim() || !session || status !== "authenticated") return;

    try {
      setIsLoading(true);

      // 1) Add user message to local state
      const userMessage = { role: "user", text: input };
      setChatHistory((prev) => [...prev, userMessage]);

      // 2) Save user message to DB
      await saveMessageToDB({
        messageText: input,
        role: "user"
      });

      // 3) Build context from recent messages (up to 15)
      //    Filter out empty or null text
      const context = chatHistory
        .slice(-15)
        .map((msg) => msg.text)
        .filter(Boolean);

      // 4) Call the LLM endpoint
      const response = await axios.post("/api/llm", {
        message: input,
        context
      });

      // 5) Process LLM response
      if (response.data) {
        // Combine acknowledgment + question into one display string
        const ack = response.data.acknowledgment || "";
        const question = response.data.question || "";
        let llmCombinedText = ack;
        if (question.trim()) {
          llmCombinedText += "\n\n" + question;
        }

        // Create an llm message object
        const llmMessage = {
          role: "llm",
          text: llmCombinedText,
          details: response.data
        };

        // 6) Update chat history in the UI
        setChatHistory((prev) => [...prev, llmMessage]);

        // 7) Save LLM message to DB
        //    Important: store the LLM's text (NOT the user input)
        await saveMessageToDB({
          messageText: llmCombinedText,
          role: "llm",
          llmResponse: llmCombinedText,
          tags: response.data.tags
        });

        // 8) Create tasks if any
        if (response.data.tasks?.length > 0) {
          await createTasksFromLLM(response.data.tasks);
        }
      }
    } catch (error) {
      console.error("Error in sendMessage:", error);
      setChatHistory((prev) => [
        ...prev,
        {
          role: "llm",
          text: "Sorry, there was an error processing your message."
        }
      ]);
    } finally {
      setInput("");
      setIsLoading(false);
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Handle loading or unauthenticated states
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
                  justifyContent:
                    msg.role === "user" ? "flex-end" : "flex-start",
                  mb: 1
                }}
              >
                <Paper
                  sx={{
                    p: 1,
                    maxWidth: "80%",
                    backgroundColor:
                      msg.role === "user" ? "#DCF8C6" : "#FFFFFF",
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
                      borderColor: "divider",
                      borderRadius: 1
                    }}
                  >
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

