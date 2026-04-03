import keytar from "keytar"
import { injectable, singleton } from "tsyringe"
import { IKeytarService } from "./KeytarService.interface"

@injectable()
@singleton()
export class KeytarService implements IKeytarService {
  async getPassword(service: string, account: string): Promise<string | null> {
    return keytar.getPassword(service, account)
  }

  async setPassword(
    service: string,
    account: string,
    password: string,
  ): Promise<void> {
    await keytar.setPassword(service, account, password)
  }

  async deletePassword(service: string, account: string): Promise<boolean> {
    return keytar.deletePassword(service, account)
  }
}
