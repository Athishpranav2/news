const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const router = express.Router();

// GET relationships for a timeline
router.get('/:timelineId', (req, res) => {
    const relationships = db.prepare(
        'SELECT * FROM relationships WHERE timeline_id = ?'
    ).all(req.params.timelineId);
    res.json(relationships);
});

// POST create relationship
router.post('/', (req, res) => {
    const { event_source, event_target, relation_type, timeline_id } = req.body;
    if (!event_source || !event_target || !timeline_id) {
        return res.status(400).json({ error: 'event_source, event_target, and timeline_id are required' });
    }

    const id = uuidv4();
    db.prepare(`
    INSERT INTO relationships (id, event_source, event_target, relation_type, timeline_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, event_source, event_target, relation_type || 'cause', timeline_id);

    const rel = db.prepare('SELECT * FROM relationships WHERE id = ?').get(id);
    res.status(201).json(rel);
});

// DELETE relationship
router.delete('/:id', (req, res) => {
    const result = db.prepare('DELETE FROM relationships WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Relationship not found' });
    res.json({ success: true });
});

module.exports = router;
