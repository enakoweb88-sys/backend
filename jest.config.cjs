module.exports = { testEnvironment: 'node', testMatch: ['<rootDir>/src/**/*.spec.ts'], transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }] }, maxWorkers: 1, clearMocks: true };
