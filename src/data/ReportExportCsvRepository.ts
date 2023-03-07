import _ from "lodash";
import * as CsvWriter from "csv-writer";
import { ReportExportRepository, ReportExportSaveOptions } from "domain/repositories/ReportExportRepository";
import { Async } from "domain/entities/Async";

export class ReportExportCsvRepository implements ReportExportRepository {
    async save(options: ReportExportSaveOptions): Async<void> {
        const { entities, outputPath: reportPath, programId } = options;
        const createCsvWriter = CsvWriter.createObjectCsvWriter;
        const csvHeader = _.map(headers, (obj, key) => ({ id: key, ...obj }));
        const csvWriter = createCsvWriter({ path: reportPath, header: csvHeader });
        const records = entities.map((entity): Row => {
            return {
                programId: programId,
                trackedEntityId: entity.trackedEntity,
                orgUnitId: entity.orgUnit,
            };
        });
        await csvWriter.writeRecords(records);
    }
}

type Attr = "programId" | "trackedEntityId" | "orgUnitId";
type Row = Record<Attr, string>;

const headers: Record<Attr, { title: string }> = {
    programId: { title: "Program ID" },
    trackedEntityId: { title: "Tracked Entity ID" },
    orgUnitId: { title: "Org Unit ID" },
};
