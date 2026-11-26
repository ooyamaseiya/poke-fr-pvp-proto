import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // この環境では localhost が ::1 に解決され、devサーバーが
  // IPv6ループバックのみを listen してしまうことがあるため、
  // IPv4/IPv6/外部IP すべてにbindし、ブラウザから必ずアクセスできるようにする。
  server: {
    host: true,
  },
});
