// Audit-only config: execute embedded/fixture tests without developer service credentials.
export default {
  test: {
    include: ['test/integration/**/*.test.ts'],
    setupFiles: ['./test/unit-environment.ts'],
    maxWorkers: 1,
  },
};
