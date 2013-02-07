# socket-redis

## About
"socket-redis" starts a WebSocket emulation server ([SockJS](http://sockjs.org/)) where clients can connect to, and subscribe to multiple channels.
The server will let you consume client-related events like `message`, `subscribe` and `unsubscribe` on a [Redis](http://redis.io/) pub/sub channel `socket-redis-up`. Additionally it will subscribe to another pub/sub channel `socket-redis-down` where you can send messages to all clients in a channel.

When specifying multiple `--socket-ports` the script will spawn a child process for each port. This is provided as a simple way to make use of all your CPU cores. 
### Messages which are detected on the WebSocket connection:
- `{event: "subscribe", channel: <channel>, start: <firstMessageStampToReceive>, data: <subscribe-data>}`
- `{event: "unsubscribe", channel: <channel>}`
- `{event: "message", data: <data>}`

### Messages published to redis pub/sub channel `socket-redis-up`:
- `{type: "subscribe", data: {channel: <channel>, clientKey: <clientKey>, data: <subscribe-data>}`
- `{type: "unsubscribe", data: {channel: <channel>, clientKey: <clientKey>}`
- `{type: "message", data: {data: <data>}`

### Messages which are detected on redis pub/sub channel `socket-redis-down`:
- `{type: "message", data: {channel: <channel>, data: <data>}`


## Installation
Package is in nodejs and is available through npm registry:
```
npm install socket-redis [-g]
``` 

## Running
You can run socket-redis using default arguments or specify them on your own. 

`--redis-host` Specify host of redis server. Defaults to `localhost`.

`--socket-ports` Comma separated ports which SockJS workers will listen on. Defaults to `8090`.

`--log-dir` Directory where log is stored. Script will try to create directory if needed. Defaults to `null` which means it will output to stdout.
