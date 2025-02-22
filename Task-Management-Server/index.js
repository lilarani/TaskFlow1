const express = require('express');
const cors = require('cors');
require('dotenv').config();
const http = require('http');
const socketIo = require('socket.io');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

// Create HTTP server and initialize socket.io
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fdepx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Function to check if ObjectId is valid
const isValidObjectId = id => ObjectId.isValid(id);

// Run function to handle database operations
async function run() {
  try {
    await client.connect();
    console.log(' Connected to MongoDB');

    const database = client.db('TaskFlow');
    const taskCollection = database.collection('tasks');
    const usersCollection = database.collection('users');

    const changeStream = taskCollection.watch();

    // Stream for real-time updates

    changeStream.on('change', change => {
      if (!change || !change.operationType) return;

      console.log('Change detected:', change);

      if (change.operationType === 'insert') {
        io.emit('task-added', {
          message: 'A new task was added!',
          data: change.fullDocument,
        });
      } else if (change.operationType === 'update') {
        io.emit('task-updated', {
          message: 'A task was updated!',
          data: change.fullDocument,
        });
      } else if (change.operationType === 'delete') {
        io.emit('task-deleted', {
          message: 'A task was deleted!',
          data: { _id: change.documentKey._id },
        });
      } else {
        console.log('Unknown operation:', change.operationType);
      }
    });

    // 🔹 **Socket.io: Handle Real-Time Connections**
    io.on('connection', socket => {
      console.log(' A user connected');

      // Emit welcome message
      socket.emit('welcome', 'Welcome to the task manager!');

      // Handle disconnect event
      socket.on('disconnect', () => {
        console.log(' User disconnected');
      });
    });

    app.post('/usersInfo', async (req, res) => {
      const users = req.body;
      let userEmail = users.email;
      let q = { email: userEmail };

      try {
        let findUser = await usersCollection.findOne(q);

        if (findUser) {
          res.send('User already registered');
        } else {
          const result = await usersCollection.insertOne(users);
          res.send(result);
        }
      } catch (err) {
        console.log('Error:', err.message);
        res.status(500).send('Internal Server Error');
      }
    });

    app.get('/task', async (req, res) => {
      try {
        const result = await taskCollection
          .find()
          .sort({ index: 1 }) // First sort by index, then by creation date
          .toArray();

        // Ensure the correct order and return to client
        res.send(result);
      } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });

    // 🔹 **POST: Add New Task**
    app.post('/task', async (req, res) => {
      try {
        const task = req.body;
        task.createdAt = new Date(); // Add creation date
        const result = await taskCollection.insertOne(task);
        io.emit('taskCreated', task); // Notify all clients
        res.send(result);
      } catch (error) {
        console.error('Error adding task:', error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });

    // 🔹 **PUT: Update Task (Category, Title, etc.)**
    app.put('/task/:id', async (req, res) => {
      const id = req.params.id;
      // console.log('id',id);
      console.log('body', req.body, 'id', id);

      if (!isValidObjectId(id)) {
        return res.status(400).send({ message: 'Invalid task ID' });
      }

      try {
        const updatedTask = req.body;
        const query = { _id: new ObjectId(id) };
        const updateDoc = { $set: updatedTask };

        const result = await taskCollection.updateOne(query, updateDoc);

        // If no task was updated, return a 404 error
        if (result.modifiedCount === 0) {
          return res.status(404).send({ message: 'Task not found' });
        }

        // Fetch updated task to emit full updated data
        const updatedData = await taskCollection.findOne(query);
        io.emit('taskUpdated', updatedData); // Notify all clients

        res.send(updatedData);
      } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });

    // 🔹 **PUT: Update Task Position (Category, Index) for Drag & Drop with Unique Index**
    app.put('/task/reorder/:id', async (req, res) => {
      const id = req.params.id;
      const { category, index } = req.body;

      // Validate ObjectId
      if (!isValidObjectId(id)) {
        return res.status(400).send({ message: 'Invalid task ID' });
      }

      try {
        const query = { _id: new ObjectId(id) };

        // Fetch current task to get category and index before the update
        const currentTask = await taskCollection.findOne(query);

        if (!currentTask) {
          return res.status(404).send({ message: 'Task not found' });
        }

        // Step 1: Check if the index already exists in the category
        const existingTask = await taskCollection.findOne({
          category: category,
          index: index,
        });

        // If index already exists, increment it
        if (existingTask) {
          // Increment all subsequent tasks' indices to avoid duplicates
          await taskCollection.updateMany(
            { category: category, index: { $gte: index } },
            { $inc: { index: 1 } }
          );
        }

        // Step 2: Update the current task with the new index and category
        const updateDoc = { $set: { category: category, index: index } };
        await taskCollection.updateOne(query, updateDoc);

        // Step 3: Emit changes via socket to update client in real-time
        io.emit('taskReordered', { id, category, index });

        // Send back updated task
        res.send({ message: 'Task reordered successfully' });
      } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });

    // 🔹 **DELETE: Remove Task**
    app.delete('/task/:id', async (req, res) => {
      const id = req.params.id;

      if (!isValidObjectId(id)) {
        return res.status(400).send({ message: 'Invalid task ID' });
      }

      try {
        const query = { _id: new ObjectId(id) };
        const result = await taskCollection.deleteOne(query);

        if (result.deletedCount === 0) {
          return res.status(404).send({ message: 'Task not found' });
        }

        io.emit('taskDeleted', id); // Notify clients about deletion
        res.send({ message: 'Task deleted successfully' });
      } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });
  } catch (error) {
    console.error('Error during MongoDB operation:', error);
    process.exit(1); // Exit the process if DB connection fails
  } finally {
    // Keep MongoDB connection open
    // await client.close();
  }
}

run().catch(console.dir);

// Basic route
app.get('/', (req, res) => {
  res.send(' taskFlow server is running..');
});

// Start server
server.listen(port, () => {
  console.log(`taskFlow running on port ${port}`);
});
