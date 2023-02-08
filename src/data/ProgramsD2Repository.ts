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
import { Id } from "domain/entities/Base";
import { TrackedEntityInstance } from "@eyeseetea/d2-api/api/trackedEntityInstances";
import log from "utils/log";

export class ProgramsD2Repository implements ProgramsRepository {
    constructor(private api: D2Api) {}

    async get(options: GetOptions): Async<TrackedEntity[]> {
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

    async getTeis(ids: Id[]): Async<any[]> {
        log.info(`About to send ${ids.length} requests. This can take for minutes.`);
        const promises = await this.getRealOrgUnits(ids).then(res =>
            // _.groupBy(
            //     res.flatMap(p => (p.status === "fulfilled" ? [p.value] : [])),
            //     value => _.has(value, "id")
            // )
            res.flatMap(p =>
                p.status === "fulfilled" && _.has(p.value, "enrollments")
                    ? [p.value as TrackedEntityInstancePick]
                    : []
            )
        );
        log.info(JSON.stringify(promises.length));

        return promises;
    }

    async save(payload: ClosurePayload): Async<Stats> {
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

    private getRealOrgUnits(ids: string[]) {
        return Promise.allSettled(
            ids.map(id =>
                this.api
                    .get<TrackedEntityInstancePick>(`trackedEntityInstances/${id}`, {
                        ouMode: "ALL",
                        fields: "trackedEntityInstance,enrollments[enrollment,program,orgUnit,orgUnitName]",
                        skipPaging: true,
                    })
                    .getData()
                    .then(res => delay(3000).then(() => res))
                    .catch(() =>
                        this.api
                            .get<TrackedEntityInstancePick>(`trackedEntityInstances/${id}`, {
                                ouMode: "ALL",
                                fields: "trackedEntityInstance,enrollments[enrollment,program,orgUnit,orgUnitName]",
                                skipPaging: true,
                            })
                            .getData()
                            .catch((err: any) => ({ id, err }))
                    )
            )
        );
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

function delay(t: number) {
    return new Promise(resolve => setTimeout(resolve, t));
}

export type TrackedEntityInstancePick = Pick<TrackedEntityInstance, "enrollments" | "trackedEntityInstance">;
