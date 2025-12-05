import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcryptjs';
import { createId } from '@paralleldrive/cuid2';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.join(__dirname, '..');
const CREDENTIALS_FILE = path.join(PROJECT_ROOT, 'credential.json');
const TENANTS_FILE = path.join(PROJECT_ROOT, 'tenants.json');
const CREDENTIALS_DIR = path.join(PROJECT_ROOT, 'credentials');

// Initialize credentials file with admin from .env
async function initializeCredentials() {
    try {
        await fs.access(CREDENTIALS_FILE);
        console.log('✓ credential.json file exists');
    } catch (error) {
        // File doesn't exist, create it with admin user from .env
        const adminUsername = process.env.ADMIN_USERNAME || 'admin';
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
        
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        
        const initialData = {
            users: [
                {
                    username: adminUsername,
                    password: hashedPassword,
                    role: 'super_admin',
                    apiKey: null,
                    createdAt: new Date().toISOString()
                }
            ]
        };
        
        await fs.writeFile(CREDENTIALS_FILE, JSON.stringify(initialData, null, 2));
        console.log('✓ Created credential.json with super admin user');
    }
    
    // Initialize tenants.json if it doesn't exist
    try {
        await fs.access(TENANTS_FILE);
        console.log('✓ tenants.json file exists');
    } catch (error) {
        const initialTenants = { tenants: [] };
        await fs.writeFile(TENANTS_FILE, JSON.stringify(initialTenants, null, 2));
        console.log('✓ Created tenants.json');
    }
    
    // Initialize credentials directory if it doesn't exist
    if (!existsSync(CREDENTIALS_DIR)) {
        await fs.mkdir(CREDENTIALS_DIR, { recursive: true });
        console.log('✓ Created credentials directory');
    }
}

