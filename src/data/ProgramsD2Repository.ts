import _ from "lodash";
import { CancelableResponse, D2Api } from "types/d2-api";
import {
    ApiGetResponse,
    ApiSaveResponse,
    GetOptions,
    Payload,
    ProgramsRepository,
} from "domain/repositories/ProgramsRepository";

export class ProgramsD2Repository implements ProgramsRepository {
    constructor(private api: D2Api) {}

    get(options: GetOptions): CancelableResponse<ApiGetResponse> {
        const { programId, orgUnitsIds, startDate, endDate } = options;
        return this.api.get<ApiGetResponse>("/tracker/trackedEntities", {
            program: programId,
            orgUnit: orgUnitsIds?.join(";"),
            ouMode: orgUnitsIds ? "SELECTED" : "ALL",
            enrollmentOccurredAfter: startDate,
            enrollmentOccurredBefore: endDate,
            fields: "*,enrollments[*]",
            skipPaging: true,
        });
    }

    save(payload: Payload): CancelableResponse<ApiSaveResponse> {
        return this.api.post<ApiSaveResponse>("/tracker", { async: false }, payload);
    }
}
