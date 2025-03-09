import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import Soup from "gi://Soup";

Gio._promisify(Soup.Session.prototype, "send_async", "send_finish");
Gio._promisify(Gio.OutputStream.prototype, "splice_async", "splice_finish");

export const PiholeClient = GObject.registerClass(
  {
    GTypeName: "PiholeClient",
  },
  class PiholeClient extends GObject.Object {

    /**
     * Create a new instance of the Pihole Client class
     * @param {string} url - The base URL of the Pi-hole server
     * @param {string} token - The authentication token for the Pi-hole server
     */

    constructor(url, token) {
      super();
      this._authUrl = url + "?auth=" + token;
      this._summaryUrl = this._authUrl + "&summary";
      this._versionsUrl = this._authUrl + "&versions";

      this._session = new Soup.Session();
      this._session.set_user_agent(`Phi/2.3 `);
      this._decoder = new TextDecoder();

      this.data = {};
      this.data.dns_queries_today = "Initializing";
      this.data.ads_blocked_today = "Initializing";
      this.data.ads_percentage_today = "Initializing";
      this.data.domains_being_blocked = "Initializing";
      this.data.version = "Initializing";
      this.data.blocking = false;
      this.data.updateExists = false;
    }

    /**
     * Read the input stream as a string.
     * @param {Gio.InputStream} input_stream - The input stream to read
     * @returns {Promise<string>} The decoded text
     */

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

    /**
     * Fetch the content of the specified URL.
     * @private
     * @param {string} url - The URL to fetch
     * @returns {Promise<Object>} As a JSON object
     */

    async _fetchUrl(url) {
      const message = Soup.Message.new("GET", url);

      const input_stream = await this._session.send_async(
        message,
        GLib.PRIORITY_DEFAULT,
        null
      );

      if (message.status_code !== Soup.Status.OK) {
        this._handleError(ClientError.HTTP_NOT_OK);
        return JSON.parse("{}");
      }

      const data = await this._readAsString(input_stream);
      return JSON.parse(data);
    }

    /**
     * Fetch the summary information from the Pi-hole server
     * @returns {Promise<Object>} The summary info as a JSON
     */

    async fetchSummary() {
      const json = await this._fetchUrl(this._summaryUrl);
      this.data.dns_queries_today = json.dns_queries_today;
      this.data.ads_blocked_today = json.ads_blocked_today;
      this.data.ads_percentage_today = json.ads_percentage_today;
      this.data.domains_being_blocked = json.domains_being_blocked;

      // Status: enabled/disabled
      this.data.blocking = json.status;
    }

    /**
     * Fetch the version information from the Pi-hole server
     * @returns {Promise<Object>} The version information as JSON 
     */

    async fetchVersion() {
      const json = await this._fetchUrl(this._versionsUrl);
      this.data.version = json.core_current;

      this.data.updateExists =
        json.core_update || json.web_update || json.FTL_update;
    }

    async fetchData() {
      await this.fetchSummary();
      await this.fetchVersion();
    }

    /**
     * Toggle the Pi-hole state.
     * @param {boolean} state - The state to toggle (true for enable, false for disable).
     */

    togglePihole(state) {
      const toggleUrl = state
        ? this._authUrl + "&enable"
        : this._authUrl + "&disable";

      this._fetchUrl(toggleUrl).catch();
      this.data.blocking = state ? "enabled" : "disabled";
    }

    destroy() {
      this._session = null;
    }
  }
);
