require("./viteSandboxPatch.cjs");

(process.env.VITE_GEMINI_API_KEY ||= process.env.GEMINI_API_KEY || "");

(async () => {
  const { build } = await import("vite");
  await build();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