// Read credentials file
async function readCredentials() {
    try {
        const data = await fs.readFile(CREDENTIALS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading credentials:', error);
        return { users: [] };
    }
}

// Write credentials file
async function writeCredentials(data) {
    await fs.writeFile(CREDENTIALS_FILE, JSON.stringify(data, null, 2));
}

// Read tenants file
async function readTenants() {
    try {
        const data = await fs.readFile(TENANTS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading tenants:', error);
        return { tenants: [] };
    }
}

// Write tenants file
async function writeTenants(data) {
    await fs.writeFile(TENANTS_FILE, JSON.stringify(data, null, 2));
}

// Read tenant credential file
async function readTenantCredentials(tenantId) {
    const tenantCredFile = path.join(CREDENTIALS_DIR, tenantId, 'credential.json');
    try {
        const data = await fs.readFile(tenantCredFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return { users: [] };
    }
}

// Write tenant credential file
async function writeTenantCredentials(tenantId, data) {
    const tenantCredDir = path.join(CREDENTIALS_DIR, tenantId);
    await fs.mkdir(tenantCredDir, { recursive: true });
    const tenantCredFile = path.join(tenantCredDir, 'credential.json');
    await fs.writeFile(tenantCredFile, JSON.stringify(data, null, 2));
}

// Get user by username (searches all credential files)
async function getUserByUsername(username) {
    // First check root credential.json (super admins)
    const rootCredentials = await readCredentials();
    const rootUser = rootCredentials.users.find(u => u.username === username);
    if (rootUser) {
        return { ...rootUser, tenantId: null };
    }
    
    // Then search all tenant credential files
    const tenants = await readTenants();
    for (const tenant of tenants.tenants) {
        const tenantCreds = await readTenantCredentials(tenant.tenantId);
        const tenantUser = tenantCreds.users.find(u => u.username === username);
        if (tenantUser) {
            return { ...tenantUser, tenantId: tenant.tenantId };
        }
    }
    
    return null;
}

// Get user by API key (searches all credential files)
async function getUserByApiKey(apiKey) {
    // First check root credential.json (super admins)
    const rootCredentials = await readCredentials();
    const rootUser = rootCredentials.users.find(u => u.apiKey === apiKey);
    if (rootUser) {
        return { ...rootUser, tenantId: null };
    }
    
    // Then search all tenant credential files
    const tenants = await readTenants();
    for (const tenant of tenants.tenants) {
        const tenantCreds = await readTenantCredentials(tenant.tenantId);
        const tenantUser = tenantCreds.users.find(u => u.apiKey === apiKey);
        if (tenantUser) {
            return { ...tenantUser, tenantId: tenant.tenantId };
        }
    }
    
    return null;
}

// Verify password
async function verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
}

// Hash password
async function hashPassword(plainPassword) {
    return await bcrypt.hash(plainPassword, 10);
}

// Create new user (tenant-aware)
async function createUser(username, role = 'user', tenantId = null, customPassword = null) {
    // Check if user already exists
    const existingUser = await getUserByUsername(username);
    if (existingUser) {
        throw new Error('User already exists');
    }
    
    // Use custom password if provided, otherwise generate random
    let plainPassword;
    if (customPassword) {
        plainPassword = customPassword;
    } else {
        plainPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
    }
    
    const hashedPassword = await hashPassword(plainPassword);
    
    const newUser = {
        username,
        password: hashedPassword,
        role,
        apiKey: null,
        createdAt: new Date().toISOString()
    };
    
    if (tenantId) {
        // Create user in tenant credential file
        const tenantCreds = await readTenantCredentials(tenantId);
        tenantCreds.users.push(newUser);
        await writeTenantCredentials(tenantId, tenantCreds);
    } else {
        // Create user in root credential.json (super admin)
        const credentials = await readCredentials();
        credentials.users.push(newUser);
        await writeCredentials(credentials);
    }
    
    return {
        username,
        password: plainPassword, // Return plain password only once
        role,
        tenantId
    };
}

// Reset user password (tenant-aware, cannot reset self)
async function resetUserPassword(username, adminUsername, customPassword = null) {
    if (username === adminUsername) {
        throw new Error('Cannot reset your own password');
    }
    
    const user = await getUserByUsername(username);
    if (!user) {
        throw new Error('User not found');
    }
    
    // Use custom password if provided, otherwise generate random password
    let newPassword;
    const isCustomPassword = customPassword !== null && customPassword !== undefined;
    
    if (isCustomPassword) {
        newPassword = customPassword;
    } else {
        // Generate new random password
        newPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
    }
    
    user.password = await hashPassword(newPassword);
    user.passwordResetAt = new Date().toISOString();
    user.passwordResetBy = adminUsername;
    
    if (user.tenantId) {
        // Update in tenant credential file
        const tenantCreds = await readTenantCredentials(user.tenantId);
        const userIndex = tenantCreds.users.findIndex(u => u.username === username);
        if (userIndex !== -1) {
            tenantCreds.users[userIndex] = user;
            await writeTenantCredentials(user.tenantId, tenantCreds);
        }
    } else {
        // Update in root credential.json
        const credentials = await readCredentials();
        const userIndex = credentials.users.findIndex(u => u.username === username);
        if (userIndex !== -1) {
            credentials.users[userIndex] = user;
            await writeCredentials(credentials);
        }
    }
    
    // Only return password if it was auto-generated (for display to admin)
    return isCustomPassword ? null : newPassword;
}

// Delete user (tenant-aware, cannot delete self)
async function deleteUser(username, adminUsername) {
    if (username === adminUsername) {
        throw new Error('Cannot delete your own account');
    }
    
    const user = await getUserByUsername(username);
    if (!user) {
        throw new Error('User not found');
    }
    
    if (user.tenantId) {
        // Delete from tenant credential file
        const tenantCreds = await readTenantCredentials(user.tenantId);
        const userIndex = tenantCreds.users.findIndex(u => u.username === username);
        if (userIndex === -1) {
            throw new Error('User not found');
        }
        tenantCreds.users.splice(userIndex, 1);
        await writeTenantCredentials(user.tenantId, tenantCreds);
    } else {
        // Delete from root credential.json
        const credentials = await readCredentials();
        const userIndex = credentials.users.findIndex(u => u.username === username);
        if (userIndex === -1) {
            throw new Error('User not found');
        }
        credentials.users.splice(userIndex, 1);
        await writeCredentials(credentials);
    }
    
    return true;
}

// Change password (tenant-aware)
async function changePassword(username, oldPassword, newPassword) {
    const user = await getUserByUsername(username);
    
    if (!user) {
        throw new Error('User not found');
    }
    
    // Verify old password
    const isValid = await verifyPassword(oldPassword, user.password);
    if (!isValid) {
        throw new Error('Invalid current password');
    }
    
    // Update password
    user.password = await hashPassword(newPassword);
    user.passwordChangedAt = new Date().toISOString();
    
    if (user.tenantId) {
        // Update in tenant credential file
        const tenantCreds = await readTenantCredentials(user.tenantId);
        const userIndex = tenantCreds.users.findIndex(u => u.username === username);
        if (userIndex !== -1) {
            tenantCreds.users[userIndex] = user;
            await writeTenantCredentials(user.tenantId, tenantCreds);
        }
    } else {
        // Update in root credential.json
        const credentials = await readCredentials();
        const userIndex = credentials.users.findIndex(u => u.username === username);
        if (userIndex !== -1) {
            credentials.users[userIndex] = user;
            await writeCredentials(credentials);
        }
    }
    
    return true;
}

// Generate API token (tenant-aware)
async function generateApiToken(username, password) {
    const user = await getUserByUsername(username);
    
    if (!user) {
        throw new Error('User not found');
    }
    
    // Verify password
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
        throw new Error('Invalid password');
    }
    
    // Generate new API key
    const apiKey = createId();
    user.apiKey = apiKey;
    user.apiKeyGeneratedAt = new Date().toISOString();
    
    if (user.tenantId) {
        // Update in tenant credential file
        const tenantCreds = await readTenantCredentials(user.tenantId);
        const userIndex = tenantCreds.users.findIndex(u => u.username === username);
        if (userIndex !== -1) {
            tenantCreds.users[userIndex] = user;
            await writeTenantCredentials(user.tenantId, tenantCreds);
        }
    } else {
        // Update in root credential.json
        const credentials = await readCredentials();
        const userIndex = credentials.users.findIndex(u => u.username === username);
        if (userIndex !== -1) {
            credentials.users[userIndex] = user;
            await writeCredentials(credentials);
        }
    }
    
    return apiKey;
}

// Delete API token (tenant-aware)
async function deleteApiToken(username, password) {
    const user = await getUserByUsername(username);
    
    if (!user) {
        throw new Error('User not found');
    }
    
    // Verify password
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
        throw new Error('Invalid password');
    }
    
    user.apiKey = null;
    user.apiKeyDeletedAt = new Date().toISOString();
    
    if (user.tenantId) {
        // Update in tenant credential file
        const tenantCreds = await readTenantCredentials(user.tenantId);
        const userIndex = tenantCreds.users.findIndex(u => u.username === username);
        if (userIndex !== -1) {
            tenantCreds.users[userIndex] = user;
            await writeTenantCredentials(user.tenantId, tenantCreds);
        }
    } else {
        // Update in root credential.json
        const credentials = await readCredentials();
        const userIndex = credentials.users.findIndex(u => u.username === username);
        if (userIndex !== -1) {
            credentials.users[userIndex] = user;
            await writeCredentials(credentials);
        }
    }
    
    return true;
}

