#!/bin/bash

echo -e "remote" | nc 192.168.1.154 8888
sleep 5

out=`/usr/sbin/asterisk -rvx " confbridge list ring01" | wc -l`
echo $out

if [[ $out -eq 5 ]]; then
    sleep 1m
    /usr/sbin/asterisk -rvx "hangup request all"
else
    sleep 5m
    /usr/sbin/asterisk -rvx "hangup request all"
fi
