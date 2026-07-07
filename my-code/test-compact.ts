import { compactMessages } from "./src/agent/compact.js";
import { resolve } from "node:path";
import fs from "node:fs";

async function runTest() {
  const cwd = process.cwd();
  
  // Create a fake session memory file to test the zero-cost compaction
  const memDirPath = resolve(cwd, ".my-code");
  if (!fs.existsSync(memDirPath)) {
    fs.mkdirSync(memDirPath, { recursive: true });
  }
  fs.writeFileSync(resolve(memDirPath, "session-memory.md"), "Previous Session: We migrated the context engine and it was awesome!");

  console.log("Fake session-memory.md created.");

  const fakeMessages = [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Hello" },
    { role: "assistant", content: "Hi there!" },
    { role: "user", content: "How are you?" },
    { role: "assistant", content: "I am fine." },
    { role: "user", content: "What is 2+2?" },
    { role: "assistant", content: "It is 4." },
  ];

  console.log("Running compaction on 7 messages...");
  
  const result = await compactMessages(fakeMessages, {
    cwd: cwd,
    keepTail: 2 // Keep last 2 messages
  });

  console.log("\n--- COMPACTION RESULT ---");
  console.log(`Summary tokens used: ${result.summaryTokens}`);
  console.log(`Dropped count: ${result.droppedCount}`);
  console.log(`Summary string: ${result.summary}`);
  console.log("\nResulting Messages Array:");
  console.log(JSON.stringify(result.messages, null, 2));

  // Clean up
  fs.unlinkSync(resolve(memDirPath, "session-memory.md"));
}

runTest().catch(console.error);
