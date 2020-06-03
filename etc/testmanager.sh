#!/bin/bash

# Some variables for customisation
ASTERISK_HOST=localhost
AMI_USER=admin
AMI_PASS=mysecret
_value1="$1"
_value2="$2"
if [ -z "$_value1" ]; then
    echo "You have to enter a valid Channel"
    echo "Usage: manager.sh <Channel> <Exten>"
    echo ""
    echo "for example:"
    echo " Action: Originate"
    echo " Channel: PJSIP/<Channel>"
    echo " Context: local"
    echo " Exten: <Exten>"
    echo " Priority: 1"
    echo " ActionID: ABC45678901234567890"
    exit 1
fi

if [ -z "$_value2" ]; then
    echo "You have to enter a valid Exten"
    echo "Usage: manager.sh <Channel> <Exten>"
    echo ""
    echo "for example:"
    echo " Action: Originate"
    echo " Channel: PJSIP/<Channel>"
    echo " Context: local"
    echo " Exten: <Exten>"
    echo " Priority: 1"
    echo " ActionID: ABC45678901234567890"
    exit 1
fi


expect << EOF

spawn telnet $ASTERISK_HOST 5038
expect "Asterisk Call Manager"
send "Action: Login\n"
send "Username: $AMI_USER\n"
send "Secret: $AMI_PASS\n"
send "Events: off\n"
send "\n"
expect "Response: Success"
expect "Message: Authentication accepted"
sleep 20
