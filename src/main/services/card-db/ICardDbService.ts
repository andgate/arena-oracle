import { ResolvedCard } from "@shared/card-types"

export const ICardDbService = Symbol("ICardDbService")

export interface ICardDbService {
  lookupCard(grpId: number): ResolvedCard | undefined
  isLoaded(): boolean
}
