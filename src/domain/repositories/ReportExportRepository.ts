import { BundleReport, ValidationReport } from "data/TrackerD2Repository";
import { Async } from "domain/entities/Async";
import { TrackedEntity } from "domain/entities/TrackedEntity";
import { ClosurePayload } from "./TrackerRepository";

export interface ReportExportRepository {
    save(options: ReportExportSaveOptions): Async<void>;
    saveErrors(options: ReportExportSaveErrorsOptions): Async<void>;
    saveStats(options: ReportExportSaveStatsOptions): Async<void>;
}

export interface ReportExportSaveOptions {
    outputPath: string;
    entities: TrackedEntity[];
    conflictEntities: TrackedEntity[];
    programId: string;
}

export interface ReportExportSaveErrorsOptions {
    outputPath: string;
    validationReport: ValidationReport;
    payload: ClosurePayload;
}

export interface ReportExportSaveStatsOptions {
    outputPath: string;
    bundleReport: BundleReport;
}
