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

import { ItemContext, PrefsItem, StatsItem } from "./items.js";

const PiholeMenuTypes = {
  MAINMENU: 0,
  ERRORMENU: 1,
};

const ClientStatus = {
  FETCH_FAILED: _(
    "Error: Failed to get statistics.\nMake sure that Pi-hole is reachable."
  ),
  EMPTY_RESPONSE: _(
    "Error: Invalid response.\nMake sure that API token or password is set correctly."
  ),
  NOT_INITIALIZED: _(
    "API token or password is empty. If your Pi-hole is password\nprotected, please enter your API token or password in the settings\nto start monitoring."
  ),
  NO_NETWORK: _(
    "Monitoring has been paused as\nthe computer is currently offline."
  ),
  UNKNOWN_NETWORK: _("Monitoring is not enabled\nfor this network."),
};

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

      if (this._version == 0) {
        this._piholeClient = new PiholeClient(this._url, this._token);
      } else {
        this._piholeClient = new PiholeClient6(this._url, this._token);
      }

      this._setHandlers();

      if (command === "start") {
        this._startUpdating();
        this._isRunning = true;
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
        false
      );

      this._menuButton.icon = new St.Icon({
        style_class: "system-status-icon",
      });
      this._menuButton.icon.gicon = Gio.icon_new_for_string(
        this._me.path + "/icons/phi-symbolic.svg"
      );
      this._menuButton.add_child(this._menuButton.icon);

      // Error message item -- shown when an error occurs.
      // It has ItemContext.ERROR set in its "context" field.
      this._errorMessageItem = new PopupMenu.PopupMenuItem(_("Initializing"));
      this._errorMessageItem.itemContext = ItemContext.ERROR;
      this._menuButton.menu.addMenuItem(this._errorMessageItem);

      // Main menu items -- display information received from Pi-hole.
      // StatsItem has context=ItemContext.SUCCESS
      // When necessary, we add this field to separators, too.
      this._toggleItem = new PopupMenu.PopupSwitchMenuItem(
        "Initializing",
        false,
        {}
      );
      this._toggleItem.itemContext = ItemContext.SUCCESS;
      this._menuButton.menu.addMenuItem(this._toggleItem);

      // This separator will be hidden when error menu is shown.
      this._mainSeparator = new PopupMenu.PopupSeparatorMenuItem();
      this._mainSeparator.itemContext = ItemContext.SUCCESS;
      this._menuButton.menu.addMenuItem(this._mainSeparator);

      this._totalQueriesItem = new StatsItem(_("Total Queries"));
      this._menuButton.menu.addMenuItem(this._totalQueriesItem);

      this._queriesBlockedItem = new StatsItem(_("Queries Blocked"));
      this._menuButton.menu.addMenuItem(this._queriesBlockedItem);

      this._percentageBlockedItem = new StatsItem(_("Percentage Blocked"));
      this._menuButton.menu.addMenuItem(this._percentageBlockedItem);

      this._domainsOnAdlistsItem = new StatsItem(_("Domains on Lists"));
      this._menuButton.menu.addMenuItem(this._domainsOnAdlistsItem);

      // If this is Pi-hole v6
      if (this._version == 1 && this._showSensorData) {
        this._sensorsSeparator = new PopupMenu.PopupSeparatorMenuItem();
        this._menuButton.menu.addMenuItem(this._sensorsSeparator);

        this._cpuUtilItem = new StatsItem(_("CPU"));
        this._menuButton.menu.addMenuItem(this._cpuUtilItem);

        this._memoryUsageItem = new StatsItem(_("Memory Usage"));
        this._menuButton.menu.addMenuItem(this._memoryUsageItem);

        this._temperatureItem = new StatsItem(_("Temperature"));
        this._menuButton.menu.addMenuItem(this._temperatureItem);
      }

      this._prefSeparator = new PopupMenu.PopupSeparatorMenuItem();
      this._menuButton.menu.addMenuItem(this._prefSeparator);

      this._settingsItem = new PrefsItem();
      this._menuButton.menu.addMenuItem(this._settingsItem);

      Main.panel.addToStatusArea(this._me.uuid, this._menuButton);
    }

    _setHandlers() {
      this._toggleItem.connect("toggled", (_, state) => {
        this._piholeClient.togglePihole(state);
        this._updateStatusTextAndIcon(state);
      });

      this._settingsItem.connect("activate", () => {
        this._me.openPreferences();
      });

      this._settingsHandlerId = this._settings.connect("changed", () => {
        this._configure();
        if (this._isRunning) {
          this._piholeClient.destroy();
          if (this._version == 0) {
            this._piholeClient = new PiholeClient(this._url, this._token);
          } else {
            this._piholeClient = new PiholeClient6(this._url, this._token);
          }
          this._startUpdating();
        }
      });
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
        }
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
      this._percentageBlockedItem.text = stats.ads_percentage_today + " %";
      this._domainsOnAdlistsItem.text = stats.domains_being_blocked;

      if (this._version == 1 && this._showSensorData) {
        this._cpuUtilItem.text = stats.cpu + " %";
        this._memoryUsageItem.text = stats.memory + " %";
        this._temperatureItem.text = stats.temp;
      }

      if (this._currentMenu !== PiholeMenuTypes.MAINMENU) {
        this._menuButton.menu.box.get_children().forEach((item) => {
          item.visible = item.itemContext !== ItemContext.ERROR;
        });
        this._currentMenu = PiholeMenuTypes.MAINMENU;
      }
    }

    _showNotification(message) {
      const source = new MessageTray.Source({
        title: "Phi",
        icon: this._menuButton.icon.gicon,
      });
      const notification = new MessageTray.Notification({
        source,
        title: message,
        isTransient: true,
      });

      Main.messageTray.add(source);
      source.addNotification(notification);
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

      if (this._currentMenu !== PiholeMenuTypes.ERRORMENU) {
        this._menuButton.menu.box.get_children().forEach((item) => {
          item.visible = item.itemContext !== ItemContext.SUCCESS;
        });
        this._currentMenu = PiholeMenuTypes.ERRORMENU;
      }
    }

    destroy() {
      this._settings.disconnect(this._settingsHandlerId);
      this._settings = null;

      if (this._fetchTimeoutId) {
        GLib.Source.remove(this._fetchTimeoutId);
      }

      this._piholeClient.destroy();
      this._piholeClient = null;

      this._menuButton.destroy();
      this._menuButton = null;
    }
  }
);
