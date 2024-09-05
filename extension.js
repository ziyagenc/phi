/**
 * A class representing the PiholeExtension
 * @extends Extension
 */

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import { PiholeIndicator } from "./indicator.js";

export default class PiholeExtension extends Extension {
  /**
   * Enables the PiholeExtension by creating a
   * new instance of the PiholeIndicator class
   */

  enable() {
    console.log(`Enabling ${this.metadata.name}.`);

    this._indicator = new PiholeIndicator(this, this.getSettings());
  }

  /**
   * Disables the PiholeExtension and
   * Destroys the PiholeIndicator instance
   */

  disable() {
    console.log(`Disabling ${this.metadata.name}.`);

    this._indicator?.destroy();
    this._indicator = null;
  }
}
