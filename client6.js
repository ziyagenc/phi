import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import Soup from "gi://Soup?version=3.0";

Gio._promisify(Soup.Session.prototype, "send_async", "send_finish");
Gio._promisify(Gio.OutputStream.prototype, "splice_async", "splice_finish");

export const PiholeClient6 = GObject.registerClass(
  {
    GTypeName: "PiholeClient6",
  },
  class PiholeClient6 extends GObject.Object {
    constructor(url, password) {
      super();
      this._url = url;
      this._password = password;
      this._auth_url = this._url + "/auth";
      this._stats_url = this._url + "/stats/summary";
      this._version_url = this._url + "/info/version";
      this._blocking_url = this._url + "/dns/blocking";
      this._sensors_url = this._url + "/info/sensors";
      this._system_url = this._url + "/info/system";

      this._session = new Soup.Session();
      // Leave a whitespace to be followed by libsoup version
      this._session.set_user_agent(`Phi/2.0 `);
      this._encoder = new TextEncoder();
      this._decoder = new TextDecoder();

      // Session identifier
      this._sid = "";
      // Validity of the sid in seconds, default value is 300.
      this._validity = 300;

      this.data = {};
      this.data.dns_queries_today = "Initializing";
      this.data.ads_blocked_today = "Initializing";
      this.data.ads_percentage_today = "Initializing";
      this.data.domains_being_blocked = "Initializing";
      this.data.version = "Initializing";
      this.data.blocking = false;
      this.data.updateExists = false;

      this.data.cpu = "Initializing";
      this.data.memory = "Initializing";
      this.data.temp = "Initializing";

      this._startAuthenticate();
    }

    async _readAsString(input_stream) {
      const output_stream = Gio.MemoryOutputStream.new_resizable();

      await output_stream.splice_async(
        input_stream,
        Gio.OutputStreamSpliceFlags.CLOSE_TARGET |
          Gio.OutputStreamSpliceFlags.CLOSE_SOURCE,
        GLib.PRIORITY_DEFAULT,
        null
      );

      const bytes = output_stream.steal_as_bytes();
      return this._decoder.decode(bytes.toArray());
    }

    _startAuthenticate() {
      this._authenticate();

      if (this._authTimeoutId) {
        GLib.Source.remove(this._authTimeoutId);
      }

      this._authTimeoutId = GLib.timeout_add_seconds(
        GLib.PRIORITY_DEFAULT,
        // Update again 10 seconds before the timeout.
        // TODO: If validity is less than 10, this causes crash.
        this._validity - 10,
        () => {
          this._delete_session();
          this._authenticate();
          return GLib.SOURCE_CONTINUE;
        }
      );
    }

    _authenticate() {
      const message = Soup.Message.new("POST", this._auth_url);
      message.set_request_body_from_bytes(
        "application/json",
        this._encoder.encode(`{"password": "${this._password}"}`)
      );
      message.connect(
        "accept-certificate",
        (msg, tls_peer_certificate, tls_peer_errors) => {
          return true;
        }
      );

      const bytes = this._session.send_and_read(message, null);

      if (message.status_code !== Soup.Status.OK) {
        return;
      }

      const data = this._decoder.decode(bytes.toArray());
      const authResult = JSON.parse(data);
      this._sid = authResult.session.sid;
      this._validity = authResult.session.validity;
    }

    _delete_session() {
      const message = Soup.Message.new("DELETE", this._auth_url);
      message.set_request_body_from_bytes(
        "application/json",
        this._encoder.encode(`{"sid": "${this._sid}"}`)
      );
      message.connect(
        "accept-certificate",
        (msg, tls_peer_certificate, tls_peer_errors) => {
          return true;
        }
      );

      const bytes = this._session.send_and_read(message, null);
    }

    async _fetchUrl(url) {
      const message = Soup.Message.new("GET", url);
      message.set_request_body_from_bytes(
        "application/json",
        this._encoder.encode(`{"sid": "${this._sid}"}`)
      );

      message.connect(
        "accept-certificate",
        (msg, tls_peer_certificate, tls_peer_errors) => {
          return true;
        }
      );

      const input_stream = await this._session.send_async(
        message,
        GLib.PRIORITY_DEFAULT,
        null
      );

      if (message.status_code !== Soup.Status.OK) {
        return JSON.parse("{}");
      }

      const data = await this._readAsString(input_stream);
      return JSON.parse(data);
    }

    async fetchSummary() {
      const json = await this._fetchUrl(this._stats_url);
      this.data.dns_queries_today = json.queries.total.toString();
      this.data.ads_blocked_today = json.queries.blocked.toString();
      this.data.ads_percentage_today = json.queries.percent_blocked.toFixed(1);
      this.data.domains_being_blocked =
        json.gravity.domains_being_blocked.toString();
    }

    async fetchVersion() {
      const json = await this._fetchUrl(this._version_url);
      this.data.version = json.version.core.local.version;

      // We assume local can never be newer than remote :)
      const newCoreAvailable =
        json.version.core.local.version !== json.version.core.remote.version;
      const newWebAvailable =
        json.version.web.local.version !== json.version.web.remote.version;
      const newFtlAvailable =
        json.version.ftl.local.version !== json.version.ftl.remote.version;

      this.data.updateExists =
        newCoreAvailable || newWebAvailable || newFtlAvailable;
    }

    async fetchBlocking() {
      const json = await this._fetchUrl(this._blocking_url);
      this.data.blocking = json.blocking;
    }

    async fetchSensors() {
      const json = await this._fetchUrl(this._sensors_url);

      if (json.sensors.cpu_temp != null) {
        this.data.temp = json.sensors.cpu_temp.toFixed(1);
      } else if (json.sensors.list[0].temps[0].value != null) {
        this.data.temp = json.sensors.list[0].temps[0].value.toFixed(1);
      } else {
        this.data.temp = "n/a";
      }

      // If we have a valid temperature value, add unit.
      if (this.data.temp !== "n/a") {
        // TODO: Does Pi-hole use any other unit?
        if (json.sensors.unit === "C") {
          this.data.temp += " °C";
        } else if (json.sensors.unit === "F") {
          this.data.temp += " °F";
        }
      }
    }

    async fetchSystem() {
      const json = await this._fetchUrl(this._system_url);
      this.data.cpu = json.system.cpu.load.percent[0].toFixed(1);
      this.data.memory = json.system.memory.ram["%used"].toFixed(1);
    }

    async fetchData() {
      await this.fetchBlocking();
      await this.fetchSummary();
      await this.fetchVersion();
      await this.fetchSensors();
      await this.fetchSystem();
    }

    togglePihole(state) {
      const message = Soup.Message.new("POST", this._blocking_url);
      message.set_request_body_from_bytes(
        "application/json",
        this._encoder.encode(`{"sid": "${this._sid}", "blocking": ${state}}`)
      );
      message.connect(
        "accept-certificate",
        (msg, tls_peer_certificate, tls_peer_errors) => {
          return true;
        }
      );

      const bytes = this._session.send_and_read(message, null);

      if (message.status_code !== Soup.Status.OK) {
        return;
      }

      const data = this._decoder.decode(bytes.toArray());
      const toggleResult = JSON.parse(data);
      this.data.blocking = toggleResult.blocking;
    }

    destroy() {
      this._delete_session();

      if (this._authTimeoutId) {
        GLib.Source.remove(this._authTimeoutId);
      }

      this._session = null;
    }
  }
);
