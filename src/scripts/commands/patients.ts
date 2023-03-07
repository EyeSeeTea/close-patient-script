import _ from "lodash";
import { command, string, subcommands, option, optional, flag, number } from "cmd-ts";

import {
    getApiUrlOption,
    getD2Api,
    StringPairsByDashSeparatedByCommas,
    StringPairSeparatedByDash,
    StringsSeparatedByCommas,
} from "scripts/common";
import { TrackerD2Repository } from "data/TrackerD2Repository";
import { ClosePatientsUseCase } from "domain/usecases/ClosePatientsUseCase";
import { ReportExportCsvRepository } from "data/ReportExportCsvRepository";

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
            type: optional(StringsSeparatedByCommas),
            long: "org-units-ids",
            description: "List of organisation units to filter (comma-separated)",
        }),
        startDate: option({
            type: optional(string),
            long: "start-date",
            description: "Start date of period to filter",
        }),
        endDate: option({
            type: optional(string),
            long: "end-date",
            description: "Start date of period to filter",
        }),
        programId: option({
            type: string,
            long: "tracker-program-id",
            description: "Tracker program reference ID",
        }),
        programStagesIds: option({
            type: StringsSeparatedByCommas,
            long: "program-stages-ids",
            description: "List of consultation program stages ID1,ID2[,IDN] (comma-separated)",
        }),
        closureProgramId: option({
            type: string,
            long: "closure-program-id",
            description: "Program stage to be created at closure ID",
        }),
        timeOfReference: option({
            type: number,
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
            type: optional(StringPairSeparatedByDash),
            long: "comments",
            description: "Data element of comments with its associated value DE-Value",
        }),
        saveReportPath: option({
            type: string,
            long: "save-report",
            description: "Save report to CSV file",
        }),
        post: flag({
            long: "post",
            description: "Send payload to DHIS2 API. If not present, shows payload.",
        }),
    },
    handler: async args => {
        const api = getD2Api(args.url);
        const programsRepository = new TrackerD2Repository(api);
        const reportExportRepository = new ReportExportCsvRepository();

        new ClosePatientsUseCase(programsRepository, reportExportRepository).execute(_.omit(args, ["url"]));
    },
});
