MAC=x$(ifconfig bridge0 |awk '/HWaddr/ {print $5}'|sed 's/://g')
echo "$MAC" > "/etc/hostname"
hostnamectl set-hostname "$MAC"

HOSTIP=$(ip -4 route get 8.8.8.8 | awk {'print $7'} | tr -d '\n')
echo "127.0.0.1"  "       ""localhost" > "/etc/hosts"
echo "$HOSTIP" "  "     "$MAC".avlinkpro.com "   "    "$MAC" >> "/etc/hosts"

