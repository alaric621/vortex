export interface VhtEnvVariables {
    [key: string]: unknown;
    name: string;
    client: {
        api: string;
        token: string;
    };
    env: string;
}

export const vhtMockVariables: VhtEnvVariables = {
    name: 'demo-user',
    client: {
        api: 'demo-api-key-123',
        token: 'demo-token'
    },
    env: 'dev'
};
