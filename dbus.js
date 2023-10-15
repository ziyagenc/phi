const { Gio } = imports.gi;

async function _getNetworkProxyAsync() {
  const NetworkProxyXml = `
    <node>
      <interface name="org.freedesktop.NetworkManager">
        <property name="PrimaryConnection" type="o" access="read"/>
      </interface>
    </node>`;
  const NetworkProxy = Gio.DBusProxy.makeProxyWrapper(NetworkProxyXml);
  const networkProxyAsync = await new Promise((resolve, reject) => {
    NetworkProxy(
      Gio.DBus.system,
      "org.freedesktop.NetworkManager",
      "/org/freedesktop/NetworkManager",
      (proxy, error) => {
        if (error === null) resolve(proxy);
        else reject(error);
      },
      null,
      Gio.DBusProxyFlags.NONE
    );
  });

  return networkProxyAsync;
}

async function _getNetworkIdProxyAsync(objectPath) {
  const NetworkIdProxyXml = `
    <node>
      <interface name="org.freedesktop.NetworkManager.Connection.Active">
        <property name="Id" type="s" access="read"/>
      </interface>
    </node>`;
  const NetworkIdProxy = Gio.DBusProxy.makeProxyWrapper(NetworkIdProxyXml);
  const networkIdProxyAsync = await new Promise((resolve, reject) => {
    NetworkIdProxy(
      Gio.DBus.system,
      "org.freedesktop.NetworkManager",
      objectPath,
      (proxy, error) => {
        if (error === null) resolve(proxy);
        else reject(error);
      },
      null,
      Gio.DBusProxyFlags.NONE
    );
  });

  return networkIdProxyAsync;
}

async function getNetworkIdAsync() {
  const networkProxyAsync = await _getNetworkProxyAsync();
  const primaryConnection = networkProxyAsync.PrimaryConnection;
  const networkIdProxyAsync = await _getNetworkIdProxyAsync(primaryConnection);

  return networkIdProxyAsync.Id;
}
