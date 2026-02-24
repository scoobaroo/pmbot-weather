/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  passWithNoTests: true,
  roots: ['<rootDir>/src'],
  transformIgnorePatterns: [
    'node_modules/(?!(@polymarket)/)',
  ],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.jsx?$': ['ts-jest', { tsconfig: { allowJs: true } }],
  },
};
