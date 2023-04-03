import * as CsvWriter from "csv-writer";
import _ from "lodash";
import { Async } from "domain/entities/Async";
import {
    ReportExportRepository,
    ReportExportSaveOptions,
    ReportExportSaveStatsOptions,
} from "domain/repositories/ReportExportRepository";

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
            };
        });

        const conflictRecords = conflictEntities.map((entity): Row => {
            return {
                programId: programId,
                trackedEntityId: entity.trackedEntity,
                orgUnitId: entity.orgUnit,
                status: "CONFLICT",
            };
        });

        await csvWriter.writeRecords([...records, ...conflictRecords]);
    }

    async saveStats(options: ReportExportSaveStatsOptions): Async<void> {
        const { outputPath: reportPath, stats } = options;
        const createCsvWriter = CsvWriter.createObjectCsvWriter;
        const csvHeader = _.map(statsHeaders, (obj, key) => ({ id: key, ...obj }));
        const statsRecord = [stats].map((stats): StatsRow => _.mapValues(stats, v => "" + v));
        const csvWriter = createCsvWriter({
            path: `${reportPath.split(".csv")[0]}-stats.csv`,
            header: csvHeader,
        });

        await csvWriter.writeRecords(statsRecord);
    }
}

type Attr = "programId" | "trackedEntityId" | "orgUnitId" | "status";
type StatsAttr = "created" | "updated" | "deleted" | "ignored" | "total";
type Row = Record<Attr, string>;
type StatsRow = Record<StatsAttr, string>;

const headers: Record<Attr, { title: string }> = {
    programId: { title: "Program ID" },
    trackedEntityId: { title: "Tracked Entity ID" },
    orgUnitId: { title: "Org Unit ID" },
    status: { title: "Status" },
};

const statsHeaders: Record<StatsAttr, { title: string }> = {
    created: { title: "Created" },
    updated: { title: "Updated" },
    deleted: { title: "Deleted" },
    ignored: { title: "Ignored" },
    total: { title: "Total" },
};
