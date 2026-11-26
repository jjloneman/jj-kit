import { main } from "./main.ts";

// The action's step runs this file with Node. Setting `process.exitCode`,
// rather than calling `process.exit()`, lets the annotations printed to stdout
// flush before Node exits.
process.exitCode = main(process.env);
