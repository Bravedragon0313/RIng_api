
cd /etc/
killall fbi
dd if=/dev/zero of=/dev/fb0
/usr/bin/fbi -a --noverbose -T 1 /etc/avlinkpronew.png
exit