// List all users (tenant-aware)
async function listUsers(tenantId = null) {
    if (tenantId) {
        // List users for specific tenant
        const tenantCreds = await readTenantCredentials(tenantId);
        return tenantCreds.users.map(u => ({
            username: u.username,
            role: u.role,
            tenantId: tenantId,
            hasApiKey: !!u.apiKey,
            createdAt: u.createdAt,
            passwordChangedAt: u.passwordChangedAt
        }));
    } else {
        // List all users (super admin only)
        const allUsers = [];
        
        // Add super admin users
        const rootCredentials = await readCredentials();
        allUsers.push(...rootCredentials.users.map(u => ({
            username: u.username,
            role: u.role,
            tenantId: null,
            hasApiKey: !!u.apiKey,
            createdAt: u.createdAt,
            passwordChangedAt: u.passwordChangedAt
        })));
        
        // Add tenant users
        const tenants = await readTenants();
        for (const tenant of tenants.tenants) {
            const tenantCreds = await readTenantCredentials(tenant.tenantId);
            allUsers.push(...tenantCreds.users.map(u => ({
                username: u.username,
                role: u.role,
                tenantId: tenant.tenantId,
                hasApiKey: !!u.apiKey,
                createdAt: u.createdAt,
                passwordChangedAt: u.passwordChangedAt
            })));
        }
        
        return allUsers;
    }
}

