"use strict";
/**
 * MangaDex API types — extended from original types.ts
 * Reuses all original types + adds statistics, aggregate, and AtHome types
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMangaDexErrorResponse = isMangaDexErrorResponse;
exports.isMangaDexSuccessResponse = isMangaDexSuccessResponse;
function isMangaDexErrorResponse(response) {
    return (typeof response === 'object' &&
        response !== null &&
        'result' in response &&
        response.result === 'error');
}
function isMangaDexSuccessResponse(response) {
    return (typeof response === 'object' &&
        response !== null &&
        'result' in response &&
        response.result === 'ok');
}
//# sourceMappingURL=types.js.map