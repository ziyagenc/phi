import Gio from "gi://Gio";
import GObject from "gi://GObject";

import * as DBus from "./dbus.js";
import { Pihole as SingleInstance } from "./pihole.js";
import { MPihole as MultiInstance } from "./mpihole.js";

export const PiholeIndicator = GObject.registerClass(
  {
    GTypeName: "PiholeIndicator",
  },
  class PiholeIndicator extends GObject.Object {
    constructor(me, settings) {
      super();

      this._me = me;
      this._settings = settings;
      this._network_monitor = Gio.NetworkMonitor.get_default();
      this._pihole = null;

      this._configure();
      this._setHandlers();
      this._start();
    }

    _configure() {
      this._hideUi = this._settings.get_boolean("hideui");
      this._check_network = this._settings.get_boolean("check-network");
      this._network = this._settings.get_string("network");
      this._multimode = this._settings.get_boolean("multimode");
    }

    _setHandlers() {
      this._networkHandlerId = this._network_monitor.connect(
        "network-changed",
        () => {
          this._start();
        }
      );

      this._settingsHandlerId = this._settings.connect("changed", () => {
        this._configure();
        this._start();
      });
    }

    async _start() {
      const Pihole = this._multimode ? MultiInstance : SingleInstance;

      this._pihole?.destroy();
      this._pihole = null;

      if (!this._network_monitor.network_available) {
        if (!this._hideUi) {
          this._pihole = new Pihole(this._me, this._settings, "no_network");
        }

        return;
      }

      if (!this._check_network) {
        this._pihole = new Pihole(this._me, this._settings, "start");

        return;
      }

      const currentNetworkId = await DBus.getNetworkIdAsync();

      if (this._network === currentNetworkId) {
        this._pihole = new Pihole(this._me, this._settings, "start");
      } else {
        this._pihole = this._hideUi
          ? null
          : new Pihole(this._me, this._settings, "unknown_network");
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
