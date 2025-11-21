import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();

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
