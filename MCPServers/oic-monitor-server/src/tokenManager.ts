import fs from 'fs';
import path from 'path';
import os from 'os';

interface TokenData {
    accessToken: string;
    expiry: number;
    environment?: string; // Track which environment this token is for
}

export class TokenManager {
    private tokenFilePath: string;
    private environment: string;

    constructor(environment: string = 'dev') {
        this.environment = environment;
        // Store token in environment-specific files
        // e.g., .oic_mcp_token_dev.json, .oic_mcp_token_prod3.json
        this.tokenFilePath = path.join(os.homedir(), `.oic_mcp_token_${environment}.json`);
    }

    public getToken(): string | null {
        try {
            if (fs.existsSync(this.tokenFilePath)) {
                const data = fs.readFileSync(this.tokenFilePath, 'utf-8');
                const tokenData: TokenData = JSON.parse(data);

                const now = Date.now();
                if (now < tokenData.expiry) {
                    // Token is still valid
                    return tokenData.accessToken;
                } else {
                    // Token has expired, clear it so a new one will be fetched
                    console.log("Cached token has expired. Will fetch a new token on next request.");
                    this.clearToken();
                }
            }
        } catch (error) {
            console.error("Error reading token file:", error);
        }
        return null;
    }

    public getTokenRemainingTime(): number | null {
        try {
            if (fs.existsSync(this.tokenFilePath)) {
                const data = fs.readFileSync(this.tokenFilePath, 'utf-8');
                const tokenData: TokenData = JSON.parse(data);

                if (Date.now() < tokenData.expiry) {
                    return Math.floor((tokenData.expiry - Date.now()) / 1000);
                }
            }
        } catch (error) {
            // Ignore errors
        }
        return null;
    }

    public saveToken(accessToken: string, expiresInSeconds: number) {
        try {
            // Cache token for the full duration (3600 seconds = 1 hour)
            // Subtract 60 seconds buffer to ensure we refresh before actual expiry
            const bufferSeconds = 60;
            const cachedDuration = expiresInSeconds - bufferSeconds;
            const expiry = Date.now() + (expiresInSeconds * 1000) - (bufferSeconds * 1000);
            const tokenData: TokenData = {
                accessToken,
                expiry,
                environment: this.environment // Store environment with token
            };
            fs.writeFileSync(this.tokenFilePath, JSON.stringify(tokenData), 'utf-8');
            const minutes = Math.floor(cachedDuration / 60);
            const seconds = cachedDuration % 60;
            console.log(`Token cached successfully for ${this.environment}. Will be valid for ${minutes}m ${seconds}s (refreshes ${bufferSeconds}s before API expiry)`);
        } catch (error) {
            console.error(`Error saving token file for ${this.environment}:`, error);
        }
    }

    public clearToken(silent: boolean = false) {
        try {
            if (fs.existsSync(this.tokenFilePath)) {
                fs.unlinkSync(this.tokenFilePath);
                if (!silent) {
                    console.log(`✓ Token cache file deleted: ${this.tokenFilePath}`);
                }
            } else {
                if (!silent) {
                    console.log("No token cache file found to delete.");
                }
            }
        } catch (error) {
            console.error("Error clearing token file:", error);
        }
    }
}
