module.exports = {
  root: true,
  env: {
    node: true,
    mocha: true
  },
  extends: [
    'airbnb-typescript/base',
  ],
  rules: {
    '@typescript-eslint/no-empty-function': ['error', { allow: ['constructors'] }],
  },
  parserOptions: {
    project: './tsconfig.json',
  },
};
