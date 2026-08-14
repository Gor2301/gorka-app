"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.templateService = exports.TemplateService = exports.PLACEHOLDERS = void 0;
const database_1 = require("../database");
// Define all available placeholders
exports.PLACEHOLDERS = {
    debtor: {
        name: '{{debtor_name}}',
        firstName: '{{debtor_first_name}}',
        phone: '{{debtor_phone}}',
        email: '{{debtor_email}}',
        address: '{{debtor_address}}',
    },
    debt: {
        amount: '{{debt_amount}}',
        currency: '{{debt_currency}}',
        dueDate: '{{debt_due_date}}',
        id: '{{debt_id}}',
        reference: '{{debt_reference}}',
    },
    org: {
        name: '{{organization_name}}',
    },
    collector: {
        name: '{{collector_name}}',
        phone: '{{collector_phone}}',
        email: '{{collector_email}}',
    },
    system: {
        currentDate: '{{current_date}}',
        daysUntilDue: '{{days_until_due}}',
        daysPastDue: '{{days_past_due}}',
        complianceNotice: '{{compliance_notice}}',
    },
};
class TemplateService {
    /**
     * Get a template by name and channel
     */
    async getTemplate(name, channel) {
        return database_1.prisma.template.findFirst({
            where: {
                name,
                channel,
                isActive: true,
            },
        });
    }
    /**
     * Get all templates for a channel
     */
    async getTemplatesByChannel(channel) {
        return database_1.prisma.template.findMany({
            where: {
                channel,
                isActive: true,
            },
            orderBy: { name: 'asc' },
        });
    }
    /**
     * Render template with debtor data
     */
    async renderTemplate(templateName, channel, debtor, context) {
        // Get the template
        const template = await this.getTemplate(templateName, channel);
        if (!template) {
            throw new Error(`Template "${templateName}" not found for channel "${channel}"`);
        }
        // Prepare placeholder values
        const values = await this.getPlaceholderValues(debtor, context);
        // Render content (replace placeholders)
        let content = template.content;
        let subject = template.subject || '';
        // Replace all placeholders
        for (const [key, value] of Object.entries(values)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            content = content.replace(regex, value || '');
            if (subject) {
                subject = subject.replace(regex, value || '');
            }
        }
        // Generate plain text (strip HTML tags)
        const text = content.replace(/<[^>]*>/g, '');
        return {
            subject: subject || 'Message from GORKA',
            html: content,
            text: text,
            metadata: {
                templateName: template.name,
                templateVersion: template.version,
                templateId: template.id,
            },
        };
    }
    /**
     * Get all placeholder values for a debtor
     */
    async getPlaceholderValues(debtor, context) {
        const debt = context.debt || debtor.debts?.[0] || null;
        const daysUntilDue = debt?.dueDate
            ? Math.ceil((new Date(debt.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            : null;
        const daysPastDue = debt?.dueDate
            ? Math.ceil((Date.now() - new Date(debt.dueDate).getTime()) / (1000 * 60 * 60 * 24))
            : null;
        // Jurisdiction compliance notices
        const complianceNotices = {
            uk: 'This is an attempt to collect a debt. Under UK law, you have the right to request verification of this debt.',
            sp: 'Este es un intento de cobro de una deuda. Según la ley española, usted tiene derecho a solicitar la verificación de esta deuda.',
            ph: 'This is an attempt to collect a debt. Under Philippine law, you have the right to request verification of this debt.',
            id: 'Ini adalah upaya untuk menagih hutang. Berdasarkan hukum Indonesia, Anda memiliki hak untuk meminta verifikasi hutang ini.',
        };
        const jurisdiction = context.jurisdiction || 'ph';
        return {
            // Debtor
            'debtor_name': debtor.name || 'Valued Customer',
            'debtor_first_name': debtor.name?.split(' ')[0] || 'Customer',
            'debtor_phone': debtor.phone || 'Not provided',
            'debtor_email': debtor.email || 'Not provided',
            'debtor_address': debtor.address || 'Not provided',
            // Debt
            'debt_amount': debt?.amount
                ? new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: debt.currency || 'USD',
                }).format(debt.amount)
                : 'Not provided',
            'debt_currency': debt?.currency || 'USD',
            'debt_due_date': debt?.dueDate
                ? new Date(debt.dueDate).toLocaleDateString()
                : 'Not set',
            'debt_id': debt?.id || 'Not set',
            'debt_reference': debt?.reference || 'Not set',
            // Organization
            'organization_name': context.organizationName || 'GORKA Collections',
            // Collector
            'collector_name': context.collectorName || 'Your Collector',
            'collector_phone': context.collectorPhone || 'Not provided',
            'collector_email': context.collectorEmail || 'Not provided',
            // System
            'current_date': new Date().toLocaleDateString(),
            'days_until_due': daysUntilDue !== null && daysUntilDue > 0
                ? `${daysUntilDue} days`
                : 'Due today or overdue',
            'days_past_due': daysPastDue && daysPastDue > 0
                ? `${daysPastDue} days`
                : 'Not overdue',
            'compliance_notice': complianceNotices[jurisdiction] || complianceNotices.ph,
            // Custom fields
            ...context.customFields,
        };
    }
    /**
     * Create a new template (Admin only)
     */
    async createTemplate(data) {
        return database_1.prisma.template.create({
            data: {
                name: data.name,
                channel: data.channel,
                subject: data.subject,
                content: data.content,
                category: data.category || 'general',
                description: data.description,
                createdBy: data.createdBy,
                version: 1,
                isActive: true,
            },
        });
    }
    /**
     * Update a template (Admin only)
     */
    async updateTemplate(id, data) {
        // Get current template to increment version
        const current = await database_1.prisma.template.findUnique({ where: { id } });
        if (!current) {
            throw new Error(`Template ${id} not found`);
        }
        return database_1.prisma.template.update({
            where: { id },
            data: {
                ...data,
                version: current.version + 1,
            },
        });
    }
    /**
     * Delete a template (soft delete)
     */
    async deleteTemplate(id) {
        return database_1.prisma.template.update({
            where: { id },
            data: { isActive: false },
        });
    }
    /**
     * Get template by ID
     */
    async getTemplateById(id) {
        return database_1.prisma.template.findUnique({
            where: { id },
        });
    }
}
exports.TemplateService = TemplateService;
exports.templateService = new TemplateService();
