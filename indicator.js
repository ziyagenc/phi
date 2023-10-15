import Gio from "gi://Gio";
import GObject from "gi://GObject";

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as DBus from "./dbus.js";
import { Pihole } from "./pihole.js";

export const PiholeIndicator = GObject.registerClass(
  {
    GTypeName: "PiholeIndicator",
  },
  class PiholeIndicator extends GObject.Object {
    constructor(uuid) {
      super();

      this._me = Extension.lookupByUUID(uuid);
      this._settings = this._me.getSettings();
      this._network_monitor = Gio.NetworkMonitor.get_default();
      this._pihole = null;
      this._uuid = uuid;

      this._configure();
      this._setHandlers();
      this._start().catch(console.error);
    }

    _configure() {
      this._hideUi = this._settings.get_boolean("hideui");
      this._restrict = this._settings.get_boolean("restrict");
      this._networks = this._settings.get_string("networks");
    }

    _setHandlers() {
      this._networkHandlerId = this._network_monitor.connect(
        "network-changed",
        () => {
          this._start().catch(console.error);
        }
      );

      this._settingsHandlerId = this._settings.connect("changed", () => {
        this._configure();
        this._start().catch(console.error);
      });
    }

    async _start() {
      this._pihole?.destroy();
      this._pihole = null;

      if (this._network_monitor.network_available) {
        if (this._restrict && this._hideUi) {
          const currentNetworkId = await DBus.getNetworkIdAsync();

          this._pihole = this._networks.split(";").includes(currentNetworkId)
            ? new Pihole(this._me, "start")
            : null;
        } else if (this._restrict) {
          const currentNetworkId = await DBus.getNetworkIdAsync();

          this._pihole = this._networks.split(";").includes(currentNetworkId)
            ? new Pihole(this._me, "start")
            : new Pihole(this._me, "unknown_network");
        } else {
          this._pihole = new Pihole(this._me, "start");
        }
      } else {
        if (!this._hideUi) this._pihole = new Pihole(this._me, "no_network");
      }
    }

    destroy() {
      this._settings.disconnect(this._settingsHandlerId);
      this._settings = null;

      this._network_monitor.disconnect(this._networkHandlerId);

      this._pihole?.destroy();
      this._pihole = null;
    }
  }
);
