import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import St from "gi://St";

import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as MessageTray from "resource:///org/gnome/shell/ui/messageTray.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";

// PiholeClient v5
import { PiholeClient } from "./client.js";

// PiholeClient v6
import { PiholeClient6 } from "./client6.js";

import {
  PIHOLE_VERSION_5,
  PIHOLE_VERSION_6,
  ClientStatus,
} from "./constants.js";
import { PrefsItem, StatsItem } from "./items.js";

export const Pihole = GObject.registerClass(
  {
    GTypeName: "Pihole",
  },
  class Pihole extends GObject.Object {
    constructor(me, settings, command) {
      super();
      this._me = me;
      this._settings = settings;

      this._configure();
      this._makeMenu();
      this._notificationSource = null;

      this._settingsItem.connect("activate", () => {
        this._me.openPreferences();
      });

      if (command === "start") {
        if (this._version === PIHOLE_VERSION_5) {
          this._piholeClient = new PiholeClient(
            this._url,
            this._token,
            this._me.metadata["version-name"],
          );
        } else {
          this._piholeClient = new PiholeClient6(
            this._url,
            this._token,
            this._me.metadata["version-name"],
          );
        }

        this._toggleItem.connect("toggled", (_, state) => {
          this._piholeClient.togglePihole(state).catch();
          this._updateStatusTextAndIcon(state);
        });

        this._startUpdating();
      } else if (command === "no_network") {
        this._showErrorMenu(ClientStatus.NO_NETWORK);
      } else if (command === "unknown_network") {
        this._showErrorMenu(ClientStatus.UNKNOWN_NETWORK);
      }
    }

    _configure() {
      this._url = this._settings.get_string("url1");
      this._token = this._settings.get_string("token1");
      this._version = this._settings.get_uint("version1");
      this._interval = this._settings.get_uint("interval");
      this._checkNewVersion = this._settings.get_boolean("check-new-version");
      this._showSensorData = this._settings.get_boolean("show-sensor-data");
    }

    _makeMenu() {
      this._menuButton = new PanelMenu.Button(
        0.0,
        this._me.metadata.name,
        false,
      );

      this._menuButton.icon = new St.Icon({
        style_class: "system-status-icon",
      });
      this._menuButton.icon.gicon = Gio.icon_new_for_string(
        this._me.path + "/icons/phi-symbolic.svg",
      );
      this._menuButton.add_child(this._menuButton.icon);

      // Error message item -- hidden when stats are shown.
      this._errorMessageItem = new PopupMenu.PopupMenuItem(_("Initializing"));
      this._menuButton.menu.addMenuItem(this._errorMessageItem);

      // Main menu items -- hidden when an error is shown.
      this._toggleItem = new PopupMenu.PopupSwitchMenuItem(
        "Initializing",
        false,
        {},
      );
      this._menuButton.menu.addMenuItem(this._toggleItem);

      this._mainSeparator = new PopupMenu.PopupSeparatorMenuItem();
      this._menuButton.menu.addMenuItem(this._mainSeparator);

      this._totalQueriesItem = new StatsItem(_("Total Queries"));
      this._menuButton.menu.addMenuItem(this._totalQueriesItem);

      this._queriesBlockedItem = new StatsItem(_("Queries Blocked"));
      this._menuButton.menu.addMenuItem(this._queriesBlockedItem);

      this._percentageBlockedItem = new StatsItem(_("Percentage Blocked"));
      this._menuButton.menu.addMenuItem(this._percentageBlockedItem);

      this._domainsOnAdlistsItem = new StatsItem(_("Domains on Lists"));
      this._menuButton.menu.addMenuItem(this._domainsOnAdlistsItem);

      this._mainItems = [
        this._toggleItem,
        this._mainSeparator,
        this._totalQueriesItem,
        this._queriesBlockedItem,
        this._percentageBlockedItem,
        this._domainsOnAdlistsItem,
      ];

      // If this is Pi-hole v6
      if (this._version === PIHOLE_VERSION_6 && this._showSensorData) {
        this._sensorsSeparator = new PopupMenu.PopupSeparatorMenuItem();
        this._menuButton.menu.addMenuItem(this._sensorsSeparator);

        this._cpuUtilItem = new StatsItem(_("CPU"));
        this._menuButton.menu.addMenuItem(this._cpuUtilItem);

        this._memoryUsageItem = new StatsItem(_("Memory Usage"));
        this._menuButton.menu.addMenuItem(this._memoryUsageItem);

        this._temperatureItem = new StatsItem(_("Temperature"));
        this._menuButton.menu.addMenuItem(this._temperatureItem);

        this._mainItems.push(
          this._sensorsSeparator,
          this._cpuUtilItem,
          this._memoryUsageItem,
          this._temperatureItem,
        );
      }

      this._prefSeparator = new PopupMenu.PopupSeparatorMenuItem();
      this._menuButton.menu.addMenuItem(this._prefSeparator);

      this._settingsItem = new PrefsItem();
      this._menuButton.menu.addMenuItem(this._settingsItem);

      Main.panel.addToStatusArea(this._me.uuid, this._menuButton);
    }

    async _updateUI() {
      try {
        await this._piholeClient.fetchData();
        const stats = this._piholeClient.data;

        // Make sure that the menu is there.
        if (!this._menuButton) return;

        if (Object.keys(stats).length === 0) {
          // Is API key set?
          if (this._token === "") {
            this._showErrorMenu(ClientStatus.NOT_INITIALIZED);
          } else {
            // API key or password is entered, but we still got empty response.
            // Most likely the key or the password is not correct.
            this._showErrorMenu(ClientStatus.EMPTY_RESPONSE);
          }
          return;
        }

        if (this._settingsItem.text === "") {
          this._updateVersionLabel(stats);
        }

        this._showMainMenu(stats);
      } catch {
        // Make sure that the menu is there.
        if (this._menuButton) this._showErrorMenu(ClientStatus.FETCH_FAILED);
      }
    }

    _startUpdating() {
      this._updateUI().catch();

      if (this._fetchTimeoutId) {
        GLib.Source.remove(this._fetchTimeoutId);
      }

      this._fetchTimeoutId = GLib.timeout_add_seconds(
        GLib.PRIORITY_DEFAULT,
        this._interval,
        () => {
          this._updateUI().catch();
          return GLib.SOURCE_CONTINUE;
        },
      );
    }

    _updateStatusTextAndIcon(state) {
      if (state) {
        this._toggleItem.label.text = _("Status: Active");
        this._menuButton.icon.remove_style_class_name("icon-disabled");
      } else {
        this._toggleItem.label.text = _("Status: Blocking Disabled");
        this._menuButton.icon.add_style_class_name("icon-disabled");
      }
    }

    _showMainMenu(stats) {
      const state = stats.blocking === "enabled";

      this._updateStatusTextAndIcon(state);

      this._toggleItem.setToggleState(state);
      this._totalQueriesItem.text = stats.dns_queries_today;
      this._queriesBlockedItem.text = stats.ads_blocked_today;
      this._percentageBlockedItem.text = stats.ads_percentage_today + "%";
      this._domainsOnAdlistsItem.text = stats.domains_being_blocked;

      if (this._version === PIHOLE_VERSION_6 && this._showSensorData) {
        this._cpuUtilItem.text = stats.cpu + "%";
        this._memoryUsageItem.text = stats.memory + "%";
        this._temperatureItem.text = stats.temp;
      }

      if (!this._showingMain) {
        this._errorMessageItem.visible = false;
        this._mainItems.forEach((item) => (item.visible = true));
        this._showingMain = true;
      }
    }

    _getNotificationSource() {
      if (!this._notificationSource) {
        this._notificationSource = new MessageTray.Source({
          title: "Phi",
          icon: this._menuButton.icon.gicon,
        });

        this._notificationSource.connect("destroy", (_source) => {
          this._notificationSource = null;
        });

        Main.messageTray.add(this._notificationSource);
      }

      return this._notificationSource;
    }

    _showNotification(message) {
      const notification = new MessageTray.Notification({
        source: this._getNotificationSource(),
        title: message,
        isTransient: true,
      });

      this._getNotificationSource().addNotification(notification);
    }

    _updateVersionLabel(json) {
      this._settingsItem.text = `Pi-hole ${json.version}`;

      if (!this._checkNewVersion) {
        return;
      }

      if (json.updateExists) {
        this._showNotification("Update available for Pi-hole.");
        this._settingsItem.text = _("Update available!");
      }
    }

    _showErrorMenu(errorMessage) {
      this._errorMessageItem.label.text = errorMessage;
      this._settingsItem.text = "";

      if (this._showingMain !== false) {
        this._mainItems.forEach((item) => (item.visible = false));
        this._errorMessageItem.visible = true;
        this._showingMain = false;
      }
    }

    destroy() {
      if (this._fetchTimeoutId) {
        GLib.Source.remove(this._fetchTimeoutId);
      }

      this._settings = null;

      this._notificationSource?.destroy();
      this._notificationSource = null;

      this._piholeClient?.destroy();
      this._piholeClient = null;

      this._menuButton.destroy();
      this._menuButton = null;
    }
  },
);
