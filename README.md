 Redis.io
=========

Script collects events from Redis server and distributes it to socket.io workers. Workload is split among all cpus.
All socket.io workers listen on the same port using Cluster.

Arguments
---------

`--redis-hosts` Specify comma separated hosts of redis servers. Master script will subscribe to all of them and distribute incoming events to workers. Defaults to `localhost`.

`--socket-port` Port which socket.io workers will listen on. Defaults to `8090`.

`--log-dir` Directory where log(s) should be stored. Script will try to create directory if not exists. Will fail if no permission. Defaults to `/var/log/socket-redis`.
