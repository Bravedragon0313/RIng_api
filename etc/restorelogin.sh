#!/usr/bin/expect
spawn passwd admin
expect "Enter new UNIX password:"
send "avlinkpro"
send -- "\r"
expect "Retype new UNIX password:"
send "avlinkpro"
send -- "\r"
interact
