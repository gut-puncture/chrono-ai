import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  Container,
  Grid,
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  IconButton,
  Select,
  MenuItem
} from "@mui/material";
import axios from "axios";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";

export default function Chat() {
  const { data: session, status } = useSession();

  // Chat state
  const [input, setInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const messagesEndRef = useRef(null);

  // Task state
  const [tasks, setTasks] = useState([]);
  const [editTaskId, setEditTaskId] = useState(null);
  const [editedTask, setEditedTask] = useState({});

  // Fetch chat history and tasks on mount (if authenticated)
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

  // Convert LLM's priority text to a numeric priority
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

  // -- TASK EDITING LOGIC --

  const handleEdit = (task) => {
    setEditTaskId(task.id);
    setEditedTask({
      title: task.title,
      description: task.description,
      dueDate: task.dueDate
        ? new Date(task.dueDate).toISOString().split("T")[0]
        : "",
      status: task.status,
      priority: task.priority
    });
  };

  const handleTaskFieldChange = (field, value) => {
    setEditedTask((prev) => ({ ...prev, [field]: value }));
  };

  const updateTask = async (taskId) => {
    try {
      await axios.put(`/api/tasks/${taskId}`, editedTask);
      setEditTaskId(null);
      // Re-fetch tasks to see the changes
      const updatedTasks = await axios.get("/api/tasks");
      setTasks(updatedTasks.data.tasks);
    } catch (error) {
      console.error("Error updating task:", error.response?.data || error.message);
    }
  };

  const deleteTask = async (taskId) => {
    try {
      await axios.delete(`/api/tasks/${taskId}`);
      // Re-fetch tasks
      const updatedTasks = await axios.get("/api/tasks");
      setTasks(updatedTasks.data.tasks);
    } catch (error) {
      console.error("Error deleting task:", error.response?.data || error.message);
    }
  };

  const statusOptions = ["YET_TO_BEGIN", "IN_PROGRESS", "DONE"];

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
        {/* CHAT PANEL */}
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

        {/* TASK LIST PANEL */}
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
                overflowX: "auto",
                p: 2
              }}
            >
              {tasks.length === 0 ? (
                <Typography variant="body2" color="textSecondary">
                  No tasks available
                </Typography>
              ) : (
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Title</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Due Date</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Priority</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell>
                          {editTaskId === task.id ? (
                            <TextField
                              value={editedTask.title}
                              onChange={(e) =>
                                handleTaskFieldChange("title", e.target.value)
                              }
                            />
                          ) : (
                            task.title
                          )}
                        </TableCell>
                        <TableCell>
                          {editTaskId === task.id ? (
                            <TextField
                              value={editedTask.description || ""}
                              onChange={(e) =>
                                handleTaskFieldChange(
                                  "description",
                                  e.target.value
                                )
                              }
                            />
                          ) : (
                            task.description
                          )}
                        </TableCell>
                        <TableCell>
                          {editTaskId === task.id ? (
                            <TextField
                              type="date"
                              value={editedTask.dueDate}
                              onChange={(e) =>
                                handleTaskFieldChange(
                                  "dueDate",
                                  e.target.value
                                )
                              }
                            />
                          ) : (
                            task.dueDate
                              ? new Date(task.dueDate).toLocaleDateString()
                              : ""
                          )}
                        </TableCell>
                        <TableCell>
                          {editTaskId === task.id ? (
                            <Select
                              value={editedTask.status}
                              onChange={(e) =>
                                handleTaskFieldChange("status", e.target.value)
                              }
                            >
                              {statusOptions.map((statusVal) => (
                                <MenuItem key={statusVal} value={statusVal}>
                                  {statusVal.replace("_", " ")}
                                </MenuItem>
                              ))}
                            </Select>
                          ) : (
                            task.status.replace("_", " ")
                          )}
                        </TableCell>
                        <TableCell>
                          {editTaskId === task.id ? (
                            <TextField
                              type="number"
                              value={editedTask.priority}
                              onChange={(e) =>
                                handleTaskFieldChange(
                                  "priority",
                                  parseInt(e.target.value, 10)
                                )
                              }
                            />
                          ) : (
                            task.priority
                          )}
                        </TableCell>
                        <TableCell>
                          {editTaskId === task.id ? (
                            <IconButton onClick={() => updateTask(task.id)}>
                              <SaveIcon />
                            </IconButton>
                          ) : (
                            <>
                              <IconButton onClick={() => handleEdit(task)}>
                                <SaveIcon />
                              </IconButton>
                              <IconButton onClick={() => deleteTask(task.id)}>
                                <DeleteIcon />
                              </IconButton>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Paper>
          </Grid>
        )}
      </Grid>
    </Container>
  );
}
