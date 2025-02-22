import { useState, useEffect, useCallback, useContext } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { FiEdit, FiTrash2, FiCheck } from 'react-icons/fi';
import { AuthContext } from '../Providers/AuthProvider';
import Swal from 'sweetalert2';

const categories = ['To-Do', 'In Progress', 'Done'];
const TaskBoard = () => {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    category: 'To-Do',
  });
  const [editingTask, setEditingTask] = useState(null);
  const { socket, theme } = useContext(AuthContext);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (socket) {
      socket.on('task-added', task => {
        console.log(task);
        fetchTasks();
        Swal.fire({
          position: 'top-end',
          icon: 'success',
          title: `${task.message}`,
          showConfirmButton: false,
          timer: 1500,
        });
      });

      // update
      socket.on('task-updated', task => {
        console.log(task);
        fetchTasks();
        Swal.fire({
          position: 'top-end',
          icon: 'success',
          title: `${task.message}`,
          showConfirmButton: false,
          timer: 1500,
        });
      });

      // delete
      socket.on('task-deleted', task => {
        console.log(task);
        fetchTasks();
        Swal.fire({
          position: 'top-center',
          icon: 'success',
          title: `${task.message}`,
          showConfirmButton: false,
          timer: 1500,
        });
      });

      return () => {
        if (socket) {
          socket.off('task-added');
          socket.off('task-updated');
          socket.off('task-deleted');
        }
      };
    }
  }, [socket]);

  // Fetch tasks from server
  const fetchTasks = useCallback(async () => {
    try {
      const response = await fetch(
        `https://taskflow-server-f50d.onrender.com/task`
      );
      const data = await response.json();
      if (Array.isArray(data)) {
        setTasks(data);
      } else {
        console.error('Expected array but got:', data);
        setTasks([]);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setTasks([]);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Handle Drag & Drop
  const handleDragEnd = async result => {
    const { source, destination, draggableId } = result;

    // If the task is dropped outside or no destination is found
    if (!destination) return;

    // If the task hasn't moved, do nothing
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    // Create a new array of tasks
    const newTasks = Array.from(tasks);

    // Find the task that was dragged
    const draggedTask = newTasks.find(task => task._id === draggableId);

    if (!draggedTask) {
      console.error('Dragged task not found');
      return;
    }

    // Remove the task from its original position
    newTasks.splice(newTasks.indexOf(draggedTask), 1);

    // Update the task's category if it has changed
    if (source.droppableId !== destination.droppableId) {
      draggedTask.category = destination.droppableId;
    }

    // Insert the task at its new position
    newTasks.splice(destination.index, 0, draggedTask);

    // Update the local state
    setTasks(newTasks);

    // Update the backend
    try {
      await fetch(
        `https://taskflow-server-f50d.onrender.com/task/reorder/${draggableId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: draggedTask.category,
            index: destination.index,
          }),
        }
      );
    } catch (error) {
      console.error('Error updating task:', error);
      // Revert the local state change if the server update fails
      fetchTasks();
    }
  };

  // Handle Input Change
  const handleInputChange = e => {
    setNewTask({ ...newTask, [e.target.name]: e.target.value });
  };

  // Add New Task
  const handleAddTask = async () => {
    if (!newTask.title.trim()) return;

    try {
      const response = await fetch(
        `https://taskflow-server-f50d.onrender.com/task`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newTask),
        }
      );

      if (response.ok) {
        fetchTasks();
        setNewTask({ title: '', description: '', category: 'To-Do' });
      }
    } catch (error) {
      console.error('Error adding task:', error);
    }
  };

  // Delete Task
  const handleDeleteTask = async taskId => {
    try {
      await fetch(`https://taskflow-server-f50d.onrender.com/task/${taskId}`, {
        method: 'DELETE',
      });
      setTasks(tasks.filter(task => task._id !== taskId));
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  // Enable Edit Mode
  const handleEditTask = task => {
    setEditingTask(task);
  };

  // Save Updated Task
  const handleSaveTask = async (taskId, updatedTask) => {
    // eslint-disable-next-line no-unused-vars
    const { _id, ...taskToUpdate } = updatedTask;

    try {
      await fetch(`https://taskflow-server-f50d.onrender.com/task/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskToUpdate),
      });

      setEditingTask(null);
      fetchTasks();
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  // Format date to a readable format
  const formatDate = date => {
    const d = new Date(date);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  };
  // console.log(tasks);
  return (
    <div className="container mx-auto p-5">
      {/* Task Input Form */}
      <div className="mb-5 flex flex-wrap gap-3 w-4/5 mx-auto">
        <input
          type="text"
          name="title"
          placeholder="Task Title"
          value={newTask.title}
          onChange={handleInputChange}
          required
          maxLength={50}
          className="p-2  rounded-md border-orange-600 border-2"
        />
        <input
          type="text"
          name="description"
          placeholder="Description"
          value={newTask.description}
          onChange={handleInputChange}
          required
          maxLength={200}
          className="p-2 border rounded-md "
        />
        <div className="flex gap-3">
          <select
            name="category"
            value={newTask.category}
            onChange={handleInputChange}
            className="p-2 border rounded-md  border-orange-500"
          >
            {categories.map(cat => (
              <option
                key={cat}
                value={cat}
                className={`${
                  theme === 'dark' ? 'bg-[#121212] text-white' : 'bg-base-100'
                }`}
              >
                {cat}
              </option>
            ))}
          </select>
          <button
            onClick={handleAddTask}
            className="bg-[#ff5945] text-[#fff]  px-4 py-2 rounded-md"
          >
            Add Task
          </button>
        </div>
      </div>

      {/* Drag & Drop Task Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {categories.map(category => (
            <Droppable key={category} droppableId={category}>
              {provided => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`p-4  rounded-md shadow-md  min-h-[300px] ${
                    theme === 'dark'
                      ? 'border border-gray-700 text-orange-100'
                      : 'border border-gray-300'
                  }`}
                >
                  <h2 className="text-lg font-semibold mb-2">{category}</h2>
                  {tasks
                    .filter(task => task.category === category)
                    .map((task, index) => (
                      <Draggable
                        key={task._id}
                        draggableId={task._id}
                        index={index}
                      >
                        {provided => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className=" p-3 mb-2 shadow-md rounded-md flex justify-between items-center"
                          >
                            {/* Task Details */}
                            {editingTask?._id === task._id ? (
                              <div className="flex flex-col gap-2 w-full">
                                <input
                                  type="text"
                                  value={editingTask.title}
                                  onChange={e =>
                                    setEditingTask({
                                      ...editingTask,
                                      title: e.target.value,
                                    })
                                  }
                                  className="border p-1 rounded-md"
                                />
                                <input
                                  type="text"
                                  value={editingTask.description}
                                  onChange={e =>
                                    setEditingTask({
                                      ...editingTask,
                                      description: e.target.value,
                                    })
                                  }
                                  className="border p-1 rounded-md"
                                />
                              </div>
                            ) : (
                              <div className="flex-1">
                                <h3 className="font-semibold">{task.title}</h3>
                                <p className="text-sm text-gray-400">
                                  {task.description}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {formatDate(task.createdAt)}
                                </p>
                              </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex gap-2">
                              {editingTask?._id === task._id ? (
                                <FiCheck
                                  className="cursor-pointer text-green-500 text-2xl"
                                  onClick={() =>
                                    handleSaveTask(task._id, editingTask)
                                  }
                                  size={18}
                                />
                              ) : (
                                <FiEdit
                                  className="cursor-pointer text-blue-500"
                                  onClick={() => handleEditTask(task)}
                                  size={18}
                                />
                              )}
                              <FiTrash2
                                className="cursor-pointer text-red-500"
                                onClick={() => handleDeleteTask(task._id)}
                                size={18}
                              />
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
};

export default TaskBoard;
