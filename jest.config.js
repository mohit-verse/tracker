module.exports = {
  preset: 'jest-expo',
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
};
