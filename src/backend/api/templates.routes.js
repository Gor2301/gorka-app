"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/backend/api/templates.routes.ts
const express_1 = require("express");
const database_1 = require("../database");
const template_service_1 = require("../services/template.service");
const router = (0, express_1.Router)();
// Get all templates
router.get('/', async (req, res) => {
    try {
        const templates = await database_1.prisma.template.findMany({
            orderBy: { name: 'asc' },
        });
        res.json(templates);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch templates' });
    }
});
// Create a new template
router.post('/', async (req, res) => {
    try {
        const { name, channel, subject, content, category, description } = req.body;
        const userId = req.user?.id || 'system';
        if (!name || !channel || !content) {
            return res.status(400).json({ error: 'Name, channel, and content are required' });
        }
        const template = await template_service_1.templateService.createTemplate({
            name,
            channel,
            subject,
            content,
            category: category || 'general',
            description,
            createdBy: userId,
        });
        res.status(201).json(template);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create template' });
    }
});
// Update a template
router.put('/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const { name, subject, content, category, description, isActive } = req.body;
        const template = await template_service_1.templateService.updateTemplate(id, {
            name,
            subject,
            content,
            category,
            description,
            isActive,
        });
        res.json(template);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update template' });
    }
});
// Delete a template (soft delete)
router.delete('/:id', async (req, res) => {
    try {
        const id = req.params.id;
        await template_service_1.templateService.deleteTemplate(id);
        res.status(204).send();
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete template' });
    }
});
exports.default = router;
