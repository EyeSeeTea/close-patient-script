import _ from "lodash";
import { ProgramsRepository } from "domain/repositories/ProgramsRepository";
import { Enrollment, TrackedEntity } from "domain/entities/TrackedEntity";
import { Async } from "domain/entities/Async";
import { Id } from "domain/entities/Base";
import { D2Api } from "types/d2-api";
import { Pair } from "scripts/common";
import log from "utils/log";

export class ProgramsD2Repository implements ProgramsRepository {
    constructor(private api: D2Api) {}

    async closePatients(options: ClosePatientsOptions): Async<void> {
        const {
            orgUnitsIds,
            startDate,
            endDate,
            programId,
            programStagesIds,
            closureProgramId,
            timeOfReference,
            pairsDeValue,
            comments,
            post,
        } = options;

        const filteredEntities$ = this.api
            .get<ApiGetResponse>("/tracker/trackedEntities", {
                program: programId,
                orgUnit: orgUnitsIds?.join(";"),
                ouMode: orgUnitsIds ? "SELECTED" : "ALL",
                enrollmentOccurredAfter: startDate,
                enrollmentOccurredBefore: endDate,
                fields: "*,enrollments[*]",
                skipPaging: true,
            })
            .map(({ data }) =>
                this.filterEntities(data, closureProgramId, programStagesIds, timeOfReference)
            );

        const payload$ = filteredEntities$.map(({ data: teis }) => {
            const enrollmentsWithLastDate = teis.flatMap(tei =>
                this.getEnrollmentsWithLastDate(tei, programStagesIds)
            );
            const events = enrollmentsWithLastDate.flatMap(({ enrollment: e, lastConsultationDate: date }) =>
                this.getPayloadEvents({
                    enrollment: e,
                    timeOfReference,
                    pairsDeValue,
                    closureProgramId,
                    date: date ? date : undefined,
                    comments,
                })
            );

            return {
                enrollments: enrollmentsWithLastDate.map(({ enrollment }) => enrollment),
                events: events,
            };
        });

        if (post)
            payload$
                .flatMap(({ data }) => this.api.post<ApiPostResponse>("/tracker", { async: false }, data))
                .getData()
                .then(res =>
                    log.info(`Closed patients: enrollments and closure events: ${JSON.stringify(res.stats)}`)
                )
                .catch((res: ApiPostErrorResponse) => {
                    const { data } = res.response;
                    if (data.status !== "OK") {
                        log.error(
                            `POST /tracker: `,
                            data.validationReport
                                ? JSON.stringify(
                                      data.validationReport?.errorReports
                                          ?.map(({ message }) => message)
                                          .join("\n")
                                  )
                                : data.message
                        );
                    }
                });
        else
            payload$
                .getData()
                .then(payload => log.info(`Payload: ${JSON.stringify(payload)}`))
                .catch((res: ApiPostErrorResponse) => {
                    const { data } = res.response;
                    if (data.status !== "OK") {
                        log.error(`GET /tracker/trackedEntities: `, data.message);
                    }
                });
    }

    private getTeiWithoutClosure(instances: TrackedEntity[], closureProgramId: string) {
        return instances.filter(tei => {
            const enrollment = _.first(tei.enrollments);
            return (
                enrollment &&
                enrollment.status !== "COMPLETED" &&
                !enrollment.events?.some(event => event.programStage === closureProgramId && !event.deleted)
            );
        });
    }

    private getDatesByProgramStages(tei: TrackedEntity, programStagesIds: string[]) {
        return _.first(tei.enrollments)?.events?.flatMap(event =>
            programStagesIds.includes(event.programStage) ? [new Date(event.occurredAt).getTime()] : []
        );
    }

    private getRelativeDate(timeOfReference: number, date?: number) {
        const relativeDate = date ? new Date(date) : new Date();
        relativeDate.setDate(relativeDate.getDate() - timeOfReference);
        return relativeDate;
    }

    private filterEntities(
        data: ApiGetResponse,
        closureProgramId: string,
        programStagesIds: string[],
        timeOfReference: number
    ) {
        const teisWithoutClosure = this.getTeiWithoutClosure(data.instances, closureProgramId);
        const filteredEntities = teisWithoutClosure.filter(tei => {
            const dates = this.getDatesByProgramStages(tei, programStagesIds);
            const occurredBefore = this.getRelativeDate(-timeOfReference).getTime();
            return dates && !_.isEmpty(dates) && Math.max(...dates, occurredBefore) === occurredBefore;
        });
        return filteredEntities;
    }

    private getEnrollmentsWithLastDate(tei: TrackedEntity, programStagesIds: string[]) {
        const e = _.first(tei.enrollments);
        if (!e) return [];
        const { orgUnit, program, trackedEntity, enrollment, enrolledAt, occurredAt } = e;
        const dates = e.events?.flatMap(event =>
            programStagesIds.includes(event.programStage) ? [new Date(event.occurredAt).getTime()] : []
        );
        return [
            {
                enrollment: {
                    orgUnit,
                    program,
                    trackedEntity,
                    enrollment,
                    enrolledAt,
                    occurredAt,
                    status: "COMPLETED" as const,
                },
                lastConsultationDate: dates && !_.isEmpty(dates) && Math.max(...dates),
            },
        ];
    }

    private getPayloadEvents(options: GetPayloadEventsOptions) {
        const { enrollment: e, timeOfReference, pairsDeValue, closureProgramId, date, comments } = options;
        if (!date) return [];
        const ocurredAt = this.getRelativeDate(timeOfReference, date);
        const dataValues = pairsDeValue.map(([dataElement, value]) => ({ dataElement, value }));
        const [commentDe, commentValue] = comments ?? [];
        return [
            {
                status: e.status,
                programStage: closureProgramId,
                enrollment: e.enrollment,
                orgUnit: e.orgUnit,
                occurredAt: ocurredAt.toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                dataValues:
                    commentDe && commentValue
                        ? [...dataValues, { dataElement: commentDe, value: commentValue }]
                        : dataValues,
            },
        ];
    }
}

export interface ClosePatientsOptions {
    orgUnitsIds?: Id[];
    startDate?: string;
    endDate?: string;
    programId: Id;
    programStagesIds: Id[];
    closureProgramId: Id;
    timeOfReference: number;
    pairsDeValue: Pair[];
    comments?: Pair;
    post: boolean;
}

interface ApiGetResponse {
    instances: TrackedEntity[];
}

interface ApiPostResponse {
    validationReport?: { errorReports?: Report[] };
    status: "OK" | "ERROR" | "WARNING";
    stats: Stats;
}

interface Report {
    message: string;
}

interface Stats {
    created: number;
    updated: number;
    deleted: number;
    ignored: number;
    total: number;
}

interface GetPayloadEventsOptions {
    enrollment: Enrollment;
    timeOfReference: number;
    pairsDeValue: Pair[];
    closureProgramId: string;
    date?: number;
    comments?: Pair;
}

type ApiPostErrorResponse = {
    response: {
        data: ApiPostResponse & { message?: string };
    };
};
