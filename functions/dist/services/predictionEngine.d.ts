import { ApiResponse } from "../types/api";
import { Expense } from "../types/expense";
import { PredictionResult } from "../types/prediction";
import { FirestoreStore } from "./firestore";
export interface WeatherData {
    temperatureAvg: number;
    humidityAvg: number;
}
export interface EconomicData {
    inflationRate: number;
    interestRate: number;
}
export interface ExchangeRateData {
    thbToUsd: number;
    changePercent: number;
}
export interface WeatherClient {
    getWeather(): Promise<WeatherData>;
}
export interface EconomicClient {
    getIndicators(): Promise<EconomicData>;
}
export interface ExchangeRateClient {
    getRates(): Promise<ExchangeRateData>;
}
export interface PredictionEngineDeps {
    expenseStore: FirestoreStore<Expense>;
    weatherClient?: WeatherClient;
    economicClient?: EconomicClient;
    exchangeRateClient?: ExchangeRateClient;
}
export declare function createPredictionEngine(deps?: Partial<PredictionEngineDeps>): {
    generatePredictions: (userId: string) => Promise<ApiResponse<PredictionResult[]>>;
    hasEnoughData: (userId: string) => Promise<boolean>;
};
//# sourceMappingURL=predictionEngine.d.ts.map