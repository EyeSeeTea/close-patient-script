import _ from "lodash";
import { command, string, subcommands, option, optional, flag } from "cmd-ts";

import {
    getApiUrlOption,
    getD2Api,
    StringPairsByDashSeparatedByCommas,
    StringPairSeparatedByDash,
    StringsSeparatedByCommas,
} from "scripts/common";
import { ProgramsD2Repository } from "data/ProgramsD2Repository";
import { ClosePatientsUseCase } from "domain/usecases/ClosePatientsUseCase";

export function getCommand() {
    return subcommands({
        name: "patients",
        cmds: { close: closePatientsCmd },
    });
}

const closePatientsCmd = command({
    name: "close-patients",
    description: 'Close the patients when the "lost to follow-up" conditions of a tracker program are met',
    args: {
        url: getApiUrlOption(),
        orgUnitsIds: option({
            //or all if not defined
            type: optional(StringsSeparatedByCommas),
            long: "org-units-ids",
            description: "List of organisation units to filter (comma-separated)",
        }),
        period: option({
            //or all if not defined filter in relation to enrollments and take all the data associated to the enrollments to guarantee data completeness)
            type: optional(StringPairSeparatedByDash), //what format should follow?
            long: "period",
            description: "Start date and end date (dash-separated)",
        }),
        programId: option({
            type: string,
            long: "tracker-program-id",
            description: "Tracker program reference ID",
        }),
        programStageIds: option({
            type: StringsSeparatedByCommas,
            long: "program-stage-ids",
            description: "List of consultation program stages ID1,ID2[,IDN] (comma-separated)",
        }),
        closureProgramId: option({
            type: string,
            long: "closure-program-id",
            description: "Program stage to be created at closure ID",
        }),
        timeOfReference: option({
            type: string,
            long: "time-of-reference",
            description: "Time, in days, to consider a patient lost to follow-up ",
        }),
        pairsDeValue: option({
            type: StringPairsByDashSeparatedByCommas,
            long: "pairs-de-value",
            description:
                "Data elements that need to be filled out at closure and their associated values DE1-Value1,DE2-Value2[,DE3-Value3]",
        }),
        comments: option({
            type: string,
            long: "comments",
            description: "Text string to include in comments",
        }),
    },
    handler: async args => {
        if (_.isEmpty(args.programStageIds)) throw new Error("Missing program stages IDs");
        if (_.isEmpty(args.pairsDeValue)) throw new Error("Missing program stages IDs");
        const api = getD2Api(args.url);
        const programsRepository = new ProgramsD2Repository(api);
        new ClosePatientsUseCase(programsRepository).execute(_.omit(args, ["url"]));
        return;
    },
});
