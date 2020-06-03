#!/bin/sh
SERVICE='ffmpeg'
 
if ps ax | grep -v grep | grep $SERVICE > /dev/null
then
    echo "$SERVICE service running, everything is fine"
else
    echo "$SERVICE is not running"
sudo pkill ffserver
fi
