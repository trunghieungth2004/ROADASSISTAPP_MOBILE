module.exports = {
  root: true,
  env: {es2022: true, node: true, jest: true},
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: {jsx: true},
  },
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  ignorePatterns: ["node_modules/", "android/", "ios/", "assets/", ".expo/", "coverage/"],
  rules: {
    "max-lines": ["error", {max: 900, skipBlankLines: true, skipComments: true}],
    "max-lines-per-function": ["error", {max: 500, skipBlankLines: true, skipComments: true}],
    "complexity": ["error", 40],
    "no-empty": "warn",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-require-imports": "off",
    "@typescript-eslint/no-unused-vars": ["warn", {argsIgnorePattern: "^_", varsIgnorePattern: "^_"}],
    "no-undef": "off",
  },
  overrides: [
    {
      files: ["test/**/*.ts", "test/**/*.tsx"],
      rules: {"max-lines": "off", "max-lines-per-function": "off", "complexity": "off", "@typescript-eslint/no-unused-expressions": "off"},
    },
    {
      files: ["src/screens/AssistScreen.tsx", "src/screens/RouteScreen.tsx", "src/screens/NavigationScreen.tsx", "src/screens/assist/RecordDetailSheet.tsx", "src/screens/navigation/useNavTracking.ts", "src/api/dispatch.ts", "src/screens/OnboardingScreen.tsx", "src/screens/assist/useAssistController.tsx", "src/screens/route/useRouteController.tsx", "src/screens/assist/detail/FeesCard.tsx", "src/screens/assist/detail/JourneyCard.tsx", "src/screens/assist/recordActions.ts"],
      rules: {"max-lines": "off", "max-lines-per-function": "off", "complexity": "off", "@typescript-eslint/no-unused-expressions": "off"},
    },
  ],
};
