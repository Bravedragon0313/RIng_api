
MAC=x$(ifconfig eth0 |awk '/HWaddr/ {print $5}'|sed 's/://g')
mysqldump -u sigman -psigman sigman | gzip -9 > $MAC-backupfile.sql.gz
#declarations
ftphost=ftp.xaccel.net
user=avlinkpro
password=For3v3r1002!

#Putting the file on ftp server
ftp -inv $ftphost >ftp-result.out 2>&1 <<End-Of-Session
user $user "$password"
put "${MAC}-backupfile.sql.gz"
bye
End-Of-Session

