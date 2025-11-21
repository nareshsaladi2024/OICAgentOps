import fs from 'fs';
import path from 'path';
import os from 'os';

interface TokenData {
    accessToken: string;
    expiry: number;
}

export class TokenManager {
    private tokenFilePath: string;

    constructor() {
        // Store token in a hidden file in the user's home directory
        this.tokenFilePath = path.join(os.homedir(), '.oic_mcp_token.json');
    }

    public getToken(): string | null {
        try {
            if (fs.existsSync(this.tokenFilePath)) {
                const data = fs.readFileSync(this.tokenFilePath, 'utf-8');
                const tokenData: TokenData = JSON.parse(data);

                if (Date.now() < tokenData.expiry) {
                    const remainingSeconds = Math.floor((tokenData.expiry - Date.now()) / 1000);
                    return tokenData.accessToken;
                } else {
                    // Token expired, clear it
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
            const expiry = Date.now() + (expiresInSeconds * 1000) - 60000; // Buffer of 60s
            const tokenData: TokenData = {
                accessToken,
                expiry
            };
            fs.writeFileSync(this.tokenFilePath, JSON.stringify(tokenData), 'utf-8');
        } catch (error) {
            console.error("Error saving token file:", error);
        }
    }

    public clearToken() {
        try {
            if (fs.existsSync(this.tokenFilePath)) {
                fs.unlinkSync(this.tokenFilePath);
            }
        } catch (error) {
            console.error("Error clearing token file:", error);
        }
    }
}
