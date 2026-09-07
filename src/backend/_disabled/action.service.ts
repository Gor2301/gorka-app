import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';

const prisma = new PrismaClient();

export class ActionService {
  static async createAction(data: {
    debtorId: string;
    type: string;
    title: string;
    description?: string;
    dueDate?: Date;
    assignedTo?: string;
    metadata?: any;
    organizationId: string;
  }) {
    try {
      // First verify debtor belongs to this organization
      const debtor = await prisma.debtor.findFirst({
        where: {
          id: data.debtorId,
          organizationId: data.organizationId,
        },
      });

      if (!debtor) {
        throw new Error('Debtor not found or not in your organization');
      }

      const action = await prisma.action.create({
        data: {
          debtorId: data.debtorId,
          type: data.type,
          title: data.title,
          description: data.description,
          dueDate: data.dueDate,
          assignedTo: data.assignedTo,
          metadata: data.metadata || {},
          status: 'PENDING',
          organizationId: data.organizationId,
        },
        include: {
          debtor: true,
        },
      });

      logger.info(`Action created: ${action.id} - ${action.title}`);
      return action;
    } catch (error) {
      logger.error('Error creating action:', error);
      throw error;
    }
  }

  static async getActions(filters?: {
    debtorId?: string;
    status?: string;
    type?: string;
    assignedTo?: string;
    page?: number;
    limit?: number;
    organizationId?: string;
  }) {
    try {
      const { page = 1, limit = 50, organizationId, ...whereFilters } = filters || {};
      const skip = (page - 1) * limit;

      // Build where clause with organization filter
      const where: any = {};

      if (organizationId) {
        where.organizationId = organizationId;
      }
      if (filters?.debtorId) where.debtorId = filters.debtorId;
      if (filters?.status) where.status = filters.status;
      if (filters?.type) where.type = filters.type;
      if (filters?.assignedTo) where.assignedTo = filters.assignedTo;

      const actions = await prisma.action.findMany({
        where,
        include: {
          debtor: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      });

      const total = await prisma.action.count({ where });

      return {
        actions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Error fetching actions:', error);
      throw error;
    }
  }

  static async getActionById(id: string, organizationId?: string) {
    try {
      const where: any = { id };
      if (organizationId) {
        where.organizationId = organizationId;
      }

      const action = await prisma.action.findFirst({
        where,
        include: {
          debtor: true,
        },
      });

      if (!action) {
        throw new Error(`Action with ID ${id} not found`);
      }

      return action;
    } catch (error) {
      logger.error(`Error fetching action ${id}:`, error);
      throw error;
    }
  }

  static async updateAction(
    id: string,
    data: {
      type?: string;
      status?: string;
      title?: string;
      description?: string;
      dueDate?: Date;
      assignedTo?: string;
      metadata?: any;
      organizationId?: string;
    }
  ) {
    try {
      // First verify action belongs to this organization
      const existing = await prisma.action.findFirst({
        where: {
          id,
          organizationId: data.organizationId,
        },
      });

      if (!existing) {
        throw new Error('Action not found or not in your organization');
      }

      const updateData: any = { ...data };
      delete updateData.organizationId;

      if (data.status === 'COMPLETED') {
        updateData.completedAt = new Date();
      }

      const action = await prisma.action.update({
        where: { id },
        data: updateData,
        include: {
          debtor: true,
        },
      });

      logger.info(`Action updated: ${action.id} - ${action.title}`);
      return action;
    } catch (error) {
      logger.error(`Error updating action ${id}:`, error);
      throw error;
    }
  }

  static async deleteAction(id: string, organizationId?: string) {
    try {
      // First verify action belongs to this organization
      const where: any = { id };
      if (organizationId) {
        where.organizationId = organizationId;
      }

      const existing = await prisma.action.findFirst({ where });

      if (!existing) {
        throw new Error('Action not found or not in your organization');
      }

      const action = await prisma.action.delete({
        where: { id },
      });

      logger.info(`Action deleted: ${action.id}`);
      return action;
    } catch (error) {
      logger.error(`Error deleting action ${id}:`, error);
      throw error;
    }
  }

  static async getDebtorActions(debtorId: string, organizationId?: string) {
    try {
      const where: any = { debtorId };
      if (organizationId) {
        where.organizationId = organizationId;
      }

      const actions = await prisma.action.findMany({
        where,
        include: {
          debtor: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return actions;
    } catch (error) {
      logger.error(`Error fetching actions for debtor ${debtorId}:`, error);
      throw error;
    }
  }

  static async getActionStats(organizationId?: string) {
    try {
      const where: any = {};
      if (organizationId) {
        where.organizationId = organizationId;
      }

      const [total, byStatus, byType] = await Promise.all([
        prisma.action.count({ where }),
        prisma.action.groupBy({
          by: ['status'],
          where,
          _count: true,
        }),
        prisma.action.groupBy({
          by: ['type'],
          where,
          _count: true,
        }),
      ]);

      return {
        total,
        byStatus,
        byType,
      };
    } catch (error) {
      logger.error('Error fetching action stats:', error);
      throw error;
    }
  }
}