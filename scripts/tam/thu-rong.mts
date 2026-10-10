import { chat } from "../../server/services/ai.js";
await chat({ task: "sales", viec: "thu_ai", userId: 5, model: "google/gemini-3.7-flash", maxTokens: 20, messages: [{ role: "user", content: "Chào shop" }] });
