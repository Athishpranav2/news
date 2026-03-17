require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');
const seed = require('./seed');

const timelinesRouter = require('./routes/timelines');
const eventsRouter = require('./routes/events');
const relationshipsRouter = require('./routes/relationships');
const newsRouter = require('./routes/news');
const summarizeRouter = require('./routes/summarize');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.use('/api/timelines', timelinesRouter);
app.use('/api/events', eventsRouter);
app.use('/api/relationships', relationshipsRouter);
app.use('/api/news', newsRouter);
app.use('/api/summarize', summarizeRouter);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Seed example data
seed(db);

app.listen(PORT, () => {
    console.log(`\n🚀 News Timeline Explorer API running on http://localhost:${PORT}\n`);
});
