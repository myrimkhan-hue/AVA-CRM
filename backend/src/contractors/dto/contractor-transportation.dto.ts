import { TransportationStatus } from '@prisma/client';

export interface ContractorTransportationDto {
  id: string;
  number: string;
  originPoint: string;
  destinationPoint: string;
  status: TransportationStatus;
  role: {
    isClient: boolean;
    legOrderIndexes: number[];
  };
}
