import path from "path";
import { run, subcommands } from "cmd-ts";

import * as closePatients from "./commands/closePatients";

export function runCli() {
    const cliSubcommands = subcommands({
        name: path.basename(__filename),
        cmds: {
            closePatients: closePatients.getCommand(),
        },
    });

    const args = process.argv.slice(2);
    run(cliSubcommands, args);
}
