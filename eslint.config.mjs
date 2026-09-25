import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import minecraftLinting from "eslint-plugin-minecraft-linting";

const betafiedBedrockPlugin = {
  rules: {
    "require-js-extension": {
      meta: {
        type: "problem",
        docs: {
          description: "Enforce .js extension on relative imports for Minecraft Bedrock runtime compatibility",
        },
        fixable: "code",
        schema: [],
        messages: {
          missingExtension: "Relative import '{{source}}' must end with '.js' for Minecraft Bedrock runtime compatibility.",
        },
      },
      create(context) {
        function checkSource(sourceNode) {
          if (!sourceNode || typeof sourceNode.value !== "string") return;
          const val = sourceNode.value;
          if (val.startsWith("./") || val.startsWith("../")) {
            if (!val.endsWith(".js") && !val.endsWith(".json")) {
              context.report({
                node: sourceNode,
                messageId: "missingExtension",
                data: { source: val },
                fix(fixer) {
                  return fixer.replaceText(sourceNode, `"${val}.js"`);
                },
              });
            }
          }
        }
        return {
          ImportDeclaration(node) {
            checkSource(node.source);
          },
          ExportNamedDeclaration(node) {
            if (node.source) checkSource(node.source);
          },
          ExportAllDeclaration(node) {
            if (node.source) checkSource(node.source);
          },
        };
      },
    },
  },
};

export default tseslint.config(
  {
    ignores: ["node_modules/**", "packs/data/**", "build/**", ".regolith/**", "scripts/**"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["packs/BP/scripts/**/*.ts"],
    plugins: {
      "minecraft-linting": minecraftLinting,
      betafied: betafiedBedrockPlugin,
    },
    rules: {
      "minecraft-linting/avoid-unnecessary-command": "error",
      "betafied/require-js-extension": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-explicit-any": "warn",
      "no-restricted-globals": [
        "error",
        {
          name: "setTimeout",
          message: "Use system.runTimeout() from @minecraft/server instead of setTimeout in Minecraft Bedrock.",
        },
        {
          name: "setInterval",
          message: "Use system.runInterval() from @minecraft/server instead of setInterval in Minecraft Bedrock.",
        },
        {
          name: "clearTimeout",
          message: "Use system.clearRun() from @minecraft/server instead of clearTimeout in Minecraft Bedrock.",
        },
        {
          name: "clearInterval",
          message: "Use system.clearRun() from @minecraft/server instead of clearInterval in Minecraft Bedrock.",
        },
        {
          name: "window",
          message: "Browser globals do not exist in Minecraft Bedrock QuickJS runtime.",
        },
        {
          name: "document",
          message: "Browser globals do not exist in Minecraft Bedrock QuickJS runtime.",
        },
        {
          name: "fetch",
          message: "fetch does not exist in Minecraft Bedrock QuickJS runtime.",
        },
        {
          name: "process",
          message: "Node.js process does not exist in Minecraft Bedrock QuickJS runtime.",
        },
        {
          name: "Buffer",
          message: "Node.js Buffer does not exist in Minecraft Bedrock QuickJS runtime.",
        },
      ],
    },
  },
);
