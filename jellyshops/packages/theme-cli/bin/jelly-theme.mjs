#!/usr/bin/env node
import { run } from "../src/cli.mjs";

run(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (error) => {
  console.error(error?.message ?? error);
  process.exitCode = 1;
});
