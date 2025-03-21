import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import Soup from "gi://Soup?version=3.0";

Gio._promisify(
  Gio.InputStream.prototype,
  "read_bytes_async",
  "read_bytes_finish"
);
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

      if (this._password.length === 0) {
        this._passwordSet = false;
      } else {
        this._passwordSet = true;
      }

      this._auth_url = this._url + "/auth";
      this._padd_url = this._url + "/padd";
      this._blocking_url = this._url + "/dns/blocking";

      this._session = new Soup.Session();
      // Leave a whitespace to be followed by libsoup version
      this._session.set_user_agent(`Phi/2.3 `);
      this._encoder = new TextEncoder();
      this._decoder = new TextDecoder();

      // Session identifier
      this._sid = "";

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

    async _authenticate() {
      const message = Soup.Message.new("POST", this._auth_url);

      message.set_request_body_from_bytes(
        "application/json",
        this._encoder.encode(`{"password": "${this._password}"}`)
      );

      message.connect(
        "accept-certificate",
        (msg, tls_peer_certificate, tls_peer_errors) => {
          // This function is called when the certificate cannot
          // be validated. We could provide an option in the settings
          // for entering certificate details and inspect if they
          // match here. But, do we really want this?

          // Those who are concerned about the security of their
          // Pi-hole connection should import its self-signed
          // certificate and uncomment the following line.

          // return false;

          // N.B. The following check does not increase security either.
          // if (tls_peer_certificate.get_subject_name() === "CN=pi.hole") {
          //   return true;
          // }

          // Therefore, we simply accept the certificate.
          return true;
        }
      );

      const input_stream = await this._session.send_async(
        message,
        GLib.PRIORITY_DEFAULT,
        null
      );

      if (message.status_code !== Soup.Status.OK) {
        return;
      }

      const data = await this._readAsString(input_stream);
      const authResult = JSON.parse(data);
      this._sid = authResult.session.sid;
    }

    async _delete_session() {
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

      await this._session.send_async(message, GLib.PRIORITY_DEFAULT, null);
    }

    async _fetchUrl(url) {
      const message = Soup.Message.new("GET", url);

      if (this._passwordSet) {
        message.set_request_body_from_bytes(
          "application/json",
          this._encoder.encode(`{"sid": "${this._sid}"}`)
        );
      }

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

    async fetchData() {
      if (this._passwordSet && this._sid === "") {
        await this._authenticate();
      }

      const json = await this._fetchUrl(this._padd_url);

      this.data.dns_queries_today = json.queries.total.toString();
      this.data.ads_blocked_today = json.queries.blocked.toString();
      this.data.ads_percentage_today = json.queries.percent_blocked.toFixed(1);
      this.data.domains_being_blocked = json.gravity_size.toString();
      this.data.version = json.version.core.local.version;

      // We assume local can never be newer than remote :)
      const newCoreAvailable =
        json.version.core.local.hash !== json.version.core.remote.hash;
      const newWebAvailable =
        json.version.web.local.hash !== json.version.web.remote.hash;
      const newFtlAvailable =
        json.version.ftl.local.hash !== json.version.ftl.remote.hash;

      this.data.updateExists =
        newCoreAvailable || newWebAvailable || newFtlAvailable;

      this.data.blocking = json.blocking;

      this.data.cpu = json["%cpu"].toFixed(1);
      this.data.memory = json["%mem"].toFixed(1);

      // FTL v6.0.4 can only read sensors in /sys/class/hwmon/hwmonX
      if (json.sensors.cpu_temp != null) {
        this.data.temp = json.sensors.cpu_temp.toFixed(1);
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
        } else if (json.sensors.unit === "K") {
          this.data.temp += " °K";
        }
      }
    }

    async _doToggle(state) {
      const message = Soup.Message.new("POST", this._blocking_url);

      if (this._passwordSet) {
        message.set_request_body_from_bytes(
          "application/json",
          this._encoder.encode(`{"sid": "${this._sid}", "blocking": ${state}}`)
        );
      } else {
        message.set_request_body_from_bytes(
          "application/json",
          this._encoder.encode(`{"blocking": ${state}}`)
        );
      }

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
        return;
      }

      const data = await this._readAsString(input_stream);
      const toggleResult = JSON.parse(data);
      this.data.blocking = toggleResult.blocking;
    }

    togglePihole(state) {
      this._doToggle(state).catch();
    }

    destroy() {
      if (this._passwordSet) {
        this._delete_session().catch();
      }

      if (this._authTimeoutId) {
        GLib.Source.remove(this._authTimeoutId);
      }

      this._session = null;
    }
  }
);
