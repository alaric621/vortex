import { defineConfig } from "vitest/config";
import * as path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      vscode: path.resolve(__dirname, "tests/__mocks__/vscode.ts")
    }
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // reporters:['dot']
  }
});
