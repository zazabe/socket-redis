socket-redis
=========

Script collects events from Redis pub/sub `socket-redis-down` to distribute them to SockJS workers.

Script publishes events to Redis pub/sub `socket-redis-up` from SockJS workers.

Specify multipe ports to fork several worker processes.

Arguments
---------

`--redis-host` Specify host of redis server. Defaults to `localhost`.

`--socket-ports` Comma separated ports which SockJS workers will listen on. Defaults to `8090`.

`--log-dir` Directory where log is stored. Script will try to create directory if needed. Defaults to `null` which means it will output to stdout.
