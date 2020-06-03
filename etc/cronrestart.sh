cd /etc/
sudo rm /etc/crontab
sudo cp /var/www/html/pbx/temp/cronfile2 /etc/crontab
sudo chmod 644 /etc/crontab
sudo chown root /etc/crontab
sudo chgrp root /etc/crontab
sudo /etc/init.d/cron restart

