#!/usr/bin/expect
spawn /opt/forticlient-sslvpn/64bit/forticlientsslvpn_cli --server 199.73.111.50:443 --vpnuser john
expect "Password for VPN:"
send "computek\r"
expect "*(Y/N)"
send "Y\r"
interact
