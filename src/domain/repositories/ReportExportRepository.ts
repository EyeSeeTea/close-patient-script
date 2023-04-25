import { BundleReport } from "data/TrackerD2Repository";
import { Async } from "domain/entities/Async";
import { TrackedEntity } from "domain/entities/TrackedEntity";

export interface ReportExportRepository {
    save(options: ReportExportSaveOptions): Async<void>;
    saveStats(options: ReportExportSaveStatsOptions): Async<void>;
}

export interface ReportExportSaveOptions {
    outputPath: string;
    entities: TrackedEntity[];
    conflictEntities: TrackedEntity[];
    programId: string;
}

export interface ReportExportSaveStatsOptions {
    outputPath: string;
    bundleReport: BundleReport;
}
