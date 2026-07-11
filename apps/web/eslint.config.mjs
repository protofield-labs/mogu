import next from "eslint-config-next";

/** Component split size guards — formerly in verify-component-splits.ts (#336). */
const splitLineLimits = [
  ["src/components/mypage/spot-form.tsx", 280],
  ["src/components/mypage/friends-view.tsx", 200],
  ["src/components/mypage/mypage-view.tsx", 350],
  ["src/components/search/agent-chat.tsx", 100],
  ["src/lib/agent/use-agent-chat.ts", 150],
] ;

const eslintConfig = [
  ...next,
  {
    ignores: [".next/**", "node_modules/**"],
  },
  ...splitLineLimits.map(([file, max]) => ({
    files: [file],
    rules: {
      "max-lines": [
        "error",
        { max, skipBlankLines: false, skipComments: false },
      ],
    },
  })),
];

export default eslintConfig;
