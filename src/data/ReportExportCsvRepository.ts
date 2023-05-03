import * as CsvWriter from "csv-writer";
import _ from "lodash";
import { Async } from "domain/entities/Async";
import {
    ReportExportRepository,
    ReportExportSaveErrorsOptions,
    ReportExportSaveOptions,
    ReportExportSaveStatsOptions,
} from "domain/repositories/ReportExportRepository";
import log from "utils/log";
import { Report } from "./TrackerD2Repository";

export class ReportExportCsvRepository implements ReportExportRepository {
    async save(options: ReportExportSaveOptions): Async<void> {
        const { entities, conflictEntities, outputPath: reportPath, programId } = options;
        const createCsvWriter = CsvWriter.createObjectCsvWriter;
        const csvHeader = _.map(headers, (obj, key) => ({ id: key, ...obj }));
        const csvWriter = createCsvWriter({ path: reportPath, header: csvHeader });

        const records = entities.map((entity): Row => {
            return {
                programId: programId,
                trackedEntityId: entity.trackedEntity,
                orgUnitId: entity.orgUnit,
                status: "READY",
                comments: "",
            };
        });

        const conflictRecords = conflictEntities.map((entity): Row => {
            return {
                programId: programId,
                trackedEntityId: entity.trackedEntity,
                orgUnitId: entity.orgUnit,
                status: "READY",
                comments: "COMPLETED WITHOUT CLOSURE",
            };
        });

        await csvWriter.writeRecords([...records, ...conflictRecords]);
    }

    async saveErrors(options: ReportExportSaveErrorsOptions): Async<void> {
        const { validationReport, outputPath: reportPath, payload } = options;
        const createCsvWriter = CsvWriter.createObjectCsvWriter;
        const csvHeader = _.map(errorsHeaders, (obj, key) => ({ id: key, ...obj }));
        const csvWriter = createCsvWriter({
            path: `${reportPath.split(".csv")[0]}-stats.csv`,
            header: csvHeader,
        });

        const mapRecord = (report: Report<"ENROLLMENT" | "EVENT" | "RELATIONSHIP" | "TRACKED_ENTITY">) => {
            const te =
                report.trackerType === "ENROLLMENT"
                    ? payload.enrollments.find(enrollment => enrollment.enrollment === report.uid)
                    : undefined;

            return {
                trackedEntity: te?.trackedEntity,
                program: te?.program,
                orgUnit: te?.orgUnit,
                uid: report.uid,
                trackerType: report.trackerType,
                type: "ERROR",
                message: report.message,
            };
        };

        const errors =
            validationReport.errorReports?.map(report => ({
                ...mapRecord(report),
                code: report.errorCode,
            })) ?? [];

        const warnings =
            validationReport.warningReports?.map(report => ({
                ...mapRecord(report),
                code: report.warningCode,
            })) ?? [];

        await csvWriter.writeRecords([...errors, ...warnings]);
    }

    async saveStats(options: ReportExportSaveStatsOptions): Async<void> {
        const { outputPath: reportPath, bundleReport } = options;
        const csvHeader = _.map(statsHeaders, (obj, key) => ({ id: key, ...obj }));
        const csvWriter = CsvWriter.createObjectCsvWriter({
            path: `${reportPath.split(".csv")[0]}-stats.csv`,
            header: csvHeader,
        });

        const statsRecord: StatsRow[] = Object.values(bundleReport.typeReportMap)
            .map(typeReport =>
                typeReport.objectReports.map(objReport => ({
                    uid: objReport.uid,
                    type: objReport.trackerType,
                    errorCodes: objReport.errorReports.map(r => r.errorCode).join(", "),
                    messages: objReport.errorReports.map(r => r.message).join(", "),
                }))
            )
            .flat(10);

        await csvWriter.writeRecords(statsRecord);
    }
}

type Attr = "programId" | "trackedEntityId" | "orgUnitId" | "status" | "comments";
type StatsAttr = "uid" | "type";
type ErrorsAttr =
    | "trackedEntity"
    | "program"
    | "orgUnit"
    | "uid"
    | "trackerType"
    | "message"
    | "type"
    | "code";
type Row = Record<Attr, string>;
type StatsRow = Record<StatsAttr, string>;

const headers: Record<Attr, { title: string }> = {
    programId: { title: "Program ID" },
    trackedEntityId: { title: "Tracked Entity ID" },
    orgUnitId: { title: "Org Unit ID" },
    status: { title: "Status" },
    comments: { title: "Comments" },
};

const errorsHeaders: Record<ErrorsAttr, { title: string }> = {
    trackedEntity: { title: "Tracked Entity ID" },
    program: { title: "Program ID" },
    orgUnit: { title: "Org Unit ID" },
    uid: { title: "UID" },
    trackerType: { title: "Tracker Type" },
    type: { title: "Type" },
    code: { title: "Code" },
    message: { title: "Message" },
};

const statsHeaders: Record<StatsAttr, { title: string }> = {
    uid: { title: "UID" },
    type: { title: "Tracker Type" },
};
