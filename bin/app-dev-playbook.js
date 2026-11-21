#!/usr/bin/env node
import { main } from '../src/cli.js';

main(process.argv.slice(2)).catch((err) => {
  console.error(`错误: ${err.message}`);
  process.exit(1);
});
