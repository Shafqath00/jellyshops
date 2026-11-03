const HELP = `jelly-theme: build a Jelly Shops theme

Usage:
  jelly-theme create <name>        Make a new theme folder with a working starter
  jelly-theme validate [folder]    Check theme.json, starter.json and assets with the platform's rules
  jelly-theme test [folder]        Run the conformance suite (rendering, accessibility, safety)
  jelly-theme dev [folder]         Preview the theme with sample data and edit it live

Options:
  --json         validate: print the issues as JSON
  --port <n>     dev: port for the preview (default 5273)
  --no-open      dev: do not open the browser
  -h, --help     Show this help
`;

export async function run(argv) {
  const [command, ...rest] = argv;
  if (!command || command === "-h" || command === "--help" || command === "help") { process.stdout.write(HELP); return command ? 0 : 2; }
  const flags = {};
  const positional = [];
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === "--port") flags.port = Number(rest[++i]);
    else if (arg.startsWith("--")) flags[arg.slice(2)] = true;
    else positional.push(arg);
  }
  switch (command) {
    case "create": return (await import("./create.mjs")).create(positional[0], flags);
    case "validate": return (await import("./validate.mjs")).validate(positional[0] ?? ".", flags);
    case "test": return (await import("./test.mjs")).test(positional[0] ?? ".", flags);
    case "dev": return (await import("./dev.mjs")).dev(positional[0] ?? ".", flags);
    default:
      process.stderr.write(`Unknown command "${command}".\n\n${HELP}`);
      return 2;
  }
}
