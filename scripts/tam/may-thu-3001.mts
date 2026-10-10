// Bản ứng dụng web KHÔNG có tiến trình nền, để thử tấn công mà không đụng khách thật.
import { createApp } from "../../server/app.js";
const app = await createApp();
app.listen(3001, "127.0.0.1", () => console.log("SAN-SANG 3001"));
