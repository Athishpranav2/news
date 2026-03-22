const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const router = express.Router();

// GET all timelines for this user
router.get('/', (req, res) => {
    const userId = req.headers['x-user-id'] || '';
    const timelines = db.prepare('SELECT * FROM timelines WHERE user_id = ? ORDER BY created_at DESC').all(userId);
    res.json(timelines);
});

// GET single timeline (scoped to user)
router.get('/:id', (req, res) => {
    const userId = req.headers['x-user-id'] || '';
    const timeline = db.prepare('SELECT * FROM timelines WHERE id = ? AND user_id = ?').get(req.params.id, userId);
    if (!timeline) return res.status(404).json({ error: 'Timeline not found' });
    res.json(timeline);
});

// POST create timeline
router.post('/', (req, res) => {
    const { title, topic } = req.body;
    const userId = req.headers['x-user-id'] || '';
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const id = uuidv4();
    db.prepare('INSERT INTO timelines (id, title, topic, user_id) VALUES (?, ?, ?, ?)').run(id, title, topic || '', userId);

    const timeline = db.prepare('SELECT * FROM timelines WHERE id = ?').get(id);
    res.status(201).json(timeline);
});

// PUT update timeline
router.put('/:id', (req, res) => {
    const { title, topic } = req.body;
    const userId = req.headers['x-user-id'] || '';
    db.prepare('UPDATE timelines SET title = COALESCE(?, title), topic = COALESCE(?, topic) WHERE id = ? AND user_id = ?')
        .run(title, topic, req.params.id, userId);

    const timeline = db.prepare('SELECT * FROM timelines WHERE id = ? AND user_id = ?').get(req.params.id, userId);
    if (!timeline) return res.status(404).json({ error: 'Timeline not found' });
    res.json(timeline);
});

// DELETE timeline (scoped to user)
router.delete('/:id', (req, res) => {
    const userId = req.headers['x-user-id'] || '';
    const result = db.prepare('DELETE FROM timelines WHERE id = ? AND user_id = ?').run(req.params.id, userId);
    if (result.changes === 0) return res.status(404).json({ error: 'Timeline not found' });
    res.json({ success: true });
});

module.exports = router;
