import _ from "lodash";
import { Async } from "domain/entities/Async";
import { Ref } from "domain/entities/Base";
import { ClosePatientsOptions, ProgramsRepository } from "domain/repositories/ProgramsRepository";
import { D2Api } from "types/d2-api";
import { Maybe } from "utils/ts-utils";

export class ProgramsD2Repository implements ProgramsRepository {
    private teiPatientType: Maybe<Ref>;

    constructor(private api: D2Api) {
        console.log(api.baseUrl);
        console.log(api.apiConnection);
        console.log(api.get<{ trackedEntityTypes: Ref[] }>("/organisationUnits").response());
        api.get<{ trackedEntityTypes: Ref[] }>("/organisationUnits")
            .response()
            .then(x => console.log(x));
        var promise = new Promise(async function (resolve, reject) {
            const x = await api.get<{ trackedEntityTypes: Ref[] }>("/organisationUnits").response();
            resolve(x);
        });
        promise.then(x => console.log(x));
        const patientType$ = api
            .get<{ trackedEntityTypes: Ref[] }>("/trackedEntityTypes", {
                // filter: `name:eq:Patient`,
            })
            .getData();
        patientType$
            .then(({ trackedEntityTypes: teiTypes }) => {
                console.log("x");
                const teiType = _.first(teiTypes);
                if (!teiType) throw new Error("Tracked Entity Type with name 'Patient' not found");
                this.teiPatientType = teiType;
                console.log(JSON.stringify(this.teiPatientType));
            })
            .catch(err => {
                throw new Error(err);
            });
    }

    async closePatients(options: ClosePatientsOptions): Async<void> {
        const {
            orgUnitsIds,
            period,
            programId,
            programStageIds,
            closureProgramId,
            timeOfReference,
            pairsDeValue,
            comments,
        } = options;
        if (this.teiPatientType)
            this.api.trackedEntityInstances
                .get({
                    trackedEntityType: this.teiPatientType.id,
                    ouMode: "ALL",
                    totalPages: true,
                })
                .map(res => console.log(JSON.stringify(res.data.trackedEntityInstances)));
    }

    // async export(options: { ids: Id[] }): Async<ProgramExport> {
    //     const programIds = options.ids;
    //     const metadata = await this.getMetadata(programIds);
    //     const events = await this.getFromTracker("events", programIds);
    //     const enrollments = await this.getFromTracker("enrollments", programIds);
    //     const trackedEntities = await this.getFromTracker("trackedEntities", programIds);

    //     return {
    //         metadata,
    //         data: { events, enrollments, trackedEntities },
    //     };
    // }

    // private async getMetadata(programIds: string[]) {
    //     const responses = await promiseMap(programIds, programId =>
    //         this.api.get<MetadataRes>(`/programs/${programId}/metadata.json`).getData()
    //     );

    //     const keys = _(responses).flatMap(_.keys).uniq().difference(["date"]).value();
    //     const metadata = _(keys)
    //         .map(key => {
    //             const value = _(responses)
    //                 .flatMap(res => res[key] || [])
    //                 .uniqBy(obj => obj.id)
    //                 .value();

    //             return [key, value];
    //         })
    //         .fromPairs()
    //         .value();
    //     return metadata;
    // }

    // async import(programExport: ProgramExport): Async<void> {
    //     const metadataRes = await runMetadata(this.api.metadata.post(programExport.metadata));
    //     log.info(`Import metadata

    //     log.info("Import data
    //     const data1 = _.pick(programExport.data, ["enrollments", "trackedEntities"]);
    //     await this.postTracker(data1);

    //     for (const events of _.chunk(programExport.data.events, 1000)) {
    //         log.info("Import data
    //         await this.postTracker({ events });
    //     }
    // }

    // async runRules(options: RunRulesOptions): Async<void> {
    //     const d2ProgramRules = new D2ProgramRules(this.api);
    //     return d2ProgramRules.run(options);
    // }

    // /* Private */

    // private async postTracker(data: object): Async<TrackerResponse> {
    //     // TODO: Implement in d2-api -> POST api.tracker.post
    //     const res = await this.api.post<TrackerResponse>("/tracker", { async
    //     log.debug(res.status);

    //     if (res.status !== "OK") {
    //         console.error(JSON.stringify(res.typeReports, null, 4));
    //         return res;
    //     } else {
    //         return res;
    //     }
    // }

    // private async getFromTracker(apiPath: string, programIds: string[]): Promise<object[]> {
    //     const output = [];

    //     for (const programId of programIds) {
    //         let page = 1;
    //         let dataRemaining = true;

    //         while (dataRemaining) {
    //             // TODO: Implement in d2-api -> GET api.tracker.{events,enrollments,trackedEntities}
    //             const { instances } = await this.api
    //                 .get<{ instances: object[] }>(`/tracker/${apiPath}`, {
    //                     page,
    //                     pageSize: 10e3,
    //                     ouMode: "ALL",
    //                     fields: "*",
    //                     program: programId,
    //                 })
    //                 .getData();

    //             if (instances.length === 0) {
    //                 dataRemaining = false;
    //             } else {
    //                 output.push(...instances);
    //                 page++;
    //             }
    //         }
    //     }

    //     return output;
    // }
}
