$path = 'src\backend\index.ts'
$content = Get-Content -Path $path -Raw

# --- Fix imports ---
$oldImports = @"
import authRoutes from './routes/auth';
import supportRoutes from './routes/support.routes';
import statusRoutes from './routes/status';
import auditRoutes from './routes/audit.routes';
import analyticsRoutes from './routes/analytics.routes';
import complianceRoutes from './routes/compliance.routes';
import connectorRoutes from './routes/connector.routes';
import calendarRoutes from './routes/calendar.routes';
import permissionsRoutes from './routes/permissions.routes';
import usersRoutes from './routes/users.routes';
import dashboardRoutes from './routes/dashboard.routes';
import debtorsRoutes from './routes/debtors';
import clientsRoutes from './routes/clients';
"@

$newImports = @"
import authRoutes from './routes/auth';
import supportRoutes from './routes/support.routes';
import dashboardRoutes from './routes/dashboard.routes';
"@

if ($content.Contains($oldImports)) {
    $content = $content.Replace($oldImports, $newImports)
    Write-Host "Imports replaced."
} else {
    Write-Host "IMPORTS: OLD BLOCK NOT FOUND"
}

# --- Fix mounts ---
$oldMounts = @"
app.use('/api/auth', authRoutes);
app.use('/api/support', authenticateToken, supportRoutes);
app.use('/api/status', authenticateToken, statusRoutes);
app.use('/api/audit', authenticateToken, auditRoutes);
app.use('/api/analytics', authenticateToken, analyticsRoutes);
app.use('/api/compliance', authenticateToken, complianceRoutes);
app.use('/api/connectors', authenticateToken, connectorRoutes);
app.use('/api/calendar', authenticateToken, calendarRoutes);
app.use('/api/permissions', authenticateToken, permissionsRoutes);
app.use('/api/users', authenticateToken, usersRoutes);
app.use('/api/dashboard', authenticateToken, dashboardRoutes);
app.use('/api/debtors', authenticateToken, debtorsRoutes);
app.use('/api/clients', authenticateToken, clientsRoutes);
"@

$newMounts = @"
app.use('/api/auth', authRoutes);
app.use('/api/support', authenticateToken, supportRoutes);
app.use('/api/dashboard', authenticateToken, dashboardRoutes);
"@

if ($content.Contains($oldMounts)) {
    $content = $content.Replace($oldMounts, $newMounts)
    Write-Host "Mounts replaced."
} else {
    Write-Host "MOUNTS: OLD BLOCK NOT FOUND"
}

# --- Save ---
Set-Content -Path $path -Value $content -NoNewline
Write-Host "File saved."