import path from "path";
import { run, subcommands } from "cmd-ts";

import * as programs from "./commands/programs";

export function runCli() {
    const cliSubcommands = subcommands({
        name: path.basename(__filename),
        cmds: {
            programs: programs.getCommand(),
        },
    });

    const args = process.argv.slice(2);
    run(cliSubcommands, args);
}
