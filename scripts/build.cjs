require("./viteSandboxPatch.cjs");

(async () => {
  const { build } = await import("vite");
  await build();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});