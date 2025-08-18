const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const paymentRoutes = require('./routes/paymentRoutes');

dotenv.config();
connectDB();

const app = express();
const PORT = process.env.PORT || 1337;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('HTLS 2K25 Backend is running!');
});

app.use('/api/payment', paymentRoutes); // This line will now work correctly

app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});