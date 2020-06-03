cd /etc/
sudo rm /etc/rc.local
sudo cp /var/www/html/pbx/temp/rclocal2 /etc/rc.local
sudo chmod 755 /etc/rc.local
sudo chown root /etc/rc.local
sudo chgrp root /etc/rc.local


