"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoginFailReason = void 0;
var LoginFailReason;
(function (LoginFailReason) {
    LoginFailReason[LoginFailReason["UNKNOWN"] = 0] = "UNKNOWN";
    LoginFailReason[LoginFailReason["CAPTCHA"] = 1] = "CAPTCHA";
    LoginFailReason[LoginFailReason["TFA"] = 2] = "TFA";
    LoginFailReason[LoginFailReason["TIMEOUT"] = 3] = "TIMEOUT";
})(LoginFailReason = exports.LoginFailReason || (exports.LoginFailReason = {}));
//# sourceMappingURL=types.js.map