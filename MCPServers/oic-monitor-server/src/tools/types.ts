import { CONFIG } from "../config.js";

export interface ToolContext {
    defaultConfig: typeof CONFIG;
    getAccessToken: (envConfig: any, forceRefresh?: boolean, environment?: string) => Promise<string>;
    fetchWithPagination: (url: string, token: string, params: any, retryOn401?: boolean, environment?: string, envConfig?: any) => Promise<any>;
    fetchSingle: (url: string, token: string, params: any, retryOn401?: boolean, environment?: string, envConfig?: any) => Promise<any>;
}

export interface ToolDefinition {
    name: string;
    description: string;
    schema: any;
    execute: (context: ToolContext, params: any) => Promise<any>;
}

