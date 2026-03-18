require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const generateCode = () => Array.from({ length: 7 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]).join('');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const BOT_TOKEN = process.env.BOT_TOKEN;
const GUILD_ID = process.env.GUILD_ID;

// ============================================
// 1. EXPRESS SERVER & TOKEN STORE
// ============================================

const ALLOWED_ORIGINS = [
    'https://veknmo.xyz',
    'http://localhost:5173',
];

app.use(cors({
    origin: (origin, callback) => {
        // allow server-to-server / curl (no origin header) and listed origins
        if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
        callback(new Error('Not allowed by CORS'));
    }
}));
app.use(express.json());


// In-memory token store: token -> { userId, username, avatar, expiry }
const tokenStore = new Map();

// Rate limiting on /api/verify
const rateLimiter = new RateLimiterMemory({
    points: 10, // 10 requests
    duration: 60, // per 60 seconds by IP
});

const rateLimiterMiddleware = (req, res, next) => {
    rateLimiter.consume(req.ip)
        .then(() => next())
        .catch(() => res.status(429).json({ error: 'Too Many Requests' }));
};

// API: Verify Token from Frontend
app.post('/api/verify', rateLimiterMiddleware, (req, res) => {
    const { token } = req.body;

    if (!token) return res.status(400).json({ error: 'Token is required' });

    const tokenData = tokenStore.get(token);

    if (!tokenData) return res.status(401).json({ error: 'Invalid token' });

    if (Date.now() > tokenData.expiry) {
        tokenStore.delete(token);
        return res.status(401).json({ error: 'Token expired' });
    }

    // Token is valid, single-use, delete it
    tokenStore.delete(token);

    // Generate authenticated session JWT
    const { userId, username, avatar } = tokenData;
    const sessionToken = jwt.sign(
        { userId, username, avatar },
        JWT_SECRET,
        { expiresIn: '7d' }
    );

    res.json({ token: sessionToken });
});

// Automatic cleanup: every 60 seconds remove expired tokens
setInterval(() => {
    const now = Date.now();
    for (const [token, data] of tokenStore.entries()) {
        if (now > data.expiry) {
            tokenStore.delete(token);
        }
    }
}, 60000);

// API: Get owner profile info (avatars fetched live via bot)
const OWNER_IDS = {
    art:  '170718155772002304',
    vekn: '639557422637252648',
};

app.get('/api/owners', async (req, res) => {
    try {
        const [art, vekn] = await Promise.all([
            client.users.fetch(OWNER_IDS.art,  { force: true }),
            client.users.fetch(OWNER_IDS.vekn, { force: true }),
        ]);
        res.json({
            art:  { username: art.username,  avatar: art.displayAvatarURL({ size: 128, extension: 'webp' }) },
            vekn: { username: vekn.username, avatar: vekn.displayAvatarURL({ size: 128, extension: 'webp' }) },
        });
    } catch (e) {
        console.error('[API] Failed to fetch owner profiles:', e);
        res.status(500).json({ error: 'Could not fetch owner profiles' });
    }
});


// ============================================
// 2. DISCORD BOT LOGIC
// ============================================

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
    {
        name: 'verify',
        description: 'Generates an access code for the website.',
    },
];

const botRateLimits = new Map();

client.once('clientReady', async () => {
    console.log(`[BOT] Logged in as ${client.user.tag}!`);

    if (GUILD_ID && BOT_TOKEN && GUILD_ID !== 'your_discord_server_id' && BOT_TOKEN !== 'your_discord_bot_token') {
        const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
        try {
            await rest.put(
                Routes.applicationGuildCommands(client.user.id, GUILD_ID),
                { body: commands },
            );
            console.log('[BOT] Successfully registered /verify command for guild.');
        } catch (error) {
            console.error('[BOT] Failed to register commands:', error);
        }
    } else {
        console.log('[BOT] GUILD_ID or BOT_TOKEN not properly configured yet. Slash commands not registered.');
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'verify') {
        // Ensure user is in the specific server
        if (interaction.guildId !== GUILD_ID) {
            return interaction.reply({ content: 'This command can only be used in the official server.', ephemeral: true });
        }

        const userId = interaction.user.id;
        const now = Date.now();

        // Rate limiting (10 requests per minute)
        if (!botRateLimits.has(userId)) botRateLimits.set(userId, []);
        const userRequests = botRateLimits.get(userId);
        const validRequests = userRequests.filter(timestamp => now - timestamp < 60000);

        if (validRequests.length >= 10) {
            return interaction.reply({ content: 'You are submitting requests too quickly. Please wait a minute before trying again.', ephemeral: true });
        }

        validRequests.push(now);
        botRateLimits.set(userId, validRequests);

        const tokenString = generateCode();
        const username = interaction.user.username;
        const avatar = interaction.user.avatar || '';

        // Save directly to memory store (No HTTP Roundtrip to self needed!)
        const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
        tokenStore.set(tokenString, { userId, username, avatar, expiry });

        // Try to DM the user first
        try {
            await interaction.user.send(`👻 **Spirit Box Response:**\nYour access code is: \`${tokenString}\`\nValid for 7 days.`);
            await interaction.reply({ content: 'Check your DMs for your access code', ephemeral: true });
        } catch (error) {
            // If DMs are closed
            await interaction.reply({ content: 'Could not send you a DM. Please enable DMs from server members and try again.', ephemeral: true });
        }
    }
});


// ============================================
// 3. START SERVICES
// ============================================

app.listen(PORT, () => {
    console.log(`[SERVER] Express API running on port ${PORT}`);
});

if (BOT_TOKEN && BOT_TOKEN !== 'your_discord_bot_token') {
    client.login(BOT_TOKEN).catch(err => console.error('[BOT] Login failed:', err));
} else {
    console.log('[BOT] Add your BOT_TOKEN and GUILD_ID to .env to start the bot!');
}
