import { Async } from "domain/entities/Async";
import { ClosurePayload } from "./ProgramsRepository";

export interface ReportExportRepository {
    save(options: ReportExportSaveOptions): Async<void>;
}

export interface ReportExportSaveOptions {
    outputPath: string;
    payload: ClosurePayload;
}
