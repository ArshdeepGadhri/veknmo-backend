# Veknmo Backend

This is the backend for the Veknmo utility site, responsible for running the Discord bot verification system, managing authentication tokens, and handling live observer counts via Socket.IO.

## Prerequisites

*   Node.js (18+ recommended)
*   A Discord Developer Application with a Bot Token and the "Server Members Intent" enabled (if you want the bot to fetch user infos or DM users).

## Local Development Setup

1.  **Clone the Repository** and navigate to the backend directory:
    ```bash
    git clone <repository-url>
    cd veknmo-backend
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    ```

3.  **Environment Variables**:
    Create a `.env` file in the root directory and add the following keys. 
    ```env
    JWT_SECRET=your_super_secret_jwt_string
    BOT_TOKEN=your_discord_bot_token
    GUILD_ID=your_discord_server_id
    PORT=3000
    ```
    *   `JWT_SECRET`: A random string used to sign session cookies/tokens for the site.
    *   `BOT_TOKEN`: The token for your Discord bot (obtained from the Discord Developer Portal).
    *   `GUILD_ID`: The ID of your Discord server (used to restrict access or register slash commands).
    *   `PORT`: The port the Express server will run on (defaults to 3000 if not provided).

4.  **Start the Server**:
    ```bash
    npm start
    ```
    The console should output that the Express API is running and the bot has successfully logged in and registered the `/verify` command.

## Self-Hosting on Railway

Railway is an excellent platform for hosting this Node.js backend because it supports long-running processes (essential for the Discord Bot and Socket.IO connections).

### Deployment Steps

1.  **Create a Railway Account**: Sign up at [Railway.app](https://railway.app/).
2.  **New Project**: Click "New Project" and select "Deploy from GitHub repo".
3.  **Select Repository**: Choose the repository containing this backend code.
    * *Note: If this backend is in a monorepo or subfolder, you can specify the Root Directory in the Railway Settings -> General after the initial creation, to point to `veknmo-backend`.*
4.  **Add Environment Variables**: Go to the **Variables** tab for your new service and add the necessary `.env` variables:
    *   `JWT_SECRET`
    *   `BOT_TOKEN`
    *   `GUILD_ID`
    *   *(Note: Railway injects its own `PORT` variable automatically, so you don't need to specify it)*
5.  **Generate a Domain**: Go to the **Settings** tab -> **Environment** -> **Public Networking**, and click **Generate Domain** (or attach a custom domain). This will be the URL your frontend uses to connect to the API.
6.  **Deploy**: Railway will automatically build and deploy your application. Once the build finishes, your backend API, Bot, and Socket.IO server will be fully active!

---
*Note: Make sure your frontend/site's CORS settings in `server.js` (`ALLOWED_ORIGINS`) includes the Vercel domain where you are hosting the site!*
