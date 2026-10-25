// rf: the command-line tool the video skills call. Prints one JSON object; exit 1 with {"error"} on failure.
// Usage (inside a project folder, run by the app's Claude job): rf <command> [args]
import { COMMANDS } from '../lib/rf/commands';

const [cmd, ...args] = process.argv.slice(2);

async function main(): Promise<void> {
  const fn = cmd ? COMMANDS[cmd] : undefined;
  if (!fn) throw new Error(`unknown command ${cmd ?? '(none)'}; commands: ${Object.keys(COMMANDS).join(', ')}`);
  process.stdout.write(`${JSON.stringify(await fn(args))}\n`);
}

main().catch((err: Error) => {
  process.stdout.write(`${JSON.stringify({ error: err.message })}\n`);
  process.exit(1);
});
