import { Protocols } from "./models/Protocols";

export interface LayerUrlWithMetadata {
  url: string;
  bbox?: number[];
  protocol?: Protocols;
}