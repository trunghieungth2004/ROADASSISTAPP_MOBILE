module.exports = {
  preset: "jest-expo",
  testMatch: ["<rootDir>/test/**/*.test.ts?(x)"],
  testTimeout: 15000,
  maxWorkers: "50%",
  workerIdleMemoryLimit: "512MB",
  setupFiles: ["<rootDir>/test/setup.ts"],
  setupFilesAfterEnv: ["<rootDir>/test/setupAfterEnv.ts"],
};
