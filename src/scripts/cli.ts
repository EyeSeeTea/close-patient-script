import path from "path";
import { run, subcommands } from "cmd-ts";

import * as closePatients from "./commands/patients";

export function runCli() {
    const cliSubcommands = subcommands({
        name: path.basename(__filename),
        cmds: {
            patients: closePatients.getCommand(),
        },
    });

    const args = process.argv.slice(2);
    run(cliSubcommands, args);
}
