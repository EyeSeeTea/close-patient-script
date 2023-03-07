import { Async } from "domain/entities/Async";
import { TrackedEntity } from "domain/entities/TrackedEntity";

export interface ReportExportRepository {
    save(options: ReportExportSaveOptions): Async<void>;
}

export interface ReportExportSaveOptions {
    outputPath: string;
    entities: TrackedEntity[];
    programId: string;
}
