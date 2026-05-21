"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET_MANGA_DETAILS = exports.SEARCH_MANGA = exports.mapAniListMedia = exports.AniListProvider = exports.AniListClient = void 0;
var client_1 = require("./client");
Object.defineProperty(exports, "AniListClient", { enumerable: true, get: function () { return client_1.AniListClient; } });
var provider_1 = require("./provider");
Object.defineProperty(exports, "AniListProvider", { enumerable: true, get: function () { return provider_1.AniListProvider; } });
var mapper_1 = require("./mapper");
Object.defineProperty(exports, "mapAniListMedia", { enumerable: true, get: function () { return mapper_1.mapAniListMedia; } });
__exportStar(require("./types"), exports);
var queries_1 = require("./queries");
Object.defineProperty(exports, "SEARCH_MANGA", { enumerable: true, get: function () { return queries_1.SEARCH_MANGA; } });
Object.defineProperty(exports, "GET_MANGA_DETAILS", { enumerable: true, get: function () { return queries_1.GET_MANGA_DETAILS; } });
//# sourceMappingURL=index.js.map