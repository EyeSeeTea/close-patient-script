import _ from "lodash";
import { TrackedEntityInstance as TrackedEntityInstanceD2Api } from "@eyeseetea/d2-api/api/trackedEntityInstances";
import { GetOptions, ClosurePayload, TrackerRepository } from "domain/repositories/TrackerRepository";
import { D2Api } from "types/d2-api";
import { Async } from "domain/entities/Async";
import { TrackedEntity } from "domain/entities/TrackedEntity";
import { Id } from "domain/entities/Base";
import log from "utils/log";

export class TrackerD2Repository implements TrackerRepository {
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
            })
            .then(async trackedEntities => ({
                teis: await this.getTeis(trackedEntities.map(tei => tei.trackedEntity)), //TEMPORAL FIX
                trackedEntities,
            }))
            .then(({ trackedEntities, teis }) => {
                const fixedTrackedEntities = trackedEntities.map(entity => {
                    const teiWithRealOrgUnits = teis.find(
                        tei => tei.trackedEntityInstance === entity.trackedEntity
                    );
                    const newEnrollments = entity.enrollments.map(enrollment => {
                        const realEnrollment = teiWithRealOrgUnits?.enrollments.find(
                            realEnrollment => realEnrollment.enrollment === enrollment.enrollment
                        );

                        return {
                            ...enrollment,
                            orgUnit: realEnrollment ? realEnrollment.orgUnit : enrollment.orgUnit,
                        };
                    });

                    return {
                        ...entity,
                        enrollments: newEnrollments,
                    };
                });

                return fixedTrackedEntities;
            });
    }

    async save(payload: ClosurePayload): Async<BundleReport> {
        return this.api
            .post<ApiSaveResponse & { message?: string }>(
                "/tracker",
                { async: false, reportMode: "FULL" },
                payload
            )
            .getData()
            .then(res => {
                if (res.status === "OK") return res.bundleReport;
                else throw new Error(getErrorMsg(res));
            })
            .catch(err => {
                const data = err?.response?.data;
                if (data) throw new Error(getErrorMsg(data));
                else throw new Error(JSON.stringify(err));
            });
    }

    private async getTeis(ids: Id[]): Async<TrackedEntityInstance[]> {
        if (ids.length >= 1000) log.info(`About to send ${ids.length} requests. This can take for minutes.`);
        const promises = await this.getRealOrgUnits(ids).then(res =>
            res.flatMap(p =>
                p.status === "fulfilled" && _.has(p.value, "enrollments")
                    ? [p.value as TrackedEntityInstance]
                    : []
            )
        );

        if (promises.length < ids.length) {
            throw new Error(`Unable to retrieve ${JSON.stringify(promises.length)} requests.`);
        }

        return promises;
    }

    private async getRealOrgUnits(ids: string[]) {
        const teisResults: PromiseSettledResult<TrackedEntityInstance | TeiError>[] = [];
        const params = {
            ouMode: "ALL",
            fields: "trackedEntityInstance,enrollments[enrollment,program,orgUnit]",
            skipPaging: true,
        };
        for (const groupOfIds of _.chunk(ids, 10)) {
            const promises = groupOfIds.map(id =>
                this.api
                    .get<TrackedEntityInstance>(`trackedEntityInstances/${id}`, params)
                    .getData()
                    .catch(() =>
                        this.api
                            .get<TrackedEntityInstance>(`trackedEntityInstances/${id}`, params)
                            .getData()
                            .catch((err: any) => ({ id, err }))
                    )
            );
            const p = await Promise.allSettled(promises);
            teisResults.push(...p);
        }

        return teisResults;
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
    bundleReport: BundleReport;
    validationReport?: {
        errorReports?: ErrorReport<"ENROLLMENT" | "EVENT" | "RELATIONSHIP" | "TRACKED_ENTITY">[];
    };
    timingStats: {
        timers: {
            commit: string;
            preheat: string;
            preprocess: string;
            programrule: string;
            programruleValidation: string;
            totalImport: string;
            validation: string;
        };
    };
    status: Status;
    stats: Stats;
}

export interface Stats {
    created: number;
    updated: number;
    deleted: number;
    ignored: number;
    total: number;
}

export interface BundleReport {
    stats: Stats;
    status: Status;
    typeReportMap: {
        ENROLLMENT: TypeReport<"ENROLLMENT">;
        EVENT: TypeReport<"EVENT">;
        RELATIONSHIP: TypeReport<"RELATIONSHIP">;
        TRACKED_ENTITY: TypeReport<"TRACKED_ENTITY">;
    };
}

interface TypeReport<K> {
    objectReports: ObjectReport<K>[];
    stats: Stats;
    trackerType: K;
}

interface ObjectReport<K> {
    errorReports: ErrorReport<K>[];
    index: number;
    trackerType: K;
    uid: Id;
}

interface ErrorReport<K> {
    message: string;
    errorCode: string;
    trackerType: K;
    uid: Id;
}

interface TeiError {
    id: string;
    err: any;
}

type Status = "OK" | "ERROR" | "WARNING";
type TrackedEntityInstance = Pick<TrackedEntityInstanceD2Api, "enrollments" | "trackedEntityInstance">;
