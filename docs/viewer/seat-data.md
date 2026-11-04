# Seat data

Seat data is information about a seat that belongs to **this event or this user**, not to the venue: a price, a category, the user's ticket number. The viewer keeps it in memory and gives it to tooltips; it is **never written into the floorplan**.

## Set and read

<<< @/snippets/viewer/seat-data.ts#set

Each entry replaces that seat's data object. To change one field, pass the whole object again.

## App data and live data

Seat data comes from two places:

- **App data**: what you set with `setSeatData` or the `seatData` option.
- **Live data**: what the server sends with [live updates](/live/), such as current prices.

The viewer keeps them apart, so a live snapshot (sent on every reconnect) never wipes your own data. `getSeatData()` and tooltips see them merged, with your fields taking precedence:

<<< @/snippets/viewer/seat-data.ts#layers

::: warning Keep personal data out of live updates
Live data is broadcast to everyone viewing the floorplan. Send only what all of them may see (prices, categories). Keep per-user data, like a ticket, in `setSeatData`.
:::
