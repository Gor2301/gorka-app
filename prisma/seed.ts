import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const organizationId = 'org1';
  
  // Define permissions for each role
  const permissionsMap = {
    SUPER_ADMIN: [
      'VIEW_DEBTORS', 'CREATE_DEBTOR', 'UPDATE_DEBTOR', 'DELETE_DEBTOR',
      'VIEW_AGENTS', 'CREATE_AGENT', 'UPDATE_AGENT', 'DELETE_AGENT',
      'VIEW_AUDIT', 'EXPORT_AUDIT',
      'VIEW_COMPLIANCE', 'VIEW_DATA_FLOW',
      'MANAGE_CONNECTORS', 'VIEW_CONNECTORS',
      'MANAGE_SETTINGS', 'VIEW_SETTINGS',
      'MANAGE_CALENDAR', 'VIEW_CALENDAR'
    ],
    ADMIN: [
      'VIEW_DEBTORS', 'CREATE_DEBTOR', 'UPDATE_DEBTOR',
      'VIEW_AGENTS',
      'VIEW_AUDIT',
      'VIEW_COMPLIANCE', 'VIEW_DATA_FLOW',
      'VIEW_CONNECTORS',
      'VIEW_SETTINGS',
      'VIEW_CALENDAR'
    ],
    AGENT: [
      'VIEW_DEBTORS', 'UPDATE_DEBTOR',
      'VIEW_CALENDAR'
    ],
    USER: []
  };

  // Delete existing permissions for this organization
  await prisma.permissionRole.deleteMany({
    where: { organizationId }
  });

  // Insert new permissions
  for (const [role, permissions] of Object.entries(permissionsMap)) {
    for (const permission of permissions) {
      await prisma.permissionRole.create({
        data: {
          role: role as any,
          permission: permission as any,
          organizationId
        }
      });
    }
  }

  console.log('✅ Permissions seeded successfully!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());