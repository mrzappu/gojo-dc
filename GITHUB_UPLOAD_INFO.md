# GOJO Discord Bot — GitHub Upload Notes

This archive contains the complete project folder. Keep the existing folder structure when uploading it to GitHub.

## Steam and Epic game cards

Both `/post-steam` and `/post-epic` use the same Buy Game link button and animated `ArrowShow` emoji:

- Label: `Buy Game`
- Emoji: `ArrowShow` (animated custom emoji)
- Destination: the configured Discord ticket channel URL in the command source

## Button color limitation

Discord does not allow custom white/transparent colors for link buttons. Link-button appearance is controlled by Discord's client/theme. A non-link button can use Discord's predefined styles, but it cannot directly open a channel URL without an interaction handler. The existing link button is retained to preserve direct ticket-channel navigation and avoid changing other bot behavior.

## Upload

Upload the contents of `gojo-dc-main/` to your repository (or upload the ZIP as a release asset). Do not commit `.env`, bot tokens, or other secrets.
