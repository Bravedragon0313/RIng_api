interface Logger {
    logInfo: (message: string) => void;
    logError: (message: string) => void;
}
export declare function delay(milliseconds: number): Promise<unknown>;
export declare function logDebug(message: any): void;
export declare function logInfo(message: any): void;
export declare function logError(message: any): void;
export declare function useLogger(newLogger: Logger): void;
export declare function enableDebug(): void;
export declare function generateUuid(seed?: string): string;
export declare function getHardwareId(): Promise<string>;
export declare function requestInput(question: string): Promise<string>;
export declare function stringify(data: any): string;
export declare function mapAsync<T, U>(records: T[], asyncMapper: (record: T) => Promise<U>): Promise<U[]>;
export {};