// Get current user info
async function getUserInfo(username) {
    const user = await getUserByUsername(username);
    if (!user) {
        return null;
    }
    
    return {
        username: user.username,
        role: user.role,
        tenantId: user.tenantId,
        hasApiKey: !!user.apiKey,
        apiKey: user.apiKey, // Return full API key for display
        createdAt: user.createdAt,
        passwordChangedAt: user.passwordChangedAt,
        apiKeyGeneratedAt: user.apiKeyGeneratedAt
    };
}

// Tenant management functions

// Create tenant
async function createTenant(tenantName, createdBy) {
    const tenants = await readTenants();
    
    // Check if tenant name already exists
    if (tenants.tenants.find(t => t.name === tenantName)) {
        throw new Error('Tenant name already exists');
    }
    
    const tenantId = createId();
    const newTenant = {
        tenantId,
        name: tenantName,
        createdAt: new Date().toISOString(),
        createdBy
    };
    
    tenants.tenants.push(newTenant);
    await writeTenants(tenants);
    
    // Create empty credential file for tenant
    await writeTenantCredentials(tenantId, { users: [] });
    
    // Create tenant upload directory
    const uploadsPath = path.join(PROJECT_ROOT, 'uploads', tenantId);
    await fs.mkdir(uploadsPath, { recursive: true });
    
    return newTenant;
}

// Get tenant by ID
async function getTenantById(tenantId) {
    const tenants = await readTenants();
    return tenants.tenants.find(t => t.tenantId === tenantId) || null;
}

// List all tenants
async function listTenants() {
    const tenants = await readTenants();
    return tenants.tenants;
}

// Update tenant
async function updateTenant(tenantId, updates) {
    const tenants = await readTenants();
    const tenantIndex = tenants.tenants.findIndex(t => t.tenantId === tenantId);
    
    if (tenantIndex === -1) {
        throw new Error('Tenant not found');
    }
    
    tenants.tenants[tenantIndex] = {
        ...tenants.tenants[tenantIndex],
        ...updates,
        updatedAt: new Date().toISOString()
    };
    
    await writeTenants(tenants);
    return tenants.tenants[tenantIndex];
}

// Delete tenant
async function deleteTenant(tenantId) {
    const tenants = await readTenants();
    const tenantIndex = tenants.tenants.findIndex(t => t.tenantId === tenantId);
    
    if (tenantIndex === -1) {
        throw new Error('Tenant not found');
    }
    
    // Check if tenant has users
    const tenantCreds = await readTenantCredentials(tenantId);
    if (tenantCreds.users.length > 0) {
        throw new Error('Cannot delete tenant with existing users. Please delete all users first.');
    }
    
    tenants.tenants.splice(tenantIndex, 1);
    await writeTenants(tenants);
    
    // Delete tenant credential directory
    const tenantCredDir = path.join(CREDENTIALS_DIR, tenantId);
    if (existsSync(tenantCredDir)) {
        await fs.rm(tenantCredDir, { recursive: true, force: true });
    }
    
    return true;
}

// Get users by tenant
async function getUsersByTenant(tenantId) {
    const tenantCreds = await readTenantCredentials(tenantId);
    return tenantCreds.users.map(u => ({
        username: u.username,
        role: u.role,
        tenantId: tenantId,
        hasApiKey: !!u.apiKey,
        createdAt: u.createdAt,
        passwordChangedAt: u.passwordChangedAt
    }));
}

export {
    initializeCredentials,
    getUserByUsername,
    getUserByApiKey,
    verifyPassword,
    hashPassword,
    createUser,
    resetUserPassword,
    deleteUser,
    changePassword,
    generateApiToken,
    deleteApiToken,
    listUsers,
    getUserInfo,
    // Tenant management
    createTenant,
    getTenantById,
    listTenants,
    updateTenant,
    deleteTenant,
    getUsersByTenant
};

