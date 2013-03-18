# socket-redis

## About
"socket-redis" starts a WebSocket emulation server ([SockJS](http://sockjs.org/)) where clients can connect to, and subscribe to multiple channels.
The server will let you consume client-related events like `message`, `subscribe` and `unsubscribe` on a [Redis](http://redis.io/) pub/sub channel `socket-redis-up`. Additionally it will subscribe to another pub/sub channel `socket-redis-down` where you can send messages to all clients in a channel.

When specifying multiple `--socket-ports` the script will spawn a child process for each port. This is provided as a simple way to make use of all your CPU cores.


## Server

### Installation
Package is in nodejs and is available through npm registry:
```
npm install socket-redis [-g]
```


### Running
You can run socket-redis using default arguments or specify them on your own.

`--redis-host` Specify host of redis server. Defaults to `localhost`.

`--socket-ports` Comma separated public ports which SockJS workers will listen on. Defaults to `8090`.

`--log-dir` Directory where log is stored. Script will try to create directory if needed. Defaults to `null` which means it will output to stdout.

`--status-port` Specify port for http status requests. It should not be publicly accesible. Defaults to `8085`

`--ssl-key` Specify ssl key file. Combine with `ssl-cert` option.

`--ssl-cert` Specify ssl certificate file. Combine with `ssl-key` option.

`--ssl-pfx` Specify ssl pfx file. Overrides `ssl-key` and `ssl-cert` options.


### Messages published to redis pub/sub channel `socket-redis-up`:
- `{type: "subscribe", data: {channel: <channel>, clientKey: <clientKey>, data: <subscribe-data>}}`
- `{type: "unsubscribe", data: {channel: <channel>, clientKey: <clientKey>}}`
- `{type: "message", data: {clientKey: <clientKey>, data: <data>}}`

### Messages which are detected on redis pub/sub channel `socket-redis-down`:
- `{type: "message", data: {channel: <channel>, data: <data>}}`

### Status request
Server also answers http requests (on port 8085 by default). You can request on-demand state of all subscribers grouped by channels.

Status response schema:

```javascript
{<channel>: {
	"subscribers": {
		<clientKey>: {
			"clientKey": <clientKey>,
			"subscribeStamp": <subscribe-stamp>,
			"data": {}
		}
	}
}
```

## Client

### Installation
Include the SockJS and socket-redis client libraries in your html file:
```html
<script src="http://cdn.sockjs.org/sockjs-0.3.min.js"></script>
<script src="https://raw.github.com/cargomedia/socket-redis/master/client/socket-redis.js"></script>
```

### Example
To receive messages from the server create a new `SocketRedis` instance and subsribe to some channels:
```
var socketRedis = new SocketRedis('http://example.com:8090');
socketRedis.onopen = function() {
	socketRedis.subscribe('channel-name', null, {foo: 'bar'}, function(data) {
		console.log('New message on channel `channel-name`:', data);
	});

	socketRedis.unsubscribe('channel-name');
};
```

To send messages to the server:
```
socketRedis.send({foo: 'bar'});
```
