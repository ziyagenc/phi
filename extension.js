import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import { PiholeIndicator } from "./indicator.js";

export default class PiholeExtension extends Extension {
  enable() {
    console.log(`Enabling ${this.metadata.name}.`);

    this._indicator = new PiholeIndicator(this.metadata.uuid);
  }

  disable() {
    console.log(`Disabling ${this.metadata.name}.`);

    this._indicator?.destroy();
    this._indicator = null;
  }
}
