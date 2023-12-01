import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import St from "gi://St";

import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";

import { PiholeClient } from "./client.js";
import { HeaderItem, Line, MultiStatItem, TailItem } from "./mitems.js";

export const MPihole = GObject.registerClass(
  {
    GTypeName: "MPihole",
  },
  class MPihole extends GObject.Object {
    constructor(me, settings, command) {
      super();

      this._me = me;
      this._settings = settings;

      this._configure();
      this._makeMenu();

      this._piholeClient1 = new PiholeClient(this._url1, this._token1);
      this._piholeClient2 = new PiholeClient(this._url2, this._token2);
      this._setHandlers();

      this._checkedUpdate = false;

      if (command === "start") {
        this._startUpdating();
        this._isRunning = true;
      }
    }

    _configure() {
      this._url1 = this._settings.get_string("url1");
      this._url2 = this._settings.get_string("url2");
      this._token1 = this._settings.get_string("token1");
      this._token2 = this._settings.get_string("token2");
      this._name1 = this._settings.get_string("instance1");
      this._name2 = this._settings.get_string("instance2");
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

      this._headerItem = new HeaderItem(this._name1, this._name2);
      this._line1 = new Line();
      this._totalQueriesItem = new MultiStatItem(_("Total Queries"));
      this._queriesBlockedItem = new MultiStatItem(_("Queries Blocked"));
      this._percentageBlockedItem = new MultiStatItem(_("Percentage Blocked"));
      this._domainsOnAdlistsItem = new MultiStatItem(_("Domains on AdLists"));
      this._line2 = new Line();
      this._settingsItem = new TailItem();

      const statsBox = new St.BoxLayout({ vertical: true });
      this._menuButton.menu.box.add_child(statsBox);

      statsBox.add_child(this._headerItem);
      statsBox.add_child(this._line1);
      statsBox.add_child(this._totalQueriesItem);
      statsBox.add_child(this._queriesBlockedItem);
      statsBox.add_child(this._percentageBlockedItem);
      statsBox.add_child(this._domainsOnAdlistsItem);
      statsBox.add_child(this._line2);
      statsBox.add_child(this._settingsItem);

      Main.panel.addToStatusArea(this._me.uuid, this._menuButton);
    }

    _setHandlers() {
      this._settingsHandlerId = this._settings.connect("changed", () => {
        this._configure();
        if (this._isRunning) {
          this._piholeClient1.destroy();
          this._piholeClient2.destroy();
          this._piholeClient1 = new PiholeClient(this._url1, this._token1);
          this._piholeClient2 = new PiholeClient(this._url2, this._token2);
          this._headerItem._button1.label = this._name1;
          this._headerItem._button2.label = this._name2;
          this._startUpdating();
        }
      });

      this._headerItem._button1.connect("clicked", () => {
        const newState = !this._headerItem.state1;
        this._piholeClient1.togglePihole(newState);
        this._headerItem.state1 = newState;
        this._updateFirstInstance(newState);
        this._updatePanelIcon();
      });

      this._headerItem._button2.connect("clicked", () => {
        const newState = !this._headerItem.state2;
        this._piholeClient2.togglePihole(newState);
        this._headerItem.state2 = newState;
        this._updateSecondInstance(newState);
        this._updatePanelIcon();
      });

      this._settingsItem._button.connect("clicked", () => {
        this._me.openPreferences();
      });
    }

    _updateFirstInstance(newState) {
      const newButtonStyle = newState ? "phi-button" : "phi-button disabled";
      const newLabelStyle = newState ? "stat-value" : "stat-value ver-value";
      this._headerItem._button1.set_style_class_name(newButtonStyle);
      this._totalQueriesItem._label2.set_style_class_name(newLabelStyle);
      this._queriesBlockedItem._label2.set_style_class_name(newLabelStyle);
      this._percentageBlockedItem._label2.set_style_class_name(newLabelStyle);
      this._domainsOnAdlistsItem._label2.set_style_class_name(newLabelStyle);
    }

    _updateSecondInstance(newState) {
      const newButtonStyle = newState ? "phi-button" : "phi-button disabled";
      const newLabelStyle = newState ? "stat-value" : "stat-value ver-value";
      this._headerItem._button2.set_style_class_name(newButtonStyle);
      this._totalQueriesItem._label3.set_style_class_name(newLabelStyle);
      this._queriesBlockedItem._label3.set_style_class_name(newLabelStyle);
      this._percentageBlockedItem._label3.set_style_class_name(newLabelStyle);
      this._domainsOnAdlistsItem._label3.set_style_class_name(newLabelStyle);
    }

    _updatePanelIcon() {
      const state = this._headerItem.state1 && this._headerItem.state2;
      const iconStyle = state
        ? "system-status-icon"
        : "system-status-icon icon-disabled";
      this._menuButton.icon.set_style_class_name(iconStyle);
    }

    async _updateUI() {
      try {
        const [summary1, summary2] = await Promise.all([
          this._piholeClient1.fetchSummary(),
          this._piholeClient2.fetchSummary(),
        ]);

        if (!this._checkedUpdate) {
          const [ver1, ver2] = await Promise.all([
            this._piholeClient1.fetchVersion(),
            this._piholeClient2.fetchVersion(),
          ]);

          const updateExistsForPi1 =
            ver1.core_update || ver1.FTL_update || ver1.web_update;

          if (updateExistsForPi1) {
            Main.notify("Phi", `Update available for ${this._name1}.`);
          }

          const updateExistsForPi2 =
            ver2.core_update || ver2.FTL_update || ver2.web_update;

          if (updateExistsForPi2) {
            Main.notify("Phi", `Update available for ${this._name2}.`);
          }

          // TODO: Fix repetiton.
          // Make sure that the menu is there.
          if (this._menuButton) {
            this._settingsItem.text1 = ver1.core_current;
            this._settingsItem.text2 = ver2.core_current;
          }

          this._checkedUpdate = true;
        }

        // Make sure that the menu is there.
        if (!this._menuButton) return;

        const state1 = summary1.status === "enabled";
        const state2 = summary2.status === "enabled";
        this._headerItem.state1 = state1;
        this._headerItem.state2 = state2;
        this._updateFirstInstance(state1);
        this._updateSecondInstance(state2);
        this._updatePanelIcon();

        this._totalQueriesItem.text1 = summary1.dns_queries_today;
        this._queriesBlockedItem.text1 = summary1.ads_blocked_today;
        this._percentageBlockedItem.text1 = summary1.ads_percentage_today + "%";
        this._domainsOnAdlistsItem.text1 = summary1.domains_being_blocked;

        this._totalQueriesItem.text2 = summary2.dns_queries_today;
        this._queriesBlockedItem.text2 = summary2.ads_blocked_today;
        this._percentageBlockedItem.text2 = summary2.ads_percentage_today + "%";
        this._domainsOnAdlistsItem.text2 = summary2.domains_being_blocked;
      } catch (err) {
        console.log(err, "Error in _updateUI");
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

    destroy() {
      this._settings.disconnect(this._settingsHandlerId);
      this._settings = null;

      if (this._fetchTimeoutId) {
        GLib.Source.remove(this._fetchTimeoutId);
      }

      this._piholeClient1.destroy();
      this._piholeClient1 = null;

      this._piholeClient2.destroy();
      this._piholeClient2 = null;

      this._menuButton.destroy();
      this._menuButton = null;
    }
  }
);
