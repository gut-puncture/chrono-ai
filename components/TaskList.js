import React, { useEffect } from 'react';

const TaskList = () => {
  useEffect(() => {
    const pollInterval = setInterval(() => {
      fetchTasks();
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(pollInterval);
  }, []);

  return (
    // Rest of the component code
  );
};

export default TaskList; 