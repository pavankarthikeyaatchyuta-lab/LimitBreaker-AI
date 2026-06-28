require("./viteSandboxPatch.cjs");

(process.env.VITE_GEMINI_API_KEY ||= process.env.GEMINI_API_KEY || "");

(async () => {
  const { createServer } = await import("vite");
  const hostIndex = process.argv.indexOf("--host");
  const host = hostIndex >= 0 ? process.argv[hostIndex + 1] : "127.0.0.1";
  const server = await createServer({ server: { host } });
  await server.listen();
  server.printUrls();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
