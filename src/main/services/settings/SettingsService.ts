import { inject, injectable, singleton } from "tsyringe"
import { ISettingsService } from "./SettingsService.interface"
import { IStoreService } from "../store/StoreService.interface"

@injectable()
@singleton()
export class SettingsService implements ISettingsService {
  constructor(@inject(IStoreService) private storeService: IStoreService) {}

  get() {
    return {
      alwaysOnTop: this.getAlwaysOnTop(),
      developerMode: this.getDeveloperMode(),
    }
  }

  getAlwaysOnTop(): boolean {
    return this.storeService.get("alwaysOnTop")
  }

  getDeveloperMode(): boolean {
    return this.storeService.get("developerMode")
  }

  setAlwaysOnTop(value: boolean): void {
    this.storeService.set("alwaysOnTop", value)
  }

  setDeveloperMode(value: boolean): void {
    this.storeService.set("developerMode", value)
  }
}
