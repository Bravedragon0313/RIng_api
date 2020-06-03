cd /etc/
tar -xvzf restorenetworkdefaults.tar.gz 
MAC=x$(ifconfig eth0 |awk '/HWaddr/ {print $5}'|sed 's/://g')
echo "$MAC" > "/etc/hostname"
hostnamectl set-hostname "$MAC"

HOSTIP=$(ip addr show bridge0 | grep "inet\b" | awk '{print $2}' | cut -d/ -f1)
echo "127.0.0.1"  "       ""localhost" > "/etc/hosts"
echo "$HOSTIP" "  "     "$MAC".avlinkpro.com "   "    "$MAC" >> "/etc/hosts"

/etc/restorelogin.sh
