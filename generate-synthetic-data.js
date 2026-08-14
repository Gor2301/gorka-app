const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5433,
  database: 'gorka',
  user: 'postgres',
  password: 'postgres'
});

// Realistic name lists
const firstNames = [
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
  'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa',
  'Matthew', 'Betty', 'Anthony', 'Helen', 'Mark', 'Sandra', 'Donald', 'Donna',
  'Steven', 'Carol', 'Paul', 'Ruth', 'Andrew', 'Sharon', 'Joshua', 'Michelle',
  'Kenneth', 'Laura', 'Kevin', 'Sarah', 'Brian', 'Kimberly', 'George', 'Deborah'
];

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker',
  'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill',
  'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell'
];

const cities = [
  'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia',
  'San Antonio', 'San Diego', 'Dallas', 'Austin', 'Jacksonville', 'Fort Worth',
  'Columbus', 'Charlotte', 'San Francisco', 'Indianapolis', 'Seattle', 'Denver',
  'Washington DC', 'Boston', 'Nashville', 'Portland', 'Las Vegas', 'Miami',
  'Atlanta', 'Kansas City', 'Cleveland', 'New Orleans', 'St Louis', 'Pittsburgh'
];

const countries = ['USA', 'USA', 'USA', 'USA', 'USA', 'Canada', 'UK', 'Spain', 'Mexico'];

const debtTypes = [
  'Credit Card', 'Mortgage', 'Medical Bill', 'Personal Loan', 'Auto Loan',
  'Student Loan', 'Business Loan', 'Tax Debt', 'Utility Bill', 'Rent Arrears'
];

const statuses = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'OVERDUE', 'OVERDUE', 'DISPUTED', 'PARTIAL'];

const contactTypes = ['phone', 'phone', 'phone', 'email', 'email', 'address'];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function randomDate(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - randomInt(0, daysAgo));
  return date.toISOString().split('T')[0];
}

