import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import St from "gi://St";

import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";

import { PiholeClient } from "./client.js";
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
    "Error: Invalid response.\nMake sure that API token is set correctly."
  ),
  NOT_INITIALIZED: _(
    "API token is empty. If your Pi-hole is password\nprotected, please enter your API token in the settings\nto start monitoring."
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

  /**
   * Represents a Pi-hole monitoring application
   * Initializes the Pi-hole client, creates a menu button, handles user interactions, and updates the UI with Pi-hole statistics
   *
   * @param {object} me - An object representing the application
   * @param {object} settings - An object containing the Pi-hole settings
   * @param {string} command - A string indicating the command to execute
   *
   * @example
   * const pihole = new Pihole(me, settings, command);
   */

    constructor(me, settings, command) {
      super();

      this._me = me;
      this._settings = settings;

      this._configure();
      this._makeMenu();

      this._piholeClient = new PiholeClient(this._url, this._token);
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
      this._interval = this._settings.get_uint("interval");
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
      this._errorMessageItem.context = ItemContext.ERROR;
      this._menuButton.menu.addMenuItem(this._errorMessageItem);

      // Main menu items -- display information received from Pi-hole.
      // StatsItem has context=ItemContext.SUCCESS
      // When necessary, we add this field to separators, too.
      this._toggleItem = new PopupMenu.PopupSwitchMenuItem(
        "Initializing",
        false,
        {}
      );
      this._toggleItem.context = ItemContext.SUCCESS;
      this._menuButton.menu.addMenuItem(this._toggleItem);

      // This separator will be hidden when error menu is shown.
      this._mainSeparator = new PopupMenu.PopupSeparatorMenuItem();
      this._mainSeparator.context = ItemContext.SUCCESS;
      this._menuButton.menu.addMenuItem(this._mainSeparator);

      this._totalQueriesItem = new StatsItem(_("Total Queries"));
      this._menuButton.menu.addMenuItem(this._totalQueriesItem);

      this._queriesBlockedItem = new StatsItem(_("Queries Blocked"));
      this._menuButton.menu.addMenuItem(this._queriesBlockedItem);

      this._percentageBlockedItem = new StatsItem(_("Percentage Blocked"));
      this._menuButton.menu.addMenuItem(this._percentageBlockedItem);

      this._domainsOnAdlistsItem = new StatsItem(_("Domains on AdLists"));
      this._menuButton.menu.addMenuItem(this._domainsOnAdlistsItem);

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
          this._piholeClient = new PiholeClient(this._url, this._token);
          this._startUpdating();
        }
      });
    }

    async _updateUI() {
      try {
        const stats = await this._piholeClient.fetchSummary();

        // Make sure that the menu is there.
        if (!this._menuButton) return;

        if (Object.keys(stats).length === 0) {
          // Is API key set?
          if (this._token === "") {
            this._showErrorMenu(ClientStatus.NOT_INITIALIZED);
          } else {
            // API key is entered, but we still got empty response.
            // Most likely the key is not correct.
            this._showErrorMenu(ClientStatus.EMPTY_RESPONSE);
          }
          return;
        }

        if (this._settingsItem.text === "") {
          const version = await this._piholeClient.fetchVersion();
          this._updateVersionLabel(version);
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
      const state = stats.status === "enabled";

      this._updateStatusTextAndIcon(state);

      this._toggleItem.setToggleState(state);
      this._totalQueriesItem.text = stats.dns_queries_today;
      this._queriesBlockedItem.text = stats.ads_blocked_today;
      this._percentageBlockedItem.text = stats.ads_percentage_today + "%";
      this._domainsOnAdlistsItem.text = stats.domains_being_blocked;

      if (this._currentMenu !== PiholeMenuTypes.MAINMENU) {
        this._menuButton.menu.box.get_children().forEach((item) => {
          item.visible = item.context !== ItemContext.ERROR;
        });
        this._currentMenu = PiholeMenuTypes.MAINMENU;
      }
    }

    _updateVersionLabel(json) {
      const updateExists =
        json.core_update || json.FTL_update || json.web_update;
      this._settingsItem.text = updateExists
        ? _("Update available!")
        : `Pi-hole ${json.core_current}`;
    }

    _showErrorMenu(errorMessage) {
      this._errorMessageItem.label.text = errorMessage;
      this._settingsItem.text = "";

      if (this._currentMenu !== PiholeMenuTypes.ERRORMENU) {
        this._menuButton.menu.box.get_children().forEach((item) => {
          item.visible = item.context !== ItemContext.SUCCESS;
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
