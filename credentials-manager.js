import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcryptjs';
import { createId } from '@paralleldrive/cuid2';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CREDENTIALS_FILE = path.join(__dirname, 'credential.json');

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
                    role: 'admin',
                    apiKey: null,
                    createdAt: new Date().toISOString()
                }
            ]
        };
        
        await fs.writeFile(CREDENTIALS_FILE, JSON.stringify(initialData, null, 2));
        console.log('✓ Created credential.json with admin user');
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

// Get user by username
async function getUserByUsername(username) {
    const credentials = await readCredentials();
    return credentials.users.find(u => u.username === username);
}

// Get user by API key
async function getUserByApiKey(apiKey) {
    const credentials = await readCredentials();
    return credentials.users.find(u => u.apiKey === apiKey);
}

// Verify password
async function verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
}

// Hash password
async function hashPassword(plainPassword) {
    return await bcrypt.hash(plainPassword, 10);
}

// Create new user (admin only)
async function createUser(username, role = 'user') {
    const credentials = await readCredentials();
    
    // Check if user already exists
    if (credentials.users.find(u => u.username === username)) {
        throw new Error('User already exists');
    }
    
    // Generate random password
    const randomPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
    const hashedPassword = await hashPassword(randomPassword);
    
    const newUser = {
        username,
        password: hashedPassword,
        role,
        apiKey: null,
        createdAt: new Date().toISOString()
    };
    
    credentials.users.push(newUser);
    await writeCredentials(credentials);
    
    return {
        username,
        password: randomPassword, // Return plain password only once
        role
    };
}

// Delete user (admin only, cannot delete self)
async function deleteUser(username, adminUsername) {
    const credentials = await readCredentials();
    
    if (username === adminUsername) {
        throw new Error('Cannot delete your own account');
    }
    
    const userIndex = credentials.users.findIndex(u => u.username === username);
    if (userIndex === -1) {
        throw new Error('User not found');
    }
    
    credentials.users.splice(userIndex, 1);
    await writeCredentials(credentials);
    
    return true;
}

// Change password
async function changePassword(username, oldPassword, newPassword) {
    const credentials = await readCredentials();
    const user = credentials.users.find(u => u.username === username);
    
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
    
    await writeCredentials(credentials);
    return true;
}

// Generate API token
async function generateApiToken(username, password) {
    const credentials = await readCredentials();
    const user = credentials.users.find(u => u.username === username);
    
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
    
    await writeCredentials(credentials);
    return apiKey;
}

// Delete API token
async function deleteApiToken(username, password) {
    const credentials = await readCredentials();
    const user = credentials.users.find(u => u.username === username);
    
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
    
    await writeCredentials(credentials);
    return true;
}

// List all users (admin only)
async function listUsers() {
    const credentials = await readCredentials();
    return credentials.users.map(u => ({
        username: u.username,
        role: u.role,
        hasApiKey: !!u.apiKey,
        createdAt: u.createdAt,
        passwordChangedAt: u.passwordChangedAt
    }));
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
        hasApiKey: !!user.apiKey,
        apiKey: user.apiKey, // Return full API key for display
        createdAt: user.createdAt,
        passwordChangedAt: user.passwordChangedAt,
        apiKeyGeneratedAt: user.apiKeyGeneratedAt
    };
}

export {
    initializeCredentials,
    getUserByUsername,
    getUserByApiKey,
    verifyPassword,
    hashPassword,
    createUser,
    deleteUser,
    changePassword,
    generateApiToken,
    deleteApiToken,
    listUsers,
    getUserInfo
};

