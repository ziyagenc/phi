export const PIHOLE_VERSION_5 = 0;
export const PIHOLE_VERSION_6 = 1;

export const ClientStatus = {
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