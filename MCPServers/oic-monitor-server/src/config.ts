import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables from .env file
// Find the project root (where package.json is located)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Go up from dist/src/config.js to project root (or src/config.ts during development)
const projectRoot = path.resolve(__dirname, '../../');
const envPath = path.join(projectRoot, '.env');

// Load .env file from project root
const result = dotenv.config({ path: envPath });
if (result.error) {
    console.warn(`Warning: Could not load .env file from ${envPath}`);
    console.warn(`Error: ${result.error.message}`);
} else if (result.parsed) {
    console.log(`✓ Loaded .env file from: ${envPath}`);
}

export const CONFIG = {
    clientId: process.env.OIC_CLIENT_ID || "",
    clientSecret: process.env.OIC_CLIENT_SECRET || "",
    scope: process.env.OIC_SCOPE || "",
    tokenUrl: process.env.OIC_TOKEN_URL || "",
    apiBaseUrl: process.env.OIC_API_BASE_URL || "",
    integrationInstance: process.env.OIC_INTEGRATION_INSTANCE || ""
};

if (!CONFIG.clientId || !CONFIG.clientSecret) {
    console.warn("Warning: OIC_CLIENT_ID or OIC_CLIENT_SECRET not set in environment variables.");
}
