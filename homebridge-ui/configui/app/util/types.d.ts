export declare type Credentials = {
    username: string;
    password: string;
    country: string;
    deviceName: string;
};
export declare enum LoginFailReason {
    UNKNOWN = 0,
    CAPTCHA = 1,
    TFA = 2,
    TIMEOUT = 3
}
export declare type LoginResult = {
    success: boolean;
    failReason?: LoginFailReason;
    data?: any;
};
//# sourceMappingURL=types.d.ts.map