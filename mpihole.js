import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import St from "gi://St";

import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as MessageTray from "resource:///org/gnome/shell/ui/messageTray.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";

// PiholeClient v5
import { PiholeClient } from "./client.js";

// PiholeClient v6
import { PiholeClient6 } from "./client6.js";

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

      if (this._version1 == 0) {
        this._piholeClient1 = new PiholeClient(this._url1, this._token1);
      } else {
        this._piholeClient1 = new PiholeClient6(this._url1, this._token1);
      }

      if (this._version2 == 0) {
        this._piholeClient2 = new PiholeClient(this._url2, this._token2);
      } else {
        this._piholeClient2 = new PiholeClient6(this._url2, this._token2);
      }

      this._setHandlers();

      this._notificationSource = null;
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
      this._version1 = this._settings.get_uint("version1");
      this._version2 = this._settings.get_uint("version2");
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

      this._headerItem = new HeaderItem(this._name1, this._name2);
      this._line1 = new Line();
      this._totalQueriesItem = new MultiStatItem(_("Total Queries"));
      this._queriesBlockedItem = new MultiStatItem(_("Queries Blocked"));
      this._percentageBlockedItem = new MultiStatItem(_("Percentage Blocked"));
      this._domainsOnAdlistsItem = new MultiStatItem(_("Domains on AdLists"));
      if (
        (this._version1 == 1 || this._version2 == 1) &&
        this._showSensorData
      ) {
        this._line2 = new Line();
        this._cpuUtilItem = new MultiStatItem(_("CPU"));
        this._memoryUsageItem = new MultiStatItem(_("Memory Usage"));
        this._temperatureItem = new MultiStatItem(_("Temperature"));
      }
      this._line3 = new Line();
      this._settingsItem = new TailItem();
      const statsBox = new St.BoxLayout({ vertical: true });
      this._menuButton.menu.box.add_child(statsBox);

      statsBox.add_child(this._headerItem);
      statsBox.add_child(this._line1);
      statsBox.add_child(this._totalQueriesItem);
      statsBox.add_child(this._queriesBlockedItem);
      statsBox.add_child(this._percentageBlockedItem);
      statsBox.add_child(this._domainsOnAdlistsItem);
      if (
        (this._version1 == 1 || this._version2 == 1) &&
        this._showSensorData
      ) {
        statsBox.add_child(this._line2);
        statsBox.add_child(this._cpuUtilItem);
        statsBox.add_child(this._memoryUsageItem);
        statsBox.add_child(this._temperatureItem);
      }
      statsBox.add_child(this._line3);
      statsBox.add_child(this._settingsItem);

      Main.panel.addToStatusArea(this._me.uuid, this._menuButton);
    }

    _setHandlers() {
      this._settingsHandlerId = this._settings.connect("changed", () => {
        this._configure();
        if (this._isRunning) {
          this._piholeClient1.destroy();
          this._piholeClient2.destroy();

          // Index 0 represents v5.
          if (this._version1 == 0) {
            this._piholeClient1 = new PiholeClient(this._url1, this._token1);
          } else {
            this._piholeClient1 = new PiholeClient6(this._url1, this._token1);
          }

          if (this._version2 == 0) {
            this._piholeClient2 = new PiholeClient(this._url2, this._token2);
          } else {
            this._piholeClient2 = new PiholeClient6(this._url2, this._token2);
          }

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
      if (
        (this._version1 == 1 || this._version2 == 1) &&
        this._showSensorData
      ) {
        this._cpuUtilItem._label2.set_style_class_name(newLabelStyle);
        this._memoryUsageItem._label2.set_style_class_name(newLabelStyle);
        this._temperatureItem._label2.set_style_class_name(newLabelStyle);
      }
    }

    _updateSecondInstance(newState) {
      const newButtonStyle = newState ? "phi-button" : "phi-button disabled";
      const newLabelStyle = newState ? "stat-value" : "stat-value ver-value";
      this._headerItem._button2.set_style_class_name(newButtonStyle);
      this._totalQueriesItem._label3.set_style_class_name(newLabelStyle);
      this._queriesBlockedItem._label3.set_style_class_name(newLabelStyle);
      this._percentageBlockedItem._label3.set_style_class_name(newLabelStyle);
      this._domainsOnAdlistsItem._label3.set_style_class_name(newLabelStyle);
      if (
        (this._version1 == 1 || this._version2 == 1) &&
        this._showSensorData
      ) {
        this._cpuUtilItem._label3.set_style_class_name(newLabelStyle);
        this._memoryUsageItem._label3.set_style_class_name(newLabelStyle);
        this._temperatureItem._label3.set_style_class_name(newLabelStyle);
      }
    }

    _updatePanelIcon() {
      const state = this._headerItem.state1 && this._headerItem.state2;
      const iconStyle = state
        ? "system-status-icon"
        : "system-status-icon icon-disabled";
      this._menuButton.icon.set_style_class_name(iconStyle);
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

    async _updateUI() {
      try {
        await Promise.all([
          this._piholeClient1.fetchData(),
          this._piholeClient2.fetchData(),
        ]);

        // Make sure that the menu is there.
        if (!this._menuButton) return;

        const data1 = this._piholeClient1.data;
        const data2 = this._piholeClient2.data;

        const state1 = data1.blocking === "enabled";
        const state2 = data2.blocking === "enabled";
        this._headerItem.state1 = state1;
        this._headerItem.state2 = state2;
        this._updateFirstInstance(state1);
        this._updateSecondInstance(state2);
        this._updatePanelIcon();

        this._totalQueriesItem.text1 = data1.dns_queries_today;
        this._queriesBlockedItem.text1 = data1.ads_blocked_today;
        this._percentageBlockedItem.text1 = data1.ads_percentage_today + "%";
        this._domainsOnAdlistsItem.text1 = data1.domains_being_blocked;

        this._totalQueriesItem.text2 = data2.dns_queries_today;
        this._queriesBlockedItem.text2 = data2.ads_blocked_today;
        this._percentageBlockedItem.text2 = data2.ads_percentage_today + "%";
        this._domainsOnAdlistsItem.text2 = data2.domains_being_blocked;

        if (this._showSensorData) {
          if (this._version1 == 1) {
            this._cpuUtilItem.text1 = data1.cpu;
            this._memoryUsageItem.text1 = data1.memory;
            this._temperatureItem.text1 = data1.temp;
          } else {
            this._cpuUtilItem.text1 = "n/a";
            this._memoryUsageItem.text1 = "n/a";
            this._temperatureItem.text1 = "n/a";
          }

          if (this._version2 == 1) {
            this._cpuUtilItem.text2 = data2.cpu;
            this._memoryUsageItem.text2 = data2.memory;
            this._temperatureItem.text2 = data2.temp;
          } else {
            this._cpuUtilItem.text2 = "n/a";
            this._memoryUsageItem.text2 = "n/a";
            this._temperatureItem.text2 = "n/a";
          }
        }

        this._settingsItem.text1 = data1.version;
        this._settingsItem.text2 = data2.version;

        if (this._checkNewVersion && !this._checkedUpdate) {
          if (data1.updateExists) {
            this._showNotification(`Update available for ${this._name1}.`);
          }

          if (data2.updateExists) {
            this._showNotification(`Update available for ${this._name2}.`);
          }

          this._checkedUpdate = true;
        }
      } catch (err) {}
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

      this._notificationSource?.destroy();
      this._notificationSource = null;

      this._piholeClient1.destroy();
      this._piholeClient1 = null;

      this._piholeClient2.destroy();
      this._piholeClient2 = null;

      this._menuButton.destroy();
      this._menuButton = null;
    }
  }
);