async function generateSyntheticData() {
  await client.connect();
  console.log('✅ Connected to PostgreSQL');

  // Get organization ID
  const orgResult = await client.query('SELECT id FROM "Organization" LIMIT 1');
  if (orgResult.rows.length === 0) {
    console.log('❌ No organization found. Please register first.');
    await client.end();
    return;
  }
  const organizationId = orgResult.rows[0].id;
  console.log(`📋 Organization ID: ${organizationId}`);

  let debtorsAdded = 0;
  let debtsAdded = 0;
  let contactsAdded = 0;

  // Generate 50 synthetic debtors
  const numDebtors = 50;

  console.log(`\n🚀 Generating ${numDebtors} synthetic debtors...`);

  for (let i = 0; i < numDebtors; i++) {
    const firstName = randomItem(firstNames);
    const lastName = randomItem(lastNames);
    const city = randomItem(cities);
    const country = randomItem(countries);
    const phone = `+1${String(randomInt(2000000000, 9999999999)).padStart(10, '0')}`;
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randomInt(1, 99)}@example.com`;
    const address = `${randomInt(100, 9999)} ${randomItem(['Main', 'Oak', 'Pine', 'Maple', 'Cedar', 'Elm', 'Washington', 'Jefferson', 'Lincoln', 'Adams'])} St`;

    // Insert debtor
    const debtorResult = await client.query(`
      INSERT INTO "Debtor" 
        ("firstName", "lastName", "phone", "email", "address", "city", "country", "organizationId")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [firstName, lastName, phone, email, address, city, country, organizationId]);

    const debtorId = debtorResult.rows[0].id;
    debtorsAdded++;

    // Add 1-3 debts per debtor
    const numDebts = randomInt(1, 3);
    let totalDebt = 0;

    for (let j = 0; j < numDebts; j++) {
      const amount = randomFloat(100, 50000);
      const debtType = randomItem(debtTypes);
      const status = randomItem(statuses);
      const dueDate = randomDate(365);

      await client.query(`
        INSERT INTO "Debt" 
          ("amount", "currency", "description", "debtorId", "status", "dueDate")
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [amount, 'USD', debtType, debtorId, status, dueDate]);

      debtsAdded++;
      totalDebt += amount;
    }

    // Add 1-3 contacts per debtor
    const numContacts = randomInt(1, 3);

    for (let j = 0; j < numContacts; j++) {
      const contactType = randomItem(contactTypes);
      let value;

      if (contactType === 'phone') {
        value = `+1${String(randomInt(2000000000, 9999999999)).padStart(10, '0')}`;
      } else if (contactType === 'email') {
        value = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randomInt(1, 999)}@${randomItem(['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'protonmail.com'])}`;
      } else {
        value = `${randomInt(100, 9999)} ${randomItem(['Main', 'Oak', 'Pine', 'Maple', 'Cedar', 'Elm', 'Washington', 'Jefferson', 'Lincoln', 'Adams'])} St, ${city}, ${country}`;
      }

      const source = randomItem(['internal', 'manual', 'credit_bureau']);
      const priority = randomInt(30, 90);

      await client.query(`
        INSERT INTO "Contact" 
          ("debtorId", "contactType", value, source, priority)
        VALUES ($1, $2, $3, $4, $5)
      `, [debtorId, contactType, value, source, priority]);

      contactsAdded++;
    }

    // Progress indicator
    if ((i + 1) % 10 === 0) {
      console.log(`  ✓ Generated ${i + 1}/${numDebtors} debtors...`);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`  ✅ ${debtorsAdded} debtors added`);
  console.log(`  ✅ ${debtsAdded} debts added`);
  console.log(`  ✅ ${contactsAdded} contacts added`);

  // Add a few actions for the Action Center
  console.log(`\n🔧 Generating actions...`);

  const debtorsResult = await client.query('SELECT id, "firstName", "lastName" FROM "Debtor" LIMIT 10');
  let actionsAdded = 0;

  for (const debtor of debtorsResult.rows) {
    const actionTypes = ['CALL', 'EMAIL', 'SMS', 'REVIEW'];
    const descriptions = [
      'Follow up on overdue payment',
      'Send payment reminder',
      'Review account status',
      'Contact debtor for payment plan',
      'Verify contact information',
      'Send settlement offer',
      'Escalate to supervisor',
      'Send final notice'
    ];

    const numActions = randomInt(0, 2);
    for (let j = 0; j < numActions; j++) {
      const type = randomItem(actionTypes);
      const description = randomItem(descriptions);
      const priority = randomInt(1, 5);
      const status = randomItem(['PENDING', 'PENDING', 'PENDING', 'COMPLETED']);
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + randomInt(1, 14));

      await client.query(`
        INSERT INTO "Action" 
          ("type", "description", "priority", "status", "assignedToId", "debtorId", "dueDate")
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [type, description, priority, status, null, debtor.id, dueDate]);

      actionsAdded++;
    }
  }

  console.log(`  ✅ ${actionsAdded} actions added`);

  // Add some AuditLog entries
  console.log(`\n📝 Generating audit logs...`);

  const userResult = await client.query('SELECT id FROM "User" LIMIT 1');
  if (userResult.rows.length > 0) {
    const userId = userResult.rows[0].id;
    const auditActions = ['LOGIN', 'VIEW_DEBTOR', 'ADD_DEBTOR', 'UPDATE_ACTION', 'EXPORT_DATA', 'IMPORT_DATA'];

    for (let i = 0; i < 20; i++) {
      const action = randomItem(auditActions);
      const details = `User performed ${action} at ${new Date().toISOString()}`;
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - randomInt(0, 30));

      await client.query(`
        INSERT INTO "AuditLog" ("userId", action, details, "createdAt")
        VALUES ($1, $2, $3, $4)
      `, [userId, action, details, createdAt]);
    }
    console.log(`  ✅ 20 audit logs added`);
  }

  console.log(`\n🎉 Synthetic data generation complete!`);
  console.log(`\n📈 Total records created:`);
  console.log(`  🧑 Debtors: ${debtorsAdded}`);
  console.log(`  💰 Debts: ${debtsAdded}`);
  console.log(`  📞 Contacts: ${contactsAdded}`);
  console.log(`  ✅ Actions: ${actionsAdded}`);

  await client.end();
}

generateSyntheticData().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});