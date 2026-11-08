const HELP = `jelly-theme: build a Jelly Shops theme

Usage:
  jelly-theme create <name>        Make a new theme folder with a working starter
  jelly-theme validate [folder]    Check theme.json, starter.json and assets with the platform's rules
  jelly-theme test [folder]        Run the conformance suite (rendering, accessibility, safety)
  jelly-theme dev [folder]         Preview the theme with sample data and edit it live
  jelly-theme package [folder]     Write <id>-<version>.jellytheme.json (to <folder>/dist)
  jelly-theme upload [folder]      Send the theme to the platform (needs --store and --token)
  jelly-theme install <version>    Put an uploaded version on a store's draft

Options:
  --json         validate: print the issues as JSON
  --port <n>     dev: port for the preview (default 5273)
  --out <dir>    package: where to write the file
  --store <id>   upload: the store that owns the theme (or JELLY_STORE_ID)
  --token <t>    upload, install: a developer token from Settings > Developer tokens (or JELLY_TOKEN)
  --api <url>    upload, install: the platform API address (or JELLY_API_URL)
  --replace <n>  install: replace the existing draft (n = the workspace generation)
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
    else if (["--out", "--store", "--token", "--api", "--replace"].includes(arg)) flags[arg.slice(2)] = rest[++i];
    else if (arg.startsWith("--")) flags[arg.slice(2)] = true;
    else positional.push(arg);
  }
  switch (command) {
    case "create": return (await import("./create.mjs")).create(positional[0], flags);
    case "validate": return (await import("./validate.mjs")).validate(positional[0] ?? ".", flags);
    case "test": return (await import("./test.mjs")).test(positional[0] ?? ".", flags);
    case "package": return (await import("./package.mjs")).pack(positional[0] ?? ".", flags);
    case "upload": return (await import("./upload.mjs")).upload(positional[0] ?? ".", flags);
    case "install": return (await import("./upload.mjs")).install(positional[0], flags);
    case "dev": return (await import("./dev.mjs")).dev(positional[0] ?? ".", flags);
    default:
      process.stderr.write(`Unknown command "${command}".\n\n${HELP}`);
      return 2;
  }
}
