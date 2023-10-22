const { Gio, GLib, GObject, St } = imports.gi;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
ExtensionUtils.initTranslations(Me.metadata["gettext-domain"]);
const _ = ExtensionUtils.gettext;

const PiholeClient = Me.imports.client.PiholeClient;
const { HeaderItem, Line, MultiStatItem, TailItem } = Me.imports.mitems;

const PiholeMenuButton = GObject.registerClass(
  class PiholeMenuButton extends PanelMenu.Button {
    _init() {
      super._init(0.0, _("Pihole Menu Button"));

      this.icon = new St.Icon({ style_class: "system-status-icon" });
      this.icon.gicon = Gio.icon_new_for_string(
        Me.path + "/icons/phi-symbolic.svg"
      );
      this.add_child(this.icon);
    }
  }
);

var Pihole = GObject.registerClass(
  class Pihole extends GObject.Object {
    constructor(initParam) {
      super();

      this._settings = ExtensionUtils.getSettings();
      this._configure();

      this._menuButton = new PiholeMenuButton();
      this._makeMenu();

      this._piholeClient1 = new PiholeClient(this._url1, this._token1);
      this._piholeClient2 = new PiholeClient(this._url2, this._token2);
      this._setHandlers();

      if (initParam === "start") {
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

      Main.panel.addToStatusArea(Me.metadata.uuid, this._menuButton);
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
        ExtensionUtils.openPrefs();
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
      if (!this._menuButton) return;

      try {
        const [summary1, summary2] = await Promise.all([
          this._piholeClient1.fetchSummary(),
          this._piholeClient2.fetchSummary(),
        ]);

        const [ver1, ver2] = await Promise.all([
          this._piholeClient1.fetchVersion(),
          this._piholeClient2.fetchVersion(),
        ]);

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

        this._settingsItem.text1 = ver1.core_current;
        this._settingsItem.text2 = ver2.core_current;
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
