import _ from "lodash";
import {
    GetOptions,
    ClosurePayload,
    ProgramsRepository,
    Stats,
} from "domain/repositories/ProgramsRepository";
import { D2Api } from "types/d2-api";
import { Async } from "domain/entities/Async";
import { TrackedEntity } from "domain/entities/TrackedEntity";

export class ProgramsD2Repository implements ProgramsRepository {
    constructor(private api: D2Api) {}

    get(options: GetOptions): Async<TrackedEntity[]> {
        const { programId, orgUnitsIds, startDate, endDate } = options;
        return this.api
            .get<ApiGetResponse>("/tracker/trackedEntities", {
                program: programId,
                orgUnit: orgUnitsIds?.join(";"),
                ouMode: orgUnitsIds ? "SELECTED" : "ALL",
                enrollmentOccurredAfter: startDate,
                enrollmentOccurredBefore: endDate,
                fields: "*,enrollments[*]",
                skipPaging: true,
            })
            .map(({ data }) => data.instances)
            .getData()
            .catch(err => {
                const message = err?.response?.data?.message;
                if (message) throw new Error(JSON.stringify(message));
                else throw new Error(JSON.stringify(err));
            });
    }

    save(payload: ClosurePayload): Async<Stats> {
        return this.api
            .post<ApiSaveResponse & { message?: string }>("/tracker", { async: false }, payload)
            .getData()
            .then(res => {
                if (res.status === "OK") return res.stats;
                else throw new Error(getErrorMsg(res));
            })
            .catch(err => {
                const data = err?.response?.data;
                if (data) throw new Error(getErrorMsg(data));
                else throw new Error(JSON.stringify(err));
            });
    }
}

function getErrorMsg(
    data: ApiSaveResponse & {
        message?: string;
    }
) {
    return data.validationReport
        ? JSON.stringify(data.validationReport?.errorReports?.map(({ message }) => message).join("\n"))
        : data.message || "Unknown error";
}

interface ApiGetResponse {
    instances: TrackedEntity[];
}

interface ApiSaveResponse {
    validationReport?: { errorReports?: Report[] };
    status: "OK" | "ERROR" | "WARNING";
    stats: Stats;
}

interface Report {
    message: string;
}
