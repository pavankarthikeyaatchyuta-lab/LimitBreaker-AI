const childProcess = require("node:child_process");

const originalExec = childProcess.exec;
childProcess.exec = function patchedExec(command, options, callback) {
  if (String(command).trim().toLowerCase() === "net use") {
    const handler = typeof options === "function" ? options : callback;
    if (handler) queueMicrotask(() => handler(null, "", ""));
    return {
      stdout: { on() {} },
      stderr: { on() {} },
      on() {},
      once() {},
      kill() {},
    };
  }

  return originalExec.apply(this, arguments);
};