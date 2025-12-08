import os from "os";
import { join } from "path";
import { Command } from "commander";
import { startServer } from "./server.js";
import { VcastState } from "./state.js";
import { parseStream } from "./stream.js";
import { mkdir } from "fs/promises";

async function cmdInit() {
  const state = new VcastState();
  await state.initSkeleton();
  const base = join(os.homedir(), ".vcast");
  const skeleton = [base, join(base, "logs"), join(base, "data")];
  for (const dir of skeleton) {
    await mkdir(dir, { recursive: true });
  }
  console.log(`Initialized config at ${state.configPath}`);
  console.log(`Config directory: ${join(os.homedir(), ".vcast")}`);
}

function tryOpen(url: string) {
  try {
    const platform = process.platform;
    if (platform === "darwin") {
      Bun.spawn(["open", url], { stdout: "ignore", stderr: "ignore" });
    } else if (platform === "win32") {
      Bun.spawn(["powershell", "-Command", `Start-Process '${url}'`], {
        stdout: "ignore",
        stderr: "ignore",
      });
    } else {
      Bun.spawn(["xdg-open", url], { stdout: "ignore", stderr: "ignore" });
    }
  } catch (err) {
    console.error("Unable to open browser automatically", err);
  }
}

function getNetworkAddress(): string | null {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;
    for (const addr of iface) {
      if (addr.family === "IPv4" && !addr.internal) {
        return addr.address;
      }
    }
  }
  return null;
}

async function cmdStart(options: { port: string; host: boolean; open: boolean }) {
  const port = Number(options.port);
  const host = options.host ? "0.0.0.0" : "127.0.0.1";
  const { address } = await startServer({ port, host });

  console.log("Management UI:", `${address}/`);
  console.log("Viewing UI:", `${address}/view.html`);
  console.log("MCP endpoint:", `${address}/mcp`);

  if (options.host) {
    const networkAddress = getNetworkAddress();
    if (networkAddress) {
      console.log("\nNetwork access:");
      console.log(`  Management UI: http://${networkAddress}:${port}/`);
      console.log(`  Viewing UI: http://${networkAddress}:${port}/view.html`);
    }
  }

  if (options.open) {
    tryOpen(`${address}/`);
    tryOpen(`${address}/view.html`);
  }

  // keep the process alive
  await new Promise(() => {});
}

async function cmdAdd(url: string) {
  const state = new VcastState();
  await state.initSkeleton();
  try {
    const parsed = parseStream(url);
    const created = await state.addSource(parsed);
    console.log("Added stream", created);
  } catch (err: any) {
    console.error("Failed to add source:", err?.message || err);
    process.exit(1);
  }
}

async function cmdRemove(id: string) {
  const state = new VcastState();
  await state.initSkeleton();
  await state.removeSource(id);
  console.log(`Removed ${id}`);
}

async function main() {
  const program = new Command();

  program
    .name("vcast")
    .description(
      "Bun-powered local multi-stream caster with CLI, server, management UI, viewer UI, and MCP interface"
    )
    .version("0.1.0");

  program
    .command("init")
    .description("Create ~/.vcast/config.json and skeleton directories")
    .action(cmdInit);

  program
    .command("start")
    .description("Start local server + dashboards")
    .option("--port <number>", "Port number", "3579")
    .option("--host", "Enable network access (bind to 0.0.0.0)")
    .option("--no-open", "Do not open browser automatically")
    .action(cmdStart);

  program.command("add <source>").description("Add a new streaming source").action(cmdAdd);

  program.command("remove <id>").description("Remove a saved source").action(cmdRemove);

  await program.parseAsync(Bun.argv);
}

main();
