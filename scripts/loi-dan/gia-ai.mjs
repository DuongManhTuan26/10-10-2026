/**
 * AI GIẢ: giữ nguyên mọi hàm của services/ai.ts (nạp bản gốc qua "?goc"), chỉ thay chat / chatJson bằng bản GHI LẠI lời
 * gọi rồi trả kết quả rỗng — không gọi mạng.
 */
export * from "../../server/services/ai.ts?goc";
export async function chatJson(o) {
  (globalThis.__loiGoiAi ??= []).push({ task: o.task, viec: o.viec, temperature: o.temperature, maxTokens: o.maxTokens, messages: o.messages });
  return { output: o.validate ? o.validate({}) : {}, model: "gia", usage: { costUsd: 0 } };
}
export async function chat(o) {
  (globalThis.__loiGoiAi ??= []).push({ task: o.task, viec: o.viec, temperature: o.temperature, maxTokens: o.maxTokens, messages: o.messages });
  return { output: "", model: "gia", usage: { costUsd: 0 } };
}
