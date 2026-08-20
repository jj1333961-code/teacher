const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");

const html = fs.readFileSync("public/index.html", "utf8");
const re = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
let m, i = 0, fail = 0;

while ((m = re.exec(html))) {
  i++;
  const code = m[1];
  const before = html.slice(0, m.index);
  const line = before.split("\n").length;
  const lines = code.split("\n").length;
  const f = path.join(os.tmpdir(), "chk_" + i + ".js");
  fs.writeFileSync(f, code);
  try {
    execSync("node --check " + f, { stdio: "pipe" });
    console.log("script #" + i + " (line " + line + ", " + lines + " lines): OK");
  } catch (e) {
    fail++;
    console.log("script #" + i + " (line " + line + ", " + lines + " lines): SYNTAX ERROR");
    console.log(String(e.stderr || e.message).split("\n").slice(0, 8).join("\n"));
  }
}
console.log("\nTotal inline scripts: " + i + ", syntax failures: " + fail);
