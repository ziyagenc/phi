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
      this._authUrl = url + "/admin/api.php?auth=" + token;
      this._summaryUrl = this._authUrl + "&summary";
      this._versionsUrl = this._authUrl + "&versions";

      this._session = new Soup.Session();
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
      const text_decoder = new TextDecoder("utf-8");
      return text_decoder.decode(bytes.toArray().buffer);
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
        return;
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
      return json;
    }

    /**
     * Fetch the version information from the Pi-hole server
     * @returns {Promise<Object>} The version information as JSON 
     */

    async fetchVersion() {
      const json = await this._fetchUrl(this._versionsUrl);
      return json;
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
    }

    destroy() {
      this._session = null;
    }
  }
);
