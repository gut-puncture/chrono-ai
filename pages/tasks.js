// pages/tasks.js
import React, { useState, useEffect } from "react";
import useSWR from "swr";
import axios from "axios";
import { useSession } from "next-auth/react";
import {
  Container, Typography, Table, TableHead, TableBody, TableRow,
  TableCell, TextField, Select, MenuItem, IconButton, Paper
} from "@mui/material";
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';

const fetcher = (url) => axios.get(url).then(res => res.data);
const statusOptions = ["YET_TO_BEGIN", "IN_PROGRESS", "DONE"];

export default function TaskTable() {
  const { data: session } = useSession();
  const { data, mutate } = useSWR(
    session ? "/api/tasks" : null, 
    fetcher, 
    {
      // Disable automatic polling
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      refreshInterval: 0,
      dedupingInterval: 10000,
      // Custom error handling
      onError: (error) => {
        console.error("Error fetching tasks:", error);
      }
    }
  );
  const [editTaskId, setEditTaskId] = useState(null);
  const [editedTask, setEditedTask] = useState({});
  
  // Implement manual refresh with reasonable interval
  useEffect(() => {
    // Only poll if the user is authenticated
    if (!session) return;
    
    console.log("Setting up manual task polling");
    const pollInterval = setInterval(() => {
      console.log("Manual task poll - refreshing data");
      mutate();
    }, 300000); // Poll every 5 minutes instead of every minute
    
    return () => clearInterval(pollInterval);
  }, [session, mutate]);

  // Start editing a task by storing its current values
  const handleEdit = (task) => {
    setEditTaskId(task.id);
    setEditedTask({
      title: task.title,
      description: task.description,
      dueDate: task.dueDate? new Date(task.dueDate).toISOString().split("T")[0]: "",
      status: task.status,
      priority: task.priority
    });
  };

  // Update task in the backend; note: dynamic reordering logic to adjust subsequent tasks
  const updateTask = async (taskId) => {
    try {
      // Get a fresh session token before attempting update
      await axios.get('/api/auth/session');
      
      // Send the update with credentials
      await axios.put(`/api/tasks/${taskId}`, editedTask, {
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      setEditTaskId(null);
      mutate(); // Manually refresh data after update
      console.log("Task updated successfully");
    } catch (error) {
      console.error("Error updating task:", error.response?.data || error.message);
    }
  };

  // Mark a task as completed instead of deleting
  const deleteTask = async (taskId) => {
    try {
      // Get the task to update
      const task = data.tasks.find(t => t.id === taskId);
      if (!task) {
        console.error("Task not found:", taskId);
        return;
      }
      
      // Get a fresh session token before attempting update
      await axios.get('/api/auth/session');
      
      // Update the task status to DONE instead of deleting
      await axios.put(`/api/tasks/${taskId}`, {
        ...task,
        status: "DONE"
      }, {
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      mutate(); // Refresh the task list
      console.log("Task marked as done");
    } catch (error) {
      console.error("Error marking task as done:", error.response?.data || error.message);
    }
  };

  const handleChange = (field, value) => {
    setEditedTask((prev) => ({...prev, [field]: value }));
  };

  if (!session) {
    return (
      <Container sx={{ mt: 4 }}>
        <Typography variant="h6">Please sign in to view tasks.</Typography>
      </Container>
    );
  }

  if (!data) {
    return <div>Loading...</div>; // Or a loading indicator component
  }

  return (
    <Container sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>Task Management</Typography>
      <Paper variant="outlined" sx={{ overflowX: "auto" }}>
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
            {data.tasks.map((task) => (
              <TableRow key={task.id}>
                <TableCell>
                  {editTaskId === task.id? (
                    <TextField
                      value={editedTask.title}
                      onChange={(e) => handleChange("title", e.target.value)}
                      fullWidth
                      sx={{ minWidth: '150px' }}
                    />
                  ): (
                    task.title
                  )}
                </TableCell>
                <TableCell>
                  {editTaskId === task.id? (
                    <TextField
                      value={editedTask.description || ""}
                      onChange={(e) => handleChange("description", e.target.value)}
                      fullWidth
                      multiline
                      sx={{ minWidth: '200px' }}
                    />
                  ): (
                    task.description
                  )}
                </TableCell>
                <TableCell>
                  {editTaskId === task.id? (
                    <TextField
                      type="date"
                      value={editedTask.dueDate}
                      onChange={(e) => handleChange("dueDate", e.target.value)}
                    />
                  ): (
                    task.dueDate? new Date(task.dueDate).toLocaleDateString(): ""
                  )}
                </TableCell>
                <TableCell>
                  {editTaskId === task.id? (
                    <Select
                      value={editedTask.status}
                      onChange={(e) => handleChange("status", e.target.value)}
                    >
                      {statusOptions.map((status) => (
                        <MenuItem key={status} value={status}>{status.replace("_", " ")}</MenuItem>
                      ))}
                    </Select>
                  ): (
                    task.status.replace("_", " ")
                  )}
                </TableCell>
                <TableCell>
                  {editTaskId === task.id? (
                    <TextField
                      type="number"
                      value={editedTask.priority}
                      onChange={(e) => handleChange("priority", parseInt(e.target.value, 10))}
                    />
                  ): (
                    task.priority
                  )}
                </TableCell>
                <TableCell>
                  {editTaskId === task.id? (
                    <IconButton onClick={() => updateTask(task.id)}>
                      <SaveIcon />
                    </IconButton>
                  ): (
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
      </Paper>
      <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
        * Adjusting the numeric priority will eventually reorder tasks automatically.
      </Typography>
    </Container>
  );
}
