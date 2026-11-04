# Socket.IO adapter

`socketIoStatusSource(socket, options?)` turns a socket.io-client v4 socket into a live status source for the viewer.

```sh
npm install socket.io-client
```

## Connect

One connection shows one floorplan. Name it in the handshake, together with whatever your server needs to authorize the user:

<<< @/snippets/live/socket-io.ts#connect

On every connect the adapter asks the server for a snapshot (`seats:sync`), then applies `seats:patch` broadcasts. Reconnection, back-off and the HTTP long-polling fallback come from Socket.IO itself.

## Show the connection state

<<< @/snippets/live/socket-io.ts#state

| State        | Meaning                                                                                              |
| :----------- | :--------------------------------------------------------------------------------------------------- |
| `connecting` | Waiting for the first snapshot, initially or after a reconnect.                                      |
| `live`       | A snapshot was applied; patches are flowing.                                                         |
| `offline`    | The server refused the connection, the sync failed or timed out, or the socket stopped reconnecting. |
| `null`       | No source is connected.                                                                              |

## Options

| Option          | Default | Description                                                                                   |
| :-------------- | :------ | :-------------------------------------------------------------------------------------------- |
| `syncTimeoutMs` | `10000` | How long to wait for the snapshot before reporting `offline`. The next reconnect syncs again. |

## Stop or switch

<<< @/snippets/live/socket-io.ts#switch

`viewer.destroy()` also stops the source. It doesn't disconnect your socket, since you may share it with the rest of your app.

## Angular

Pass the source to `<seats-viewer [statusSource]="source">`. See [Angular → Live updates](/angular/viewer#live-updates).
