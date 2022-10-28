import _ from "lodash";
import { ClosePatientsOptions, ProgramsRepository } from "domain/repositories/ProgramsRepository";
import { Async } from "domain/entities/Async";
import { D2Api } from "types/d2-api";
import { TrackedEntity } from "domain/entities/TrackedEntity";
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

        const daysOfReference = parseInt(timeOfReference);
        if (_.isNaN(daysOfReference)) throw new Error("Time of reference must be a number");

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
            .map(({ data }) => {
                const teisWithoutClosure = data.instances.filter(tei => {
                    const enrollment = _.first(tei.enrollments);
                    if (!enrollment) return;
                    return (
                        enrollment.status !== "COMPLETED" &&
                        !enrollment.events.some(
                            event => event.programStage === closureProgramId && !event.deleted
                        )
                    );
                });
                const filteredEntities = teisWithoutClosure.filter(tei => {
                    const dates = _.first(tei.enrollments)?.events.flatMap(event =>
                        programStagesIds.includes(event.programStage)
                            ? [new Date(event.occurredAt).getTime()]
                            : []
                    );
                    const currentDate = new Date();
                    currentDate.setDate(currentDate.getDate() - daysOfReference);
                    const occurredBefore = currentDate.getTime();
                    return (
                        dates &&
                        !_.isEmpty(dates) &&
                        Math.max(Math.max(...dates), occurredBefore) === occurredBefore
                    );
                });
                return filteredEntities;
            });

        const payload$ = filteredEntities$.map(({ data: teis }) => {
            const enrollmentsWithLastDate = teis.flatMap(tei => {
                const e = _.first(tei.enrollments);
                if (!e) return [];
                const { orgUnit, program, trackedEntity, enrollment, enrolledAt, occurredAt } = e;
                const dates = e.events.flatMap(event =>
                    programStagesIds.includes(event.programStage)
                        ? [new Date(event.occurredAt).getTime()]
                        : []
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
                            status: "COMPLETED",
                        },
                        lastConsultationDate: dates && !_.isEmpty(dates) && Math.max(...dates),
                    },
                ];
            });

            const events = enrollmentsWithLastDate.flatMap(
                ({ enrollment: e, lastConsultationDate: date }) => {
                    if (!date) return [];
                    const ocurredAt = new Date(date);
                    ocurredAt.setDate(ocurredAt.getDate() + daysOfReference);
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
                                : data.message || "Unknown error"
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
                        log.error(`GET /tracker/trackedEntities: `, data.message || "Unknown error");
                    }
                });
    }
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

type ApiPostErrorResponse = {
    response: {
        data: ApiPostResponse & { message?: string };
    };
};
