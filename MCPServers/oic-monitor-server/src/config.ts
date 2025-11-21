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

// Valid environments
const validEnvironments = ['dev', 'qa3', 'prod1', 'prod3'];

// Helper function to get environment-specific variable name
function getEnvVarName(baseName: string, env: string): string {
    return `${baseName}_${env.toUpperCase()}`;
}

// Cache for environment-specific configs
const configCache: Map<string, any> = new Map();

// Function to get config for a specific environment
// Reads from process.env with environment suffix (e.g., OIC_CLIENT_ID_DEV, OIC_CLIENT_ID_QA3)
// Environment must be provided as a parameter - it's not read from ENVIRONMENT env var
export function getConfigForEnvironment(env: string) {
    if (!validEnvironments.includes(env)) {
        throw new Error(`Invalid environment '${env}'. Valid values: ${validEnvironments.join(', ')}. Environment must be provided as a query parameter.`);
    }

    // Check cache first
    if (configCache.has(env)) {
        return configCache.get(env);
    }

    // Build config from environment-specific process.env variables
    // Variables should be named like: OIC_CLIENT_ID_DEV, OIC_CLIENT_SECRET_QA3, etc.
    const envConfig = {
        clientId: process.env[getEnvVarName('OIC_CLIENT_ID', env)] || "",
        clientSecret: process.env[getEnvVarName('OIC_CLIENT_SECRET', env)] || "",
        scope: process.env[getEnvVarName('OIC_SCOPE', env)] || "",
        tokenUrl: process.env[getEnvVarName('OIC_TOKEN_URL', env)] || "",
        apiBaseUrl: process.env[getEnvVarName('OIC_API_BASE_URL', env)] || "",
        integrationInstance: process.env[getEnvVarName('OIC_INTEGRATION_INSTANCE', env)] || ""
    };

    // Cache the config
    configCache.set(env, envConfig);
    
    if (!envConfig.clientId || !envConfig.clientSecret) {
        console.warn(`Warning: OIC_CLIENT_ID_${env.toUpperCase()} or OIC_CLIENT_SECRET_${env.toUpperCase()} not set in environment variables.`);
    }
    
    return envConfig;
}

// Default config - will be set when first tool call is made with an environment parameter
// For backward compatibility with other tools that don't use environment parameter,
// we'll use 'dev' as fallback, but monitoringInstances tool requires environment parameter
export const CONFIG = {
    clientId: process.env[getEnvVarName('OIC_CLIENT_ID', 'dev')] || "",
    clientSecret: process.env[getEnvVarName('OIC_CLIENT_SECRET', 'dev')] || "",
    scope: process.env[getEnvVarName('OIC_SCOPE', 'dev')] || "",
    tokenUrl: process.env[getEnvVarName('OIC_TOKEN_URL', 'dev')] || "",
    apiBaseUrl: process.env[getEnvVarName('OIC_API_BASE_URL', 'dev')] || "",
    integrationInstance: process.env[getEnvVarName('OIC_INTEGRATION_INSTANCE', 'dev')] || ""
};
