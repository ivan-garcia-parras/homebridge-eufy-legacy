"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EufyClientNotRunningError = void 0;
class EufyClientNotRunningError extends Error {
    constructor(message) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = EufyClientNotRunningError.name;
    }
}
exports.EufyClientNotRunningError = EufyClientNotRunningError;
//# sourceMappingURL=interfaces.js.map