import _ from "lodash";
import { ClosePatientsOptions, ProgramsRepository } from "domain/repositories/ProgramsRepository";
import { Async } from "domain/entities/Async";
import { D2Api } from "types/d2-api";
import { log, Log } from "utils/log";
import { TrackedEntity } from "domain/entities/TrackedEntity";

export class ProgramsD2Repository implements ProgramsRepository {
    constructor(private api: D2Api) {}

    //First of all we need the patients that don't have a closure

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
        } = options;

        const daysOfReference = parseInt(timeOfReference);
        if (_.isNaN(daysOfReference)) throw new Error("Time of reference must be a number");

        const trackedEntitiesWithEnrollments$ = this.api
            .get<ApiResponse>("/tracker/trackedEntities", {
                program: programId,
                orgUnit: orgUnitsIds?.join(";"),
                ouMode: orgUnitsIds ? "SELECTED" : "ALL",
                enrollmentOccurredAfter: startDate,
                enrollmentOccurredBefore: endDate,
                fields: "*,enrollments[*]",
                totalPages: true,
            })
            .map(({ data }) => data.instances);

        const eventsByConsultationProgramStageFromTrackedEntitiesWithoutClosure$ = this.api
            .get<{ instances: { enrollment: string }[] }>("/tracker/events", {
                //get all tei that have a closureProgramStage
                program: programId,
                programStage: closureProgramId,
                orgUnit: orgUnitsIds?.join(";"),
                ouMode: orgUnitsIds ? "SELECTED" : "ALL",
                totalPages: true,
            })
            .flatMap(({ data }) => {
                const enrollmentsWithClosure = data.instances.map(({ enrollment }) => enrollment);
                const trackedEntitiesWithoutClosure$ = this.api
                    .get<{ instances: { enrollment: string; trackedEntity: string }[] }>( //get enrollments from start date to end date
                        "/tracker/enrollments",
                        {
                            program: programId,
                            orgUnit: orgUnitsIds?.join(";"),
                            ouMode: orgUnitsIds ? "SELECTED" : "ALL",
                            enrolledAfter: startDate,
                            enrolledBefore: endDate,
                            totalPages: true,
                        }
                    )
                    .map(({ data }) => {
                        //return enrollments that don't have closureProgramStage
                        return (
                            data.instances
                                .filter(instance => !enrollmentsWithClosure.includes(instance.enrollment))
                                //TODO: take all the data associated to the enrollments to guarantee data completeness
                                .map(instance => instance.trackedEntity)
                        ); //return teiId with filtered enrollments with period also
                    });
                return trackedEntitiesWithoutClosure$;
            })
            .map(({ data }) => {
                const occurredBefore = new Date();
                occurredBefore.setDate(occurredBefore.getDate() - daysOfReference);
                log(Log.fg.magenta, `OcurredBefore: ${occurredBefore.toISOString()}`);

                return data.map(teiId => ({
                    //Promise from each teiId with each promise
                    teiId,
                    eventsFromConsultationProgramStagesIds:
                        //Promise from each event with teiId and each consultation program stage
                        programStagesIds.map(id => ({
                            programStageId: id,
                            eventsByProgramStageIdByTeiIdOlderThanCurrentDateMinusTimeOfReference: this.api
                                .get<{ instances: { enrollment: string }[] }>("/tracker/events", {
                                    program: programId,
                                    programStage: id,
                                    trackedEntity: teiId,
                                    orgUnit: orgUnitsIds?.join(";"),
                                    ouMode: orgUnitsIds ? "SELECTED" : "ALL",
                                    occurredBefore: occurredBefore.toISOString(),
                                    totalPages: true,
                                })
                                .map(({ data }) => data.instances)
                                .getData(),
                        })),
                }));
            });

        const events = eventsByConsultationProgramStageFromTrackedEntitiesWithoutClosure$.getData();

        events
            .then(p => p)
            .then(y => {
                log(
                    Log.fg.yellow,
                    "PRINTING EVENTS WITH SPECIFIC CONSULTATION PROGRAM STAGES THAT OCCURREDAT DATE IS OLDER THAN CURRENT DATE MINUS TIME OF REFERENCE AND FROM EACH TRACKED ENTITY THAT DOES NOT HAVE CLOSURES"
                );
                y.forEach(teiEvents => {
                    const eventsPromises = teiEvents.eventsFromConsultationProgramStagesIds.map(
                        events => events.eventsByProgramStageIdByTeiIdOlderThanCurrentDateMinusTimeOfReference
                    );
                    const eventsPromise = Promise.all(eventsPromises);
                    eventsPromise.then(eventsFromProgramStages => {
                        const allEvents = eventsFromProgramStages.flat();
                        console.log(allEvents);
                    });
                });
            });

        trackedEntitiesWithEnrollments$.getData().then(teis => {
            log(Log.fg.yellow, "PRINTING ALL TRACKED ENTITIES");
            teis.forEach(tei => {
                console.log(_.omit(tei, "attributes"));
            });
        });
    }
}

interface ApiResponse {
    instances: TrackedEntity[];
}
